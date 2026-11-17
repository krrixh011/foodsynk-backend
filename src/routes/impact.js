
const router = require('express').Router();

const { protect, allow } = require('../middleware/auth');

const {
  getMyImpact,
  getMyMonthly,
} = require('../controllers/donorImpact');

router.use(protect, allow('donor', 'ngo', 'delivery'));

router.get('/me', getMyImpact);
router.get('/me/monthly', getMyMonthly);

module.exports = router;
