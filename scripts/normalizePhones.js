require('dotenv').config();
const mongoose = require('mongoose');
const { normalizePhone } = require('../src/utils/phone');

const apply = process.argv.includes('--apply');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const col = mongoose.connection.collection('users');
  const users = await col
    .find({ phone: { $type: 'string' } }, { projection: { name: 1, email: 1, phone: 1 } })
    .toArray();

  const groups = new Map();
  const invalid = [];
  const empty = [];
  for (const u of users) {
    if (u.phone.trim() === '') { empty.push(u); continue; }
    const n = normalizePhone(u.phone);
    if (!n) { invalid.push(u); continue; }
    if (!groups.has(n)) groups.set(n, []);
    groups.get(n).push(u);
  }

  const duplicates = [...groups.entries()].filter(([, list]) => list.length > 1);
  const toUpdate = [...groups.entries()].filter(([n, list]) => list.length === 1 && list[0].phone !== n);

  console.log(`Users with a phone: ${users.length}`);
  console.log(`Empty phones to remove: ${empty.length}`);
  console.log(`Need normalising: ${toUpdate.length}`);
  console.log(`Invalid (fix by hand): ${invalid.length}`);
  invalid.forEach((u) => console.log('  invalid:', u.email, JSON.stringify(u.phone)));
  console.log(`Duplicates (fix by hand): ${duplicates.length}`);
  duplicates.forEach(([n, list]) => console.log('  duplicate', n, '->', list.map((u) => u.email).join(', ')));

  if (apply) {
    for (const u of empty) await col.updateOne({ _id: u._id }, { $unset: { phone: '' } });
    for (const [n, list] of toUpdate) await col.updateOne({ _id: list[0]._id }, { $set: { phone: n } });
    console.log('Applied.');
  } else {
    console.log('Dry run only. Add --apply to write changes.');
  }
  await mongoose.disconnect();
})();