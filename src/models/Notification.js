const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true, trim: true }, // e.g. listing_claimed, delivery_updated
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, trim: true, maxlength: 500 },
    data: { type: mongoose.Schema.Types.Mixed }, // e.g. { listingId, deliveryId }
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

notificationSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Notification', notificationSchema);