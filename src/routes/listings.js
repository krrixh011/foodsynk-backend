const router = require('express').Router();
const { body, query, param } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, allow, requireVerified } = require('../middleware/auth');
const { FOOD_TYPES, UNITS, STATUSES } = require('../models/Listing');
const {
  createListing, myListings, nearby, recommended, getListing, updateListing, cancelListing,
} = require('../controllers/listings');

const futureDate = (value) => {
  if (new Date(value) <= new Date()) throw new Error('Expiry time must be in the future');
  return true;
};

const createRules = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 100 }),
  body('description').optional().trim().isLength({ max: 500 }),
  body('foodType').isIn(FOOD_TYPES).withMessage(`foodType must be one of: ${FOOD_TYPES.join(', ')}`),
  body('quantity.value').isFloat({ gt: 0 }).withMessage('quantity.value must be more than 0'),
  body('quantity.unit').isIn(UNITS).withMessage(`quantity.unit must be one of: ${UNITS.join(', ')}`),
  body('veg').optional().isBoolean().withMessage('veg must be true or false'),
  body('preparedAt').optional().isISO8601().withMessage('preparedAt must be a date like 2026-10-30T14:00:00+05:30'),
  body('expiresAt').isISO8601().withMessage('expiresAt must be a date like 2026-10-30T20:00:00+05:30').bail().custom(futureDate),
  body('pickupAddress').trim().notEmpty().withMessage('Pickup address is required').isLength({ max: 250 }),
  body('lng').isFloat({ min: -180, max: 180 }).withMessage('lng must be -180 to 180'),
  body('lat').isFloat({ min: -90, max: 90 }).withMessage('lat must be -90 to 90'),
];

const updateRules = [
  param('id').isMongoId().withMessage('Invalid listing id'),
  body('title').optional().trim().notEmpty().isLength({ max: 100 }),
  body('description').optional().trim().isLength({ max: 500 }),
  body('foodType').optional().isIn(FOOD_TYPES).withMessage(`foodType must be one of: ${FOOD_TYPES.join(', ')}`),
  body('quantity.value').optional().isFloat({ gt: 0 }).withMessage('quantity.value must be more than 0'),
  body('quantity.unit').optional().isIn(UNITS).withMessage(`quantity.unit must be one of: ${UNITS.join(', ')}`),
  body('veg').optional().isBoolean().withMessage('veg must be true or false'),
  body('preparedAt').optional().isISO8601().withMessage('preparedAt must be a valid date'),
  body('expiresAt').optional().isISO8601().withMessage('expiresAt must be a valid date').bail().custom(futureDate),
  body('pickupAddress').optional().trim().notEmpty().isLength({ max: 250 }),
  body('lng').optional().isFloat({ min: -180, max: 180 }).withMessage('lng must be -180 to 180'),
  body('lat').optional().isFloat({ min: -90, max: 90 }).withMessage('lat must be -90 to 90'),
  body('lat').custom((value, { req }) => {
    if ((value === undefined) !== (req.body?.lng === undefined)) {
      throw new Error('Send both lng and lat, or neither');
    }
    return true;
  }),
];

const nearbyRules = [
  query('lng').isFloat({ min: -180, max: 180 }).withMessage('lng is required (-180 to 180)'),
  query('lat').isFloat({ min: -90, max: 90 }).withMessage('lat is required (-90 to 90)'),
  query('radius').optional().isFloat({ min: 0.1, max: 100 }).withMessage('radius must be 0.1 to 100 (km)'),
  query('foodType').optional().isIn(FOOD_TYPES).withMessage(`foodType must be one of: ${FOOD_TYPES.join(', ')}`),
  query('veg').optional().isIn(['true', 'false']).withMessage('veg must be true or false'),
];

const MINE_STATUSES = [...STATUSES, 'reserved', 'completed', 'closed'];
const recommendedRules = [
  query('lng').optional().isFloat({ min: -180, max: 180 }).withMessage('lng must be -180 to 180'),
  query('lat').optional().isFloat({ min: -90, max: 90 }).withMessage('lat must be -90 to 90'),
  query('lat').custom((value, { req }) => {
    if ((value === undefined) !== (req.query.lng === undefined)) throw new Error('Send both lng and lat, or neither');
    return true;
  }),
  query('radius').optional().isFloat({ min: 0.1, max: 100 }).withMessage('radius must be 0.1 to 100 (km)'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be a whole number from 1 to 50'),
  query('foodType').optional().isIn(FOOD_TYPES).withMessage(`foodType must be one of: ${FOOD_TYPES.join(', ')}`),
  query('veg').optional().isIn(['true', 'false']).withMessage('veg must be true or false'),
];
const mineRules = [
  query('status').optional().isIn(MINE_STATUSES).withMessage(`status must be one of: ${MINE_STATUSES.join(', ')}`),
];

const idRule = [param('id').isMongoId().withMessage('Invalid listing id')];

router.use(protect); // every listing route needs a logged-in user

// NOTE: /mine and /nearby must come BEFORE /:id, or Express treats them as ids
router.post('/', allow('donor'), createRules, validate, createListing);
router.get('/mine', allow('donor'), mineRules, validate, myListings);
router.get('/nearby', allow('ngo', 'admin'), requireVerified, nearbyRules, validate, nearby);
router.get('/recommended', allow('ngo'), requireVerified, recommendedRules, validate, recommended);
router.get('/:id', idRule, validate, getListing);
router.patch('/:id/cancel', allow('donor'), idRule, validate, cancelListing);
router.patch('/:id', allow('donor'), updateRules, validate, updateListing);

module.exports = router;