const mongoose = require('mongoose');

// pending   = claimed by an NGO, waiting for a driver
// accepted  = a driver took the job
// picked_up = food collected from the donor
// delivered = food handed to the NGO
const STATUSES = ['pending', 'accepted', 'picked_up', 'delivered', 'cancelled'];

const deliverySchema = new mongoose.Schema(
  {
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true, index: true },
    ngo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, // empty until a driver accepts
    status: { type: String, enum: STATUSES, default: 'pending' },
    // A simple history: one entry each time the status changes
    timeline: [
      {
        status: { type: String, enum: STATUSES, required: true },
        at: { type: Date, default: Date.now },
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        _id: false,
      },
    ],
  },
  { timestamps: true }
);

deliverySchema.index({ status: 1, createdAt: -1 }); // drivers browsing open jobs

deliverySchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Delivery', deliverySchema);
module.exports.STATUSES = STATUSES;