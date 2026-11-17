const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/admin/users?role=ngo&verified=false
exports.listUsers = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.verified !== undefined) filter.verified = req.query.verified === 'true';
  const users = await User.find(filter).sort({ createdAt: -1 }).limit(200);
  res.json({ success: true, count: users.length, users });
});

// PATCH /api/admin/users/:id/verify
exports.verifyUser = asyncHandler(async (req, res) => {
  const verified = req.body?.verified === undefined ? true : Boolean(req.body.verified);
  const user = await User.findByIdAndUpdate(req.params.id, { verified }, { new: true });
  if (!user) throw new AppError('User not found', 404);
  res.json({ success: true, user });
});

// PATCH /api/admin/users/:id/active
exports.setActive = asyncHandler(async (req, res) => {
  if (String(req.user._id) === req.params.id) {
    throw new AppError('You cannot change your own active status', 400);
  }
  const user = await User.findByIdAndUpdate(
   req.params.id, { isActive: Boolean(req.body?.isActive) }, { new: true }
  );
  if (!user) throw new AppError('User not found', 404);
  res.json({ success: true, user });
});