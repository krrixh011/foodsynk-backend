// Scores an available listing for one NGO, from 0 to 100.
// matchScore = distance 35% + urgency 30% + quantity vs capacity 25% + food type 10%

const WEIGHTS = { distance: 0.35, urgency: 0.3, quantity: 0.25, foodType: 0.1 };

const clamp = (n, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));
const round1 = (n) => Math.round(n * 10) / 10;

// Closer is better: 100 at 0 km, 0 at the edge of the search radius.
function distanceScore(distanceKm, radiusKm) {
  return clamp(100 * (1 - distanceKm / radiusKm));
}

// Food that expires soon should go first, but not if it is too late to collect it.
// Under 30 minutes left: 20. From 30 minutes to 3 hours: 100. Then falling to 20 at 24 hours or more.
function urgencyScore(hoursLeft) {
  if (hoursLeft <= 0.5) return 20;
  if (hoursLeft <= 3) return 100;
  if (hoursLeft >= 24) return 20;
  return 100 - ((hoursLeft - 3) * 80) / 21;
}

// Capacity is in portions per day, so only portion listings can be compared with it.
// Anything else (kg, litres, or an NGO with no capacity) gets a neutral 50.
function quantityScore(listing, capacity) {
  if (!capacity || listing.quantity?.unit !== 'portions') return { score: 50, fits: null };
  const qty = listing.quantity.value;
  if (qty <= capacity) return { score: 100 * (0.6 + (0.4 * qty) / capacity), fits: true };
  return { score: 100 * (capacity / qty), fits: false };
}

// Preference comes from what the NGO has claimed before. No history means a neutral 50.
function foodTypeScore(foodType, typeCounts) {
  const total = Object.values(typeCounts).reduce((sum, n) => sum + n, 0);
  if (!total) return { score: 50, share: 0 };
  const share = (typeCounts[foodType] || 0) / total;
  return { score: 50 + 50 * share, share };
}

function formatTimeLeft(hours) {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${round1(hours)} h`;
  return `${round1(hours / 24)} days`;
}

// listing: a nearby result with distanceKm. ctx: { capacity, typeCounts, radiusKm, now }
function scoreListing(listing, { capacity, typeCounts, radiusKm, now }) {
  const hoursLeft = (new Date(listing.expiresAt).getTime() - now) / 3600000;
  const q = quantityScore(listing, capacity);
  const t = foodTypeScore(listing.foodType, typeCounts);

  const scores = {
    distance: distanceScore(listing.distanceKm, radiusKm),
    urgency: urgencyScore(hoursLeft),
    quantity: q.score,
    foodType: t.score,
  };
  const total =
    WEIGHTS.distance * scores.distance +
    WEIGHTS.urgency * scores.urgency +
    WEIGHTS.quantity * scores.quantity +
    WEIGHTS.foodType * scores.foodType;

  const parts = [`${round1(listing.distanceKm)} km away`, `expires in ${formatTimeLeft(hoursLeft)}`];
  if (q.fits === true) parts.push(`${listing.quantity.value} portions fits your daily capacity`);
  if (q.fits === false) parts.push(`${listing.quantity.value} portions is more than your daily capacity`);
  if (t.share >= 0.3) parts.push(`you often take ${listing.foodType} food`);
  const reason = parts.join(', ').replace(/^./, (c) => c.toUpperCase());

  return {
    matchScore: Math.round(total),
    reason,
    scores: {
      distance: Math.round(scores.distance),
      urgency: Math.round(scores.urgency),
      quantity: Math.round(scores.quantity),
      foodType: Math.round(scores.foodType),
    },
  };
}

module.exports = { scoreListing, WEIGHTS };