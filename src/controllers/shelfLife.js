const asyncHandler = require('../utils/asyncHandler');
const { shelfLifeHours, KM_PER_SAFE_HOUR } = require('../services/shelfLife');

// POST /api/ai/shelf-life   (donor or admin)
exports.shelfLife = asyncHandler(async (req, res) => {
  const { foodType, storage = 'ambient', hoursSincePrepared, preparedAt, containsDairy } = req.body;

  // Hours since the food was made: given directly, or worked out from preparedAt
  let hours = 0;
  if (hoursSincePrepared !== undefined) hours = Number(hoursSincePrepared);
  else if (preparedAt !== undefined) hours = Math.max(0, (Date.now() - Date.parse(preparedAt)) / 3600000);

  const safeHours = shelfLifeHours({
    foodType,
    storage,
    hoursSincePrepared: hours,
    containsDairy: ['true', '1'].includes(String(containsDairy)),
  });

  const shelfLife = {
    foodType,
    storage,
    safeHours,
        // No suggestion for unsafe food, or for packaged food (its printed date decides)
    suggestedExpiresAt:
      safeHours === 0 || foodType === 'packaged'
        ? null
        : new Date(Date.now() + safeHours * 3600000).toISOString(),
        maxTravelKm: +(Math.min(safeHours, 12) * KM_PER_SAFE_HOUR).toFixed(1), // capped at 12 hours
    source: 'rules', // always "rules": this is not AI
  };
  if (foodType === 'packaged') shelfLife.note = 'For packaged food the printed expiry date takes priority.';
  if (safeHours === 0) shelfLife.note = 'Not safe to donate under these conditions.';

  res.json({ success: true, shelfLife });
});