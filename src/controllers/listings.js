const events = require('../services/events');
const Listing = require('../models/Listing');
const Delivery = require('../models/Delivery');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { scoreListing } = require('../services/matching');

// Explains WHY a change was refused, so the donor gets a clear message.
async function whyNotAllowed(id, userId) {
  const listing = await Listing.findById(id).select('donor status');
  if (!listing) return new AppError('Listing not found', 404);
  if (!listing.donor.equals(userId)) return new AppError('You can only change your own listings', 403);
  return new AppError(`Only available listings can be changed (this one is ${listing.status})`, 409);
}

// POST /api/listings   (donor)
exports.createListing = asyncHandler(async (req, res) => {
  const { title, description, foodType, quantity, veg, preparedAt, expiresAt, pickupAddress, lng, lat } = req.body;

  const listing = await Listing.create({
    donor: req.user._id,
    title, description, foodType, quantity, veg, preparedAt, expiresAt, pickupAddress,
    location: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
  });
    events.listingCreated(listing, req.user);
  res.status(201).json({ success: true, listing });
});

// Friendly names the frontend tabs can use instead of the raw statuses
const STATUS_ALIASES = {
  reserved: ['claimed', 'picked_up'], // promised to an NGO, not delivered yet
  completed: ['delivered'],
  closed: ['cancelled', 'expired'], // food that did not go out
};

// GET /api/listings/mine?status=available|claimed|...|reserved|completed|closed   (donor)
// Each listing also carries its delivery ({ _id, status }) so the donor can track it.
exports.myListings = asyncHandler(async (req, res) => {
  const filter = { donor: req.user._id };
  const { status } = req.query;
  if (status) filter.status = STATUS_ALIASES[status] ? { $in: STATUS_ALIASES[status] } : status;

  const found = await Listing.find(filter).sort({ createdAt: -1 }).limit(100);

  // One extra query for all of them (newest delivery first, so the latest one wins)
  const deliveries = found.length
    ? await Delivery.find({ listing: { $in: found.map((l) => l._id) } }).select('listing status').sort({ createdAt: -1 })
    : [];
  const byListing = new Map();
  for (const d of deliveries) {
    const key = String(d.listing);
    if (!byListing.has(key)) byListing.set(key, { _id: d._id, status: d.status });
  }

  const listings = found.map((l) => ({ ...l.toJSON(), delivery: byListing.get(String(l._id)) || null }));
  res.json({ success: true, count: listings.length, listings });
});

// GET /api/listings/nearby?lng=77.41&lat=23.25&radius=10   (verified NGO)
exports.nearby = asyncHandler(async (req, res) => {
  const { lng, lat, radius = 10, foodType, veg } = req.query;

  const query = {
    status: 'available',
    expiresAt: { $gt: new Date() }, // never show expired food
  };
  if (foodType) query.foodType = foodType;
  if (veg !== undefined) query.veg = veg === 'true';

  const listings = await Listing.aggregate([
    {
      // $geoNear returns the closest first AND tells us how far each one is
      $geoNear: {
        near: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
        distanceField: 'distanceKm',
        distanceMultiplier: 0.001, // metres -> kilometres
        maxDistance: Number(radius) * 1000, // km -> metres
        spherical: true,
        query,
      },
    },
    { $limit: 50 },
    {
      $lookup: {
        from: 'users',
        localField: 'donor',
        foreignField: '_id',
        as: 'donor',
        pipeline: [{ $project: { name: 1, organization: 1 } }],
      },
    },
    { $unwind: { path: '$donor', preserveNullAndEmptyArrays: true } },
    { $project: { __v: 0 } },
  ]);

  // One decimal place, e.g. 3.4 km
  for (const listing of listings) listing.distanceKm = Math.round(listing.distanceKm * 10) / 10;

  res.json({ success: true, count: listings.length, listings });
});

// GET /api/listings/:id   (any logged-in user)
exports.getListing = asyncHandler(async (req, res) => {
  const listing = await Listing.findById(req.params.id).populate('donor', 'name organization');
  if (!listing) throw new AppError('Listing not found', 404);
  res.json({ success: true, listing });
});

// PATCH /api/listings/:id   (the donor who posted it, only while available)
exports.updateListing = asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  const updates = {};

  for (const field of ['title', 'description', 'foodType', 'veg', 'preparedAt', 'expiresAt', 'pickupAddress']) {
    if (body[field] !== undefined) updates[field] = body[field];
  }
  if (body.quantity?.value !== undefined) updates['quantity.value'] = body.quantity.value;
  if (body.quantity?.unit !== undefined) updates['quantity.unit'] = body.quantity.unit;
  if (body.lng !== undefined && body.lat !== undefined) {
    updates.location = { type: 'Point', coordinates: [Number(body.lng), Number(body.lat)] };
  }
  if (Object.keys(updates).length === 0) throw new AppError('Send at least one field to update', 400);

  // One atomic step: only succeeds if it is MY listing and still available
  const listing = await Listing.findOneAndUpdate(
    { _id: req.params.id, donor: req.user._id, status: 'available' },
    { $set: updates },
    { new: true, runValidators: true }
  );
  if (!listing) throw await whyNotAllowed(req.params.id, req.user._id);
  res.json({ success: true, listing });
});

// PATCH /api/listings/:id/cancel   (the donor who posted it, only while available)
exports.cancelListing = asyncHandler(async (req, res) => {
  const listing = await Listing.findOneAndUpdate(
    { _id: req.params.id, donor: req.user._id, status: 'available' },
    { $set: { status: 'cancelled' } },
    { new: true }
  );
  if (!listing) throw await whyNotAllowed(req.params.id, req.user._id);
  res.json({ success: true, listing });
});

// GET /api/listings/recommended?lng=77.41&lat=23.25&radius=10&limit=20   (verified NGO)
// Available food near the NGO, best match first, with a matchScore (0-100) and a reason.
exports.recommended = asyncHandler(async (req, res) => {
  const { radius = 10, limit = 20, foodType, veg } = req.query;
  let { lng, lat } = req.query;

  // No coordinates in the request: use the location saved on the NGO's profile
  if (lng === undefined || lat === undefined) {
    const saved = req.user.location?.coordinates;
    if (!saved || saved.length !== 2) throw new AppError('Send lng and lat, or save a location on your profile', 400);
    [lng, lat] = saved;
  }
  const radiusKm = Number(radius);

  const query = { status: 'available', expiresAt: { $gt: new Date() } };
  if (foodType) query.foodType = foodType;
  if (veg !== undefined) query.veg = veg === 'true';

  const [listings, history] = await Promise.all([
    Listing.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
          distanceField: 'distanceKm',
          distanceMultiplier: 0.001, // metres -> kilometres
          maxDistance: radiusKm * 1000,
          spherical: true,
          query,
        },
      },
      { $limit: 100 },
      {
        $lookup: {
          from: 'users',
          localField: 'donor',
          foreignField: '_id',
          as: 'donor',
          pipeline: [{ $project: { name: 1, organization: 1 } }],
        },
      },
      { $unwind: { path: '$donor', preserveNullAndEmptyArrays: true } },
      { $project: { __v: 0 } },
    ]),
        // What this NGO has taken before, by food type (used for the food type score).
    // Only claims that went ahead count: accepted, picked up or delivered (not pending or cancelled).
    Delivery.aggregate([
      { $match: { ngo: req.user._id, status: { $in: ['accepted', 'picked_up', 'delivered'] } } },
      {
        $lookup: {
          from: 'listings',
          localField: 'listing',
          foreignField: '_id',
          as: 'listing',
          pipeline: [{ $project: { foodType: 1 } }],
        },
      },
      { $unwind: '$listing' },
      { $group: { _id: '$listing.foodType', count: { $sum: 1 } } },
    ]),
  ]);

  const typeCounts = Object.fromEntries(history.map((h) => [h._id, h.count]));
  const now = Date.now();

  const scored = listings
    .map((listing) => {
      const result = scoreListing(listing, { capacity: req.user.capacity, typeCounts, radiusKm, now });
      return { ...listing, distanceKm: Math.round(listing.distanceKm * 10) / 10, ...result };
    })
    .sort((a, b) => b.matchScore - a.matchScore || a.distanceKm - b.distanceKm)
    .slice(0, Number(limit));

  res.json({ success: true, count: scored.length, listings: scored });
});