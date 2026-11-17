const { normalizePhone } = require('../utils/phone');
const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { me } = require('../controllers/auth');
const multer = require('multer');
const AppError = require('../utils/AppError');
const { updateMe, changePassword, updateAvatar } = require('../controllers/users');

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new AppError('Only image files are allowed', 422), false);
    }
  },
});
const updateRules = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty').isLength({ max: 80 }),
    body('phone')
    .optional()
    .trim()
    .custom((value) => {
      if (!normalizePhone(value)) throw new Error('Enter a valid mobile number, like 9876543210 or +919876543210');
      return true;
    })
    .bail()
    .customSanitizer((value) => normalizePhone(value)),
  body('organization').optional().trim().notEmpty().withMessage('Organization cannot be empty').isLength({ max: 120 }),
  body('address').optional().trim().isLength({ max: 250 }).withMessage('Address is too long'),
  body('lng').optional().isFloat({ min: -180, max: 180 }).withMessage('lng must be -180 to 180'),
  body('lat').optional().isFloat({ min: -90, max: 90 }).withMessage('lat must be -90 to 90'),
  body('lat').custom((value, { req }) => {
    if ((value === undefined) !== (req.body?.lng === undefined)) {
      throw new Error('Send both lng and lat, or neither');
    }
    return true;
  }),
    body('capacity')
    .optional()
    .isInt({ min: 1, max: 100000 })
    .withMessage('capacity must be a whole number of portions per day (1 to 100000)')
    .bail()
    .custom((value, { req }) => {
      if (req.user.role !== 'ngo') throw new Error('capacity is only for NGO accounts');
      return true;
    }),
];

const passwordRules = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('New password must be different from the current one');
      }
      return true;
    }),
];

router.use(protect); // every route here needs a logged-in user

router.get('/me', me);
router.patch('/me', updateRules, validate, updateMe);
router.patch('/me/password', passwordRules, validate, changePassword);
router.post('/me/avatar', protect, avatarUpload.single('avatar'), updateAvatar);
module.exports = router; 