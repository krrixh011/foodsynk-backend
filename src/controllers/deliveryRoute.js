const Delivery = require('../models/Delivery');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { getRoute } = require('../services/routing');

exports.getDeliveryRoute = asyncHandler(async (req, res) => {
  const d = await Delivery.findById(req.params.id)
    .populate('listing')
    .populate('ngo', 'name address location');
  if (!d) throw new AppError('Delivery not found', 404);

  // Only people in this delivery, or an admin, can see the route
  const me = req.user.id;
  const allowed =
    req.user.role === 'admin' ||
    [d.ngo?._id, d.driver, d.listing?.donor].some((id) => id && id.toString() === me);
  if (!allowed) throw new AppError('You do not have permission to view this route', 403);

  const from = d.listing?.location?.coordinates;
  const to = d.ngo?.location?.coordinates;
  if (!from || !to) throw new AppError('Pickup or NGO location is missing', 422);

  let route;
  try {
    route = await getRoute(from, to);
  } catch (err) {
    throw new AppError('Route service is unavailable, try again later', 503);
  }

  res.json({
    success: true,
    data: {
      pickup: { address: d.listing.pickupAddress, coordinates: from },
      dropoff: { name: d.ngo.name, address: d.ngo.address, coordinates: to },
      ...route,
    },
  });
});