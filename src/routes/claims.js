const router = require('express').Router();
const { param } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, allow, requireVerified } = require('../middleware/auth');
const { claimListing } = require('../controllers/claims');

router.use(protect); // every claim route needs a logged-in user

router.post(
  '/:listingId',
  allow('ngo'),
  requireVerified,
  param('listingId').isMongoId().withMessage('Invalid listing id'),
  validate,
  claimListing
);

module.exports = router;