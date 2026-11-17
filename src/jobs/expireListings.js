const Listing = require('../models/Listing');

// Marks food that is past its expiry time as "expired".
// (The nearby search already hides expired food; this keeps the stored
// status correct for "my listings", the admin views and the impact numbers.)
async function expireListings() {
  const result = await Listing.updateMany(
    { status: 'available', expiresAt: { $lt: new Date() } },
    { $set: { status: 'expired' } }
  );
  if (result.modifiedCount > 0) console.log(`Expiry job: marked ${result.modifiedCount} listing(s) as expired`);
  return result.modifiedCount;
}

// Runs once right away, then every few minutes.
function startExpiryJob(intervalMs = 5 * 60 * 1000) {
  const run = () => expireListings().catch((err) => console.error('Expiry job failed:', err.message));
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref(); // never keeps the server process alive on its own
  return timer;
}

module.exports = { expireListings, startExpiryJob };