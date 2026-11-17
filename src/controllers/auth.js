const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES || '7d',
  });

const sendToken = (user, status, res) =>
  res.status(status).json({ success: true, token: signToken(user), user });

const { normalizePhone } = require('../utils/phone');

// POST /api/auth/register
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone, organization, address, lng, lat, capacity } = req.body;

  if (await User.exists({ email })) throw new AppError('Email is already registered', 409);
  if (phone && (await User.exists({ phone }))) throw new AppError('Phone number is already registered', 409);

  const data = {
    name, email, password, role, phone, organization, address,
    verified: role !== 'ngo', // NGOs wait for admin approval
  };

  if (lng !== undefined && lat !== undefined) {
    data.location = { type: 'Point', coordinates: [Number(lng), Number(lat)] };
  }
  if (capacity !== undefined) data.capacity = Number(capacity); // NGOs only (checked in the route)

  let user;
  try {
    user = await User.create(data);
  } catch (err) {
    // Two requests racing: the unique index catches what the checks above missed
    if (err.code === 11000) {
      const what = err.keyPattern && err.keyPattern.phone ? 'Phone number' : 'Email';
      throw new AppError(`${what} is already registered`, 409);
    }
    throw err;
  }
  sendToken(user, 201, res);
});

// POST /api/auth/login   body: { identifier, password }  (identifier = email or mobile number)
// The old { email, password } body still works.
exports.login = asyncHandler(async (req, res) => {
  const { identifier, email, password } = req.body;
  const loginId = String(identifier ?? email).trim();

  let query = null;
  if (loginId.includes('@')) {
    query = { email: loginId.toLowerCase() };
  } else {
    const phone = normalizePhone(loginId);
    if (phone) query = { phone };
  }

  const user = query ? await User.findOne(query).select('+password') : null;
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid login details', 401); // same message for every failure on purpose
  }
  if (!user.isActive) throw new AppError('This account has been disabled', 403);

  sendToken(user, 200, res);
});

// GET /api/auth/me
exports.me = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user });
});

const RESET_MINUTES = 30;
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// POST /api/auth/forgot-password   body: { identifier }  (email or mobile number)
exports.forgotPassword = asyncHandler(async (req, res) => {
  const loginId = String(req.body.identifier).trim();

  let query = null;
  if (loginId.includes('@')) {
    query = { email: loginId.toLowerCase() };
  } else {
    const phone = normalizePhone(loginId);
    if (phone) query = { phone };
  }

  const user = query ? await User.findOne(query) : null;

  if (user && user.isActive) {
    const token = crypto.randomBytes(32).toString('hex');
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          resetPasswordToken: hashToken(token),
          resetPasswordExpires: new Date(Date.now() + RESET_MINUTES * 60 * 1000),
        },
      }
    );

    const base = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const link = `${base}/reset-password?token=${token}`;

    // Not awaited on purpose, so the reply takes the same time whether or not the account exists
    sendEmail({
      to: user.email,
      subject: 'Reset your FoodSynk password',
      text: `Use this link to set a new password. It works for ${RESET_MINUTES} minutes and only once:\n\n${link}\n\nIf you did not ask for this, ignore this email. Your password has not changed.`,
      html: `<p>Use this link to set a new password. It works for ${RESET_MINUTES} minutes and only once:</p><p><a href="${link}">Reset my password</a></p><p>If you did not ask for this, ignore this email. Your password has not changed.</p>`,
    }).catch(async (err) => {
      console.error('Reset email failed:', err.message);
      await User.updateOne({ _id: user._id }, { $unset: { resetPasswordToken: '', resetPasswordExpires: '' } });
    });
  }

  res.json({ success: true, message: 'If an account matches, a reset link has been sent to its email address.' });
});

// POST /api/auth/reset-password   body: { token, newPassword }
exports.resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  const user = await User.findOne({
    resetPasswordToken: hashToken(token),
    resetPasswordExpires: { $gt: new Date() },
    isActive: true,
  }).select('+password +resetPasswordToken +resetPasswordExpires');
  if (!user) throw new AppError('This reset link is invalid or has expired', 400);

  user.password = newPassword; // the model hashes it before saving
  user.resetPasswordToken = undefined; // one use only
  user.resetPasswordExpires = undefined;
  await user.save();

  res.json({ success: true, message: 'Password updated. You can log in now.' });
});