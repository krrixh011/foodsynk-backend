// Rule-based shelf-life estimate (NOT AI). Rules live here so they are easy to change.
// The hour values are conservative PLACEHOLDERS: check them against FSSAI or your
// canteen's food-safety guidance before presenting them as authoritative.

const FOOD_TYPES = ['cooked', 'raw', 'bakery', 'produce', 'packaged']; // same as listings
const STORAGES = ['hot_held', 'ambient', 'refrigerated'];

// Max safe hours after preparation. 0 = not allowed in that storage.
const RULES = {
  cooked:   { hot_held: 4, ambient: 1,   refrigerated: 24 },
  raw:      { hot_held: 0, ambient: 1,   refrigerated: 24 },
  bakery:   { hot_held: 6, ambient: 12,  refrigerated: 48 },
  produce:  { hot_held: 0, ambient: 24,  refrigerated: 120 },
  packaged: { hot_held: 0, ambient: 168, refrigerated: 168 }, // printed expiry date wins
};

const DAIRY_FACTOR = 0.5;   // milk/cream items spoil faster outside the fridge
const DAIRY_AMBIENT_CAP_HOURS = 2; // ...and never more than 2 hours outside the fridge
const KM_PER_SAFE_HOUR = 2; // same rule as the AI service's /surplus

function shelfLifeHours({ foodType, storage = 'ambient', hoursSincePrepared = 0, containsDairy = false }) {
  const base = RULES[foodType]?.[storage];
  if (base === undefined) return null;
   const max =
    containsDairy && storage !== 'refrigerated' && foodType !== 'packaged'
      ? Math.min(base * DAIRY_FACTOR, DAIRY_AMBIENT_CAP_HOURS)
      : base;
  return Math.max(0, +(max - hoursSincePrepared).toFixed(1));
}

// Distance in km between two points (used for the /surplus NGO list).
function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return +(2 * 6371 * Math.asin(Math.sqrt(a))).toFixed(2);
}

module.exports = { FOOD_TYPES, STORAGES, RULES, KM_PER_SAFE_HOUR, shelfLifeHours, haversineKm };