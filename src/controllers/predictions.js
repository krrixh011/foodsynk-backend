const { predictDemand, MENU_TYPES } = require('../services/ai');
const asyncHandler = require('../utils/asyncHandler');

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Monday = 0 ... Sunday = 6, which is what the AI service expects
const weekday = (dateStr) => (new Date(`${dateStr}T00:00:00Z`).getUTCDay() + 6) % 7;

// Tomorrow's date in India, as YYYY-MM-DD
const tomorrowIST = () => new Date(Date.now() + IST_OFFSET_MS + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

// POST /api/predictions/demand   (donor or admin)
exports.demand = asyncHandler(async (req, res) => {
  const { attendance, menuType, prevDayConsumption, isHoliday, date, platesProduced } = req.body;

  const day = date || tomorrowIST();
  const dayOfWeek = weekday(day);
  const holiday = ['1', 'true'].includes(String(isHoliday)) ? 1 : 0;

  const result = await predictDemand({
    day_of_week: dayOfWeek,
    attendance: Number(attendance),
    is_holiday: holiday,
    prev_day_consumption: Number(prevDayConsumption),
    menu_type: menuType,
  });

  const prediction = {
    date: day,
    dayOfWeek,
    predictedPlates: result.predictedPlates,
    source: result.source, // "model" or "fallback"
  };
  if (result.note) prediction.note = result.note;
  // If the kitchen says how many plates it is making, we can estimate the surplus too
  if (platesProduced !== undefined) {
    prediction.expectedSurplus = Math.max(0, Number(platesProduced) - result.predictedPlates);
  }

  res.json({ success: true, prediction });
});

exports.MENU_TYPES = MENU_TYPES;