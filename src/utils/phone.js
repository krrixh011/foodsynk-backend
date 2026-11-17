// Turns "98765 43210", "+91-98765-43210", "09876543210" into "+919876543210".
// Other international numbers (+44..., +1...) are kept as +digits.
// Returns null if the input is not a valid number.
function normalizePhone(input) {
  if (typeof input !== 'string') return null;
  let s = input.trim().replace(/[\s\-().]/g, '');
  if (s.startsWith('00')) s = '+' + s.slice(2);

  if (s.startsWith('+')) {
    const digits = s.slice(1);
    if (!/^\d{8,15}$/.test(digits)) return null;
    if (digits.startsWith('91')) return /^91[6-9]\d{9}$/.test(digits) ? '+' + digits : null;
    return '+' + digits;
  }

  if (!/^\d+$/.test(s)) return null;
  if (/^[6-9]\d{9}$/.test(s)) return '+91' + s;        // 9876543210
  if (/^0[6-9]\d{9}$/.test(s)) return '+91' + s.slice(1); // 09876543210
  if (/^91[6-9]\d{9}$/.test(s)) return '+' + s;        // 919876543210
  return null;
}

module.exports = { normalizePhone };