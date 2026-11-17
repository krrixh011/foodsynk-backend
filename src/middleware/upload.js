const multer = require('multer');
const AppError = require('../utils/AppError');

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

const upload = multer({
  storage: multer.memoryStorage(),           // keep the file in memory, no disk
  limits: { fileSize: 5 * 1024 * 1024, files: 5 }, // 5 MB each, max 5 files
  fileFilter: (req, file, cb) => {
    if (!ALLOWED.includes(file.mimetype)) {
      return cb(new AppError('Only JPEG, PNG or WebP images are allowed', 422));
    }
    cb(null, true);
  },
});

exports.uploadImages = (req, res, next) => {
  upload.array('images', 5)(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const msg =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Each image must be 5 MB or smaller'
          : 'Send at most 5 images in the "images" field';
      return next(new AppError(msg, 422));
    }
    next(err);
  });
};