const router = require('express').Router();
const { param } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, allow } = require('../middleware/auth');
const { uploadImages } = require('../middleware/upload');
const { addImages } = require('../controllers/listingImages');

router.post(
  '/:id/images',
  protect,
  allow('donor'),
  param('id').isMongoId(),
  validate,
  uploadImages,
  addImages
);

module.exports = router;