const mongoose = require('mongoose');

const FOOD_TYPES = ['cooked', 'raw', 'packaged', 'bakery', 'produce'];
const UNITS = ['kg', 'portions', 'litres'];
const STATUSES = ['available', 'claimed', 'picked_up', 'delivered', 'expired', 'cancelled'];

const listingSchema = new mongoose.Schema(
  {
    donor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500 },
    foodType: { type: String, enum: FOOD_TYPES, required: [true, 'Food type is required'] },
    quantity: {
      value: { type: Number, required: [true, 'Quantity is required'], min: [0.1, 'Quantity must be more than 0'] },
      unit: { type: String, enum: UNITS, required: [true, 'Unit is required'] },
    },
    veg: { type: Boolean, default: true },
    preparedAt: Date,
    expiresAt: { type: Date, required: [true, 'Expiry time is required'] },
    pickupAddress: { type: String, required: [true, 'Pickup address is required'], trim: true, maxlength: 250 },
    // GeoJSON point: coordinates are [longitude, latitude]
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: {
        type: [Number],
        default: undefined,
        required: [true, 'Pickup location is required'],
        validate: {
          validator: (v) => Array.isArray(v) && v.length === 2,
          message: 'Location must be [longitude, latitude]',
        },
      },
    },
    status: { type: String, enum: STATUSES, default: 'available' },
    claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    images: { type: [String], default: [] },
  },
  { timestamps: true }
);

listingSchema.index({ location: '2dsphere' });          // "nearby" searches
listingSchema.index({ status: 1, expiresAt: 1 });        // find available, unexpired food fast

listingSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Listing', listingSchema);
module.exports.FOOD_TYPES = FOOD_TYPES;
module.exports.UNITS = UNITS;
module.exports.STATUSES = STATUSES;