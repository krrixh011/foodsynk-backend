const User = require('../models/User');
const Listing = require('../models/Listing');
const notify = require('./notify');
const notifyUser = require('./notifyUser');

const NEARBY_KM = 10; // same default radius as /listings/nearby and /listings/recommended
const EARTH_KM = 6378.1;

const idOf = (v) => String(v?._id ?? v);

function distanceKm([lng1, lat1], [lng2, lat2]) {
  const rad = (d) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(a));
}

// A failure in any step is logged and never reaches the controller that called us.
async function safe(label, fn) {
  try {
    await fn();
  } catch (err) {
    console.warn(`[events] ${label} failed:`, err.message);
  }
}

// Live event over the socket, plus a stored notification for the bell when `stored` is given.
function tell(userId, event, payload, stored) {
  return safe(`${event} -> ${userId}`, async () => {
    notify.toUser(String(userId), event, payload);
    if (stored) await notifyUser(userId, stored);
  });
}

// A donor posted food: tell verified NGOs within 10 km, and verified NGOs with no saved location.
async function listingCreated(listing, donor) {
  await safe('listing:new', async () => {
    const point = listing.location.coordinates;
    const base = {
      _id: idOf(listing),
      title: listing.title,
      foodType: listing.foodType,
      quantity: { value: listing.quantity.value, unit: listing.quantity.unit },
      veg: listing.veg,
      expiresAt: listing.expiresAt,
      pickupAddress: listing.pickupAddress,
      location: { type: 'Point', coordinates: point },
      status: listing.status,
      donor: { _id: idOf(donor), name: donor.name, organization: donor.organization },
    };
    const stored = {
      type: 'listing_new',
      title: 'New food nearby',
      message: `${donor.organization || donor.name} posted ${listing.title}.`,
      data: { listingId: idOf(listing) },
    };

    const ngoFilter = { role: 'ngo', verified: true, isActive: true };
    const [near, noLocation] = await Promise.all([
      User.find({
        ...ngoFilter,
        location: { $geoWithin: { $centerSphere: [point, NEARBY_KM / EARTH_KM] } },
      }).select('location'),
      User.find({ ...ngoFilter, 'location.coordinates.0': { $exists: false } }).select('_id'),
    ]);

    await Promise.all([
      ...near.map((ngo) => {
        const km = Math.round(distanceKm(point, ngo.location.coordinates) * 10) / 10;
        return tell(ngo._id, 'listing:new', { ...base, distanceKm: km }, stored);
      }),
      ...noLocation.map((ngo) => tell(ngo._id, 'listing:new', base, stored)),
    ]);
  });
}

// An NGO claimed it: tell the donor, and show the job to every driver.
async function listingClaimed(listing, delivery, ngo) {
  const ngoInfo = { _id: idOf(ngo), name: ngo.name, organization: ngo.organization };
  await Promise.all([
    tell(
      listing.donor,
      'listing:claimed',
      {
        listingId: idOf(listing),
        title: listing.title,
        status: 'claimed',
        deliveryId: idOf(delivery),
        ngo: ngoInfo,
      },
      {
        type: 'listing_claimed',
        title: 'Your food was claimed',
        message: `${ngo.organization || ngo.name} claimed ${listing.title}.`,
        data: { listingId: idOf(listing), deliveryId: idOf(delivery) },
      }
    ),
    safe('delivery:new', async () => {
      notify.toRole('delivery', 'delivery:new', {
        deliveryId: idOf(delivery),
        listingId: idOf(listing),
        title: listing.title,
        status: delivery.status,
        pickupAddress: listing.pickupAddress,
        location: listing.location,
        expiresAt: listing.expiresAt,
        ngo: { name: ngo.name, organization: ngo.organization },
      });
    }),
  ]);
}

function statusText(status, { title, driverName, ngoName }) {
  switch (status) {
    case 'accepted':
      return { title: 'A driver accepted the job', message: `${driverName} will collect ${title}.` };
    case 'picked_up':
      return { title: 'Food picked up', message: `${title} has been collected and is on its way.` };
    case 'delivered':
      return { title: 'Food delivered', message: `${title} was delivered to ${ngoName}.` };
    default:
      return { title: 'Delivery updated', message: `${title} is now ${status}.` };
  }
}

// A driver moved the delivery forward: tell the donor, the NGO and the driver.
async function deliveryUpdated(delivery, driver) {
  await safe('delivery:updated', async () => {
    const [listing, ngo] = await Promise.all([
      Listing.findById(delivery.listing).select('title donor'),
      User.findById(delivery.ngo).select('name organization'),
    ]);
    if (!listing) return;

    const payload = {
      deliveryId: idOf(delivery),
      listingId: idOf(listing),
      title: listing.title,
      status: delivery.status,
      driver: { _id: idOf(driver), name: driver.name },
      at: new Date().toISOString(),
    };
    const text = statusText(delivery.status, {
      title: listing.title,
      driverName: driver.name,
      ngoName: ngo?.organization || ngo?.name || 'the NGO',
    });
    const stored = {
      type: 'delivery_updated',
      ...text,
      data: { listingId: idOf(listing), deliveryId: idOf(delivery), status: delivery.status },
    };

    await Promise.all([
      tell(listing.donor, 'delivery:updated', payload, stored), // donor: live event and bell
      tell(delivery.ngo, 'delivery:updated', payload, stored), // NGO: live event and bell
      tell(driver._id, 'delivery:updated', payload), // the driver did it, so no bell entry
    ]);
  });
}

module.exports = { listingCreated, listingClaimed, deliveryUpdated };