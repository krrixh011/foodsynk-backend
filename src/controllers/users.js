const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const cloudinary = require('../config/cloudinary');

// Only these fields can be changed through the profile endpoint.
// role, verified, isActive, email and password are NOT in this list.
const EDITABLE = ['name', 'phone', 'organization', 'address'];

// PATCH /api/users/me
exports.updateMe = asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  const updates = {};

  for (const field of EDITABLE) {
    if (body[field] !== undefined) updates[field] = body[field];
  }
  if (body.lng !== undefined && body.lat !== undefined) {
    updates.location = { type: 'Point', coordinates: [Number(body.lng), Number(body.lat)] };
  }
    if (body.capacity !== undefined) updates.capacity = Number(body.capacity); // NGOs only (checked in the route)
    
  if (Object.keys(updates).length === 0) {
    throw new AppError('Send at least one field to update', 400);
  }

    if (updates.phone !== undefined) {
    const taken = await User.exists({ phone: updates.phone, _id: { $ne: req.user._id } });
    if (taken) throw new AppError('Phone number is already registered', 409);
  }

  let user;
  try {
    user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );
  } catch (err) {
    // Two requests racing: the unique index catches what the check above missed
    if (err.code === 11000) throw new AppError('Phone number is already registered', 409);
    throw err;
  }
  res.json({ success: true, user });
});

// PATCH /api/users/me/password
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(currentPassword))) {
    throw new AppError('Current password is incorrect', 400);
  }

  user.password = newPassword; // the model hashes it before saving
  await user.save();
  res.json({ success: true, message: 'Password changed' });
});
const uploadAvatarBuffer = (buffer) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'foodsynk/avatars',
        resource_type: 'image',
        transformation: [{ width: 300, height: 300, crop: 'fill', gravity: 'face' }],
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });

// POST /api/users/me/avatar
exports.updateAvatar = asyncHandler(async (req, res) => {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    throw new AppError('Image upload is not configured', 503);
  }
  if (!req.file) {
    throw new AppError('Attach an image in the "avatar" field', 422);
  }

  let result;
  try {
    result = await uploadAvatarBuffer(req.file.buffer);
  } catch (err) {
    throw new AppError('Avatar upload failed', 502);
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { avatar: result.secure_url },
    { new: true }
  );

  res.status(200).json({
    avatar: user.avatar,
    user,
  });
});