module.exports = (err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message || 'Server error';

  if (err.code === 11000) {
    status = 409;
    message = `${Object.keys(err.keyValue || {})[0] || 'value'} is already in use`;
  } else if (err.name === 'ValidationError') {
    status = 422;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path}`;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON in request body';
  }

  if (status === 500) console.error(err);

  res.status(status).json({
    success: false,
    message: status === 500 && process.env.NODE_ENV === 'production' ? 'Server error' : message,
  });
};