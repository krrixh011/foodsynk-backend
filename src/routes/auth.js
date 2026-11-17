const rateLimit = require('express-rate-limit');
const { register, login, me, forgotPassword, resetPassword } = require('../controllers/auth');
const { normalizePhone } = require('../utils/phone');
const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');

const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 80 }),
  body('email').trim().toLowerCase().isEmail().withMessage('Enter a valid email'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('role').isIn(['donor', 'ngo', 'delivery']).withMessage('Role must be donor, ngo or delivery'),
  body('organization').if(body('role').equals('ngo')).trim().notEmpty()
    .withMessage('Organization name is required for NGOs'),
    body('phone')
    .optional()
    .trim()
    .custom((value) => {
      if (!normalizePhone(value)) throw new Error('Enter a valid mobile number, like 9876543210 or +919876543210');
      return true;
    })
    .bail()
    .customSanitizer((value) => normalizePhone(value)),
  body('lng').optional().isFloat({ min: -180, max: 180 }).withMessage('lng must be -180 to 180'),
  body('lat').optional().isFloat({ min: -90, max: 90 }).withMessage('lat must be -90 to 90'),
  body('lat').custom((value, { req }) => {
    if ((value === undefined) !== (req.body.lng === undefined)) {
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
      if (req.body.role !== 'ngo') throw new Error('capacity is only for NGO accounts');
      return true;
    }),
];

const loginRules = [
  body('identifier').custom((value, { req }) => {
    const id = value ?? req.body.email;
    if (typeof id !== 'string' || !id.trim()) throw new Error('Enter your email or mobile number');
    return true;
  }),
  body('password').isString().withMessage('Password is required').bail().notEmpty().withMessage('Password is required'),
];

const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5, // 5 reset requests per 15 minutes per address
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many reset requests. Try again in 15 minutes.' },
});

const forgotRules = [
  body('identifier').isString().withMessage('Enter your email or mobile number').bail()
    .trim().notEmpty().withMessage('Enter your email or mobile number'),
];

const resetRules = [
  body('token').isString().notEmpty().withMessage('Reset token is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
];

router.post('/register', registerRules, validate, register);
router.post('/login', loginRules, validate, login);
router.get('/me', protect, me);
router.post('/forgot-password', forgotLimiter, forgotRules, validate, forgotPassword);
router.post('/reset-password', resetRules, validate, resetPassword);

module.exports = router;