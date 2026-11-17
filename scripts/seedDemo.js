require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const Listing = require('../src/models/Listing');
const Delivery = require('../src/models/Delivery');

const PASSWORD = process.env.SEED_PASSWORD || 'Demo@12345';
const SEED_EMAIL = /^seed_.*@foodsynk\.demo$/;
const hoursFromNow = (h) => new Date(Date.now() + h * 3600 * 1000);

// Bhopal: coordinates are [longitude, latitude]
const pt = (lng, lat) => ({ type: 'Point', coordinates: [lng, lat] });

async function clean() {
  const ids = (await User.find({ email: SEED_EMAIL }).select('_id')).map((u) => u._id);
  const d = await Delivery.deleteMany({ $or: [{ ngo: { $in: ids } }, { driver: { $in: ids } }] });
  const l = await Listing.deleteMany({ donor: { $in: ids } });
  const u = await User.deleteMany({ _id: { $in: ids } });
  console.log(`Removed ${u.deletedCount} users, ${l.deletedCount} listings, ${d.deletedCount} deliveries (seed only)`);
}

async function seed() {
  if (await User.exists({ email: SEED_EMAIL })) {
    console.log('Seed data already exists. Run with --clean first to remove it.');
    return;
  }

  const mk = (name, role, n, extra) =>
    User.create({
      name,
      email: `seed_${role}${n}@foodsynk.demo`,
      password: PASSWORD,
      role,
      verified: true,
      phone: `9800000${role.length}${n}0`,
      ...extra,
    });

  const donor1 = await mk('Bhopal Biryani House', 'donor', 1, {
    organization: 'Biryani House', address: 'MP Nagar Zone 1, Bhopal', location: pt(77.4344, 23.2332),
  });
  const donor2 = await mk('New Market Sweets', 'donor', 2, {
    organization: 'New Market Sweets', address: 'New Market, Bhopal', location: pt(77.4000, 23.2350),
  });
  const ngo1 = await mk('Annapurna Seva Trust', 'ngo', 1, {
    organization: 'Annapurna Seva Trust', address: 'Arera Colony, Bhopal', location: pt(77.4380, 23.2160),
  });
  const ngo2 = await mk('Roti Bank Bhopal', 'ngo', 2, {
    organization: 'Roti Bank', address: 'Kolar Road, Bhopal', location: pt(77.4100, 23.1900),
  });
  const drv1 = await mk('Ravi Kumar', 'delivery', 1, { address: 'Habibganj, Bhopal', location: pt(77.4390, 23.2280) });
  const drv2 = await mk('Imran Khan', 'delivery', 2, { address: 'Bairagarh, Bhopal', location: pt(77.3380, 23.2830) });

  const L = (donor, title, foodType, value, unit, status, extra = {}) => ({
    donor: donor._id,
    title,
    foodType,
    quantity: { value, unit },
    expiresAt: hoursFromNow(6),
    pickupAddress: donor.address,
    location: donor.location,
    status,
    ...extra,
  });

  // Listings in every status
  const available1 = await Listing.create(L(donor1, 'Veg Biryani (fresh)', 'cooked', 25, 'portions', 'available'));
  const available2 = await Listing.create(L(donor2, 'Assorted Sweets Box', 'packaged', 5, 'kg', 'available'));
  const claimed1 = await Listing.create(L(donor1, 'Dal and Rice', 'cooked', 30, 'portions', 'claimed', { claimedBy: ngo1._id }));
  const picked1 = await Listing.create(L(donor2, 'Bread and Buns', 'bakery', 12, 'kg', 'picked_up', { claimedBy: ngo2._id }));
  const deliv1 = await Listing.create(L(donor1, 'Paneer Curry and Roti', 'cooked', 20, 'portions', 'delivered', { claimedBy: ngo1._id, expiresAt: hoursFromNow(-2) }));
  const deliv2 = await Listing.create(L(donor2, 'Poha Breakfast', 'cooked', 22, 'portions', 'delivered', { claimedBy: ngo2._id, expiresAt: hoursFromNow(-5) }));
  const deliv3 = await Listing.create(L(donor1, 'Fresh Vegetables', 'produce', 15, 'kg', 'delivered', { claimedBy: ngo2._id, expiresAt: hoursFromNow(-8) }));
  await Listing.create(L(donor2, 'Old Samosas', 'cooked', 10, 'portions', 'expired', { expiresAt: hoursFromNow(-24) }));
  await Listing.create(L(donor1, 'Cancelled Lunch Packs', 'packaged', 8, 'portions', 'cancelled'));

  // Deliveries with timelines
  const T = (list) => list.map(([status, hoursAgo, by]) => ({ status, at: hoursFromNow(-hoursAgo), by: by._id }));

  await Delivery.create([
    { listing: claimed1._id, ngo: ngo1._id, status: 'pending', timeline: T([['pending', 1, ngo1]]) },
    {
      listing: picked1._id, ngo: ngo2._id, driver: drv2._id, status: 'picked_up',
      timeline: T([['pending', 3, ngo2], ['accepted', 2, drv2], ['picked_up', 1, drv2]]),
    },
    {
      listing: deliv1._id, ngo: ngo1._id, driver: drv1._id, status: 'delivered',
      timeline: T([['pending', 6, ngo1], ['accepted', 5, drv1], ['picked_up', 4, drv1], ['delivered', 3, drv1]]),
    },
    {
      listing: deliv2._id, ngo: ngo2._id, driver: drv2._id, status: 'delivered',
      timeline: T([['pending', 9, ngo2], ['accepted', 8, drv2], ['picked_up', 7, drv2], ['delivered', 6, drv2]]),
    },
    {
      listing: deliv3._id, ngo: ngo2._id, driver: drv1._id, status: 'delivered',
      timeline: T([['pending', 12, ngo2], ['accepted', 11, drv1], ['picked_up', 10, drv1], ['delivered', 9, drv1]]),
    },
  ]);

  console.log('Seed done: 6 users, 9 listings, 5 deliveries (Bhopal)');
  console.log(`Login emails: seed_donor1@foodsynk.demo, seed_ngo1@foodsynk.demo, seed_delivery1@foodsynk.demo`);
  console.log(`Password: ${PASSWORD}`);
}

(async () => {
  try {
    await connectDB();
    if (process.argv.includes('--clean')) await clean();
    else await seed();
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();