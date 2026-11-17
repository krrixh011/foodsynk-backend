const router = require('express').Router();
const { param, query } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, allow, requireVerified } = require('../middleware/auth');
const { STATUSES } = require('../models/Delivery');
const { available, mine, getDelivery, accept, pickup, deliver } = require('../controllers/deliveries');

const idRule = [param('id').isMongoId().withMessage('Invalid delivery id')];
const mineRules = [
  query('status').optional().isIn(STATUSES).withMessage(`status must be one of: ${STATUSES.join(', ')}`),
];

router.use(protect); // every delivery route needs a logged-in user

// NOTE: /available and /mine must come BEFORE /:id, or Express treats them as ids
router.get('/available', allow('delivery'), requireVerified, available);
router.get('/mine', allow('ngo', 'delivery'), mineRules, validate, mine);
router.get('/:id', idRule, validate, getDelivery);
router.patch('/:id/accept', allow('delivery'), requireVerified, idRule, validate, accept);
router.patch('/:id/pickup', allow('delivery'), requireVerified, idRule, validate, pickup);
router.patch('/:id/deliver', allow('delivery'), requireVerified, idRule, validate, deliver);

module.exports = router;