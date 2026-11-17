const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// Guard 1: are you logged in?
exports.protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError('Please log in to continue', 401);
  }

  let payload;
  try {
    payload = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
  } catch {
    throw new AppError('Invalid or expired token', 401);
  }

  const user = await User.findById(payload.id);
  if (!user || !user.isActive) {
    throw new AppError('This account no longer exists or is disabled', 401);
  }

  req.user = user; // now every later function can use req.user
  next();
});

// Guard 2: do you have the right role?
exports.allow = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new AppError('You do not have permission to do this', 403));
  }
  next();
};

// Guard 3: has the admin approved you?
exports.requireVerified = (req, res, next) => {
  if (!req.user.verified) {
    return next(new AppError('Your account is pending admin verification', 403));
  }
  next();
};