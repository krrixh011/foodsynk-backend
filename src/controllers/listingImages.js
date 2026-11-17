const Listing = require('../models/Listing');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const cloudinary = require('../config/cloudinary');

const MAX_IMAGES = 5;

const uploadBuffer = (buffer) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'foodsynk/listings', resource_type: 'image' },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });

exports.addImages = asyncHandler(async (req, res) => {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    throw new AppError('Image upload is not configured', 503);
  }
  const listing = await Listing.findById(req.params.id);
  if (!listing) throw new AppError('Listing not found', 404);
  if (listing.donor.toString() !== req.user.id) {
    throw new AppError('You can only add images to your own listing', 403);
  }
  if (!req.files?.length) {
    throw new AppError('Attach at least one image in the "images" field', 422);
  }
  if (listing.images.length + req.files.length > MAX_IMAGES) {
    throw new AppError(`A listing can have at most ${MAX_IMAGES} images`, 422);
  }

  let results;
  try {
    results = await Promise.all(req.files.map((f) => uploadBuffer(f.buffer)));
  } catch (err) {
    throw new AppError('Image upload failed, try again', 502);
  }

  listing.images.push(...results.map((r) => r.secure_url));
  await listing.save();
  res.status(201).json({ success: true, data: { images: listing.images } });
});