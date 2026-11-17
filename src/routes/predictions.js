const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, allow } = require('../middleware/auth');
const { demand } = require('../controllers/predictions');
const { MENU_TYPES } = require('../services/ai');

const validDate = (value) => {
  if (new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new Error('date must be a real date like 2026-11-09');
  }
  return true;
};

const demandRules = [
  body('attendance').isInt({ min: 0, max: 100000 }).withMessage('attendance must be a whole number from 0 to 100000'),
  body('prevDayConsumption').isInt({ min: 0, max: 100000 }).withMessage('prevDayConsumption must be a whole number from 0 to 100000'),
  body('menuType').isIn(MENU_TYPES).withMessage(`menuType must be one of: ${MENU_TYPES.join(', ')}`),
  body('isHoliday').optional().isIn(['0', '1', 'true', 'false']).withMessage('isHoliday must be 0, 1, true or false'),
  body('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('date must look like 2026-11-09').bail().custom(validDate),
  body('platesProduced').optional().isInt({ min: 0, max: 100000 }).withMessage('platesProduced must be a whole number from 0 to 100000'),
];

router.use(protect); // every prediction route needs a logged-in user

router.post('/demand', allow('donor', 'admin'), demandRules, validate, demand);

module.exports = router;