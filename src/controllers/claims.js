const events = require('../services/events');
const Listing = require('../models/Listing');
const Delivery = require('../models/Delivery');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// Works out WHY a claim was refused, so the NGO gets a clear message.
async function whyCannotClaim(id) {
  const listing = await Listing.findById(id).select('status expiresAt');
  if (!listing) return new AppError('Listing not found', 404);
  if (listing.status !== 'available') {
    return new AppError(`This listing is no longer available (it is ${listing.status})`, 409);
  }
  return new AppError('This listing has expired', 409);
}

// POST /api/claims/:listingId   (verified NGO)
exports.claimListing = asyncHandler(async (req, res) => {
  // ONE atomic step: the update only succeeds if the food is still available
  // and not expired. If two NGOs click at the same moment, only one wins.
  const listing = await Listing.findOneAndUpdate(
    { _id: req.params.listingId, status: 'available', expiresAt: { $gt: new Date() } },
    { $set: { status: 'claimed', claimedBy: req.user._id } },
    { new: true }
  );
  if (!listing) throw await whyCannotClaim(req.params.listingId);

  let delivery;
  try {
    delivery = await Delivery.create({
      listing: listing._id,
      ngo: req.user._id,
      timeline: [{ status: 'pending', by: req.user._id }],
    });
  } catch (err) {
    // Could not create the delivery: put the food back so it isn't stuck as "claimed"
    await Listing.updateOne(
      { _id: listing._id, claimedBy: req.user._id },
      { $set: { status: 'available' }, $unset: { claimedBy: 1 } }
    );
    throw err;
  }
  events.listingClaimed(listing, delivery, req.user);
  res.status(201).json({ success: true, listing, delivery });
});