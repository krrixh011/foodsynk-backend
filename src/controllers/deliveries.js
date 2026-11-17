const events = require('../services/events');
const Delivery = require('../models/Delivery');
const Listing = require('../models/Listing');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// Works out WHY a status change was refused, so the driver gets a clear message.
async function whyCannotAdvance(id, userId, from) {
  const delivery = await Delivery.findById(id).select('status driver');
  if (!delivery) return new AppError('Delivery not found', 404);
  if (from !== 'pending' && !(delivery.driver && delivery.driver.equals(userId))) {
    return new AppError('This is not your delivery', 403);
  }
  return new AppError(`This delivery cannot move forward (it is ${delivery.status})`, 409);
}

// Moves a delivery from one status to the next in ONE atomic step.
async function advance(req, res, { from, to, listingStatus, takeJob }) {
  const filter = { _id: req.params.id, status: from };
  // accept: nobody has taken it yet. pickup/deliver: it must be MY delivery.
  filter.driver = takeJob ? null : req.user._id;

  const update = {
    $set: { status: to, ...(takeJob ? { driver: req.user._id } : {}) },
    $push: { timeline: { status: to, by: req.user._id, at: new Date() } },
  };

  const delivery = await Delivery.findOneAndUpdate(filter, update, { new: true });
  if (!delivery) throw await whyCannotAdvance(req.params.id, req.user._id, from);

  // Keep the food listing's status in step with the delivery
  if (listingStatus) {
    await Listing.updateOne({ _id: delivery.listing }, { $set: { status: listingStatus } });
  }
    events.deliveryUpdated(delivery, req.user);
  res.json({ success: true, delivery });
}

// GET /api/deliveries/available   (driver): jobs nobody has taken yet
exports.available = asyncHandler(async (req, res) => {
  const deliveries = await Delivery.find({ status: 'pending', driver: null })
    .populate('listing', 'title foodType quantity pickupAddress location expiresAt')
    .populate('ngo', 'name organization address location')
    .sort({ createdAt: -1 })
    .limit(50);
  res.json({ success: true, count: deliveries.length, deliveries });
});

// GET /api/deliveries/mine?status=accepted   (driver: my jobs, NGO: my claims)
exports.mine = asyncHandler(async (req, res) => {
  const filter = req.user.role === 'ngo' ? { ngo: req.user._id } : { driver: req.user._id };
  if (req.query.status) filter.status = req.query.status;

  const deliveries = await Delivery.find(filter)
    .populate({ path: 'listing', populate: { path: 'donor', select: 'name organization phone' } })
    .populate('ngo', 'name organization phone address')
    .populate('driver', 'name phone')
    .sort({ createdAt: -1 })
    .limit(100);
  res.json({ success: true, count: deliveries.length, deliveries });
});

// GET /api/deliveries/:id   (the donor, NGO or driver involved, or an admin)
exports.getDelivery = asyncHandler(async (req, res) => {
  const delivery = await Delivery.findById(req.params.id)
    .populate({ path: 'listing', populate: { path: 'donor', select: 'name organization phone' } })
    .populate('ngo', 'name organization phone address')
    .populate('driver', 'name phone');
  if (!delivery) throw new AppError('Delivery not found', 404);

  const me = req.user._id;
  const involved =
    req.user.role === 'admin' ||
    delivery.ngo?._id?.equals(me) ||
    delivery.driver?._id?.equals(me) ||
    delivery.listing?.donor?._id?.equals(me);
  if (!involved) throw new AppError('You do not have access to this delivery', 403);

  res.json({ success: true, delivery });
});

// PATCH /api/deliveries/:id/accept   (driver): take the job
exports.accept = asyncHandler((req, res) =>
  advance(req, res, { from: 'pending', to: 'accepted', takeJob: true }));

// PATCH /api/deliveries/:id/pickup   (the driver who accepted): food collected
exports.pickup = asyncHandler((req, res) =>
  advance(req, res, { from: 'accepted', to: 'picked_up', listingStatus: 'picked_up' }));

// PATCH /api/deliveries/:id/deliver  (the driver who accepted): food handed to the NGO
exports.deliver = asyncHandler((req, res) =>
  advance(req, res, { from: 'picked_up', to: 'delivered', listingStatus: 'delivered' }));