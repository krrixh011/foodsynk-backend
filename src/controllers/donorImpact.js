const Listing = require('../models/Listing');
const Delivery = require('../models/Delivery');
const asyncHandler = require('../utils/asyncHandler');
const f = require('../config/impactFactors');

const toKg = (unit, value) =>
  unit === 'kg' ? value : unit === 'litres' ? value * f.KG_PER_LITRE : value * f.KG_PER_PORTION;
const round1 = (n) => Math.round(n * 10) / 10;

// Returns [{ quantity, at }] for everything this user delivered, whatever their role
async function myDelivered(user) {
  if (user.role === 'donor') {
    const rows = await Listing.find({ donor: user._id, status: 'delivered' }).select('quantity updatedAt');
    return rows.map((r) => ({ quantity: r.quantity, at: r.updatedAt }));
  }
  const field = user.role === 'ngo' ? 'ngo' : 'driver'; // driver role is "delivery"
  const rows = await Delivery.find({ [field]: user._id, status: 'delivered' })
    .populate('listing', 'quantity')
    .select('listing updatedAt');
  return rows.filter((r) => r.listing?.quantity).map((r) => ({ quantity: r.listing.quantity, at: r.updatedAt }));
}

exports.getMyImpact = asyncHandler(async (req, res) => {
  const items = await myDelivered(req.user);
  const kg = items.reduce((sum, i) => sum + toKg(i.quantity.unit, i.quantity.value), 0);
  const meals = Math.round(kg / f.KG_PER_PORTION);
  res.json({
    success: true,
    data: {
      role: req.user.role,
      foodSavedKg: round1(kg),
      mealsShared: meals,
      peopleHelped: Math.round(meals * f.PEOPLE_PER_PORTION),
      co2AvoidedKg: round1(kg * f.CO2E_PER_KG),
      listingsDelivered: items.length,
      deliveriesCompleted: items.length,
    },
  });
});

exports.getMyMonthly = asyncHandler(async (req, res) => {
  const months = Math.min(24, Math.max(1, parseInt(req.query.months) || 6));
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  const items = (await myDelivered(req.user)).filter((i) => i.at >= start);

  const key = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  const byMonth = {};
  items.forEach((i) => {
    byMonth[key(i.at)] = (byMonth[key(i.at)] || 0) + toKg(i.quantity.unit, i.quantity.value);
  });

  const data = [];
  for (let i = 0; i < months; i++) {
    const k = key(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1)));
    data.push({ month: k, foodSavedKg: round1(byMonth[k] || 0) });
  }
  res.json({ success: true, data });
});