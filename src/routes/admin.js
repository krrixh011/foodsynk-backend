const router = require('express').Router();
const { param } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, allow } = require('../middleware/auth');
const { listUsers, verifyUser, setActive } = require('../controllers/admin');
const { getImpact } = require('../controllers/impact');

router.use(protect, allow('admin')); // every route below needs an admin

router.get('/users', listUsers);
router.patch('/users/:id/verify', param('id').isMongoId(), validate, verifyUser);
router.patch('/users/:id/active', param('id').isMongoId(), validate, setActive);
router.get('/impact', getImpact);

module.exports = router;