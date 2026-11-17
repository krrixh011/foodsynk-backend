const router = require('express').Router();
const { param } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { getDeliveryRoute } = require('../controllers/deliveryRoute');

router.get('/:id/route', protect, param('id').isMongoId(), validate, getDeliveryRoute);

module.exports = router;