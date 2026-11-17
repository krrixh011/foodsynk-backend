// Calls the demand-prediction service (Python / FastAPI, owned by the AI/ML teammate).
// If it is slow, down, or answers with something unexpected, we fall back to a simple
// estimate, so a donor's screen never breaks because of the AI service.

const MENU_TYPES = ['regular', 'special', 'light'];

// A free Render service sleeps after ~15 minutes idle and can take about a minute to wake.
// So: if we have not had a successful answer for 12 minutes, allow the long "cold" timeout.
const COLD_AFTER_MS = 12 * 60 * 1000;
let lastSuccessAt = 0;

const fromEnv = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

function timeoutMs() {
  const cold = Date.now() - lastSuccessAt > COLD_AFTER_MS;
  return cold ? fromEnv('AI_COLD_TIMEOUT_MS', 60000) : fromEnv('AI_WARM_TIMEOUT_MS', 10000);
}

function fallbackEstimate(input, reason) {
  return {
    predictedPlates: input.prev_day_consumption,
    source: 'fallback',
    note: `${reason} Estimate = yesterday's consumption.`,
  };
}

// input uses the AI service's own field names:
// { day_of_week, attendance, is_holiday, prev_day_consumption, menu_type }
async function predictDemand(input) {
  const base = process.env.AI_SERVICE_URL;
  if (!base) return fallbackEstimate(input, 'The prediction service is not configured.');

  try {
    const res = await fetch(`${base.replace(/\/+$/, '')}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(timeoutMs()),
    });
    if (!res.ok) throw new Error(`the AI service answered ${res.status}`);

    const data = await res.json();
    const plates = data?.predicted_plates;
    if (!Number.isFinite(plates) || plates < 0 || plates > 1000000) {
      throw new Error('the AI service sent an unexpected reply');
    }

    lastSuccessAt = Date.now();
    return { predictedPlates: Math.round(plates), source: 'model' };
  } catch (err) {
    console.warn('AI prediction failed, using the fallback:', err.name === 'TimeoutError' ? 'timed out' : err.message);
    return fallbackEstimate(input, 'The prediction service is unavailable right now.');
  }
}

module.exports = { predictDemand, MENU_TYPES };