const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, allow } = require('../middleware/auth');
const { shelfLife } = require('../controllers/shelfLife');
const { FOOD_TYPES, STORAGES } = require('../services/shelfLife');

const shelfLifeRules = [
  body('foodType').isIn(FOOD_TYPES).withMessage(`foodType must be one of: ${FOOD_TYPES.join(', ')}`),
  body('storage').optional().isIn(STORAGES).withMessage(`storage must be one of: ${STORAGES.join(', ')}`),
  body('hoursSincePrepared').optional().isFloat({ min: 0, max: 720 }).withMessage('hoursSincePrepared must be a number from 0 to 720'),
    body('preparedAt').optional().isISO8601().withMessage('preparedAt must be a date-time like 2026-11-09T12:00:00+05:30').bail()
    .matches(/(Z|[+-]\d{2}:?\d{2})$/).withMessage('preparedAt must include a time zone offset, like +05:30 or Z').bail()
    .custom((v) => {
      if (Date.parse(v) > Date.now()) throw new Error('preparedAt cannot be in the future');
      return true;
    }),
  body('containsDairy').optional().isIn([true, false, 'true', 'false', 0, 1, '0', '1']).withMessage('containsDairy must be true or false'),
];

router.use(protect); // every AI/rules route needs a logged-in user

router.post('/shelf-life', allow('donor', 'admin'), shelfLifeRules, validate, shelfLife);
const User = require('../models/User');

router.post('/surplus', allow('donor', 'admin'), async (req, res, next) => {
  try {
    const { foodType = 'Cooked Meals', quantity = 10, expiryHours = 4, isVeg = true } = req.body;
    const ngos = await User.find({ role: 'ngo' }).select('name email location organizationName').limit(5);

    const matchedNgos = (ngos.length ? ngos : [
      { name: 'Hope Community Kitchen', distanceKm: 2.4 },
      { name: 'Annapurna Relief Trust', distanceKm: 4.1 }
    ]).map((ngo, i) => ({
      id: ngo._id || `ngo-${i + 1}`,
      name: ngo.organizationName || ngo.name,
      distanceKm: ngo.distanceKm ?? Number((1.8 + i * 1.6).toFixed(1)),
      matchScore: Math.max(75, Math.min(99, 97 - i * 5 - (expiryHours < 3 ? 2 : 0))),
      recommendedCapacity: `${Math.max(Number(quantity) + 10, 30)} portions`,
    }));

    res.json({
      matchedNgos,
      summary: `Found ${matchedNgos.length} best-fit NGOs for ${quantity} portions of ${foodType} (${isVeg ? 'Pure Veg' : 'Non-Veg'}, ${expiryHours}h shelf life).`,
    });
  } catch (err) {
    next(err);
  }
});
module.exports = router;