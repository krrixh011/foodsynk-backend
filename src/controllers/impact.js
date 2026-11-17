const Listing = require('../models/Listing');
const Delivery = require('../models/Delivery');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

exports.getImpact = asyncHandler(async (req, res) => {
  const [deliveredByUnit, completedDeliveries, activeDonors, activeNgos] = await Promise.all([
    Listing.aggregate([
      { $match: { status: 'delivered' } },
      { $group: { _id: '$quantity.unit', total: { $sum: '$quantity.value' }, listings: { $sum: 1 } } },
    ]),
    Delivery.countDocuments({ status: 'delivered' }),
    User.countDocuments({ role: 'donor', isActive: true }),
    User.countDocuments({ role: 'ngo', isActive: true }),
  ]);

  const quantityDelivered = { kg: 0, portions: 0, litres: 0 };
  let listingsDelivered = 0;
  deliveredByUnit.forEach((row) => {
    quantityDelivered[row._id] = row.total;
    listingsDelivered += row.listings;
  });

  res.json({
    success: true,
    data: {
      mealsRescued: quantityDelivered.portions,
      quantityDelivered,
      listingsDelivered,
      completedDeliveries,
      activeDonors,
      activeNgos,
    },
  });
});