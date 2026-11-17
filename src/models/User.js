const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { normalizePhone } = require('../utils/phone');

const ROLES = ['donor', 'ngo', 'delivery', 'admin'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 80 },
    email: { type: String, required: [true, 'Email is required'], unique: true, lowercase: true, trim: true },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // never sent back by default
    },
    role: { type: String, enum: ROLES, required: [true, 'Role is required'] },
    phone: { type: String, trim: true, set: (v) => normalizePhone(v) ?? v },
    organization: { type: String, trim: true, maxlength: 120 },
    address: { type: String, trim: true, maxlength: 250 },
    organization: { type: String, trim: true, maxlength: 120 },
    address: { type: String, trim: true, maxlength: 250 },
    avatar: { type: String, default: '' },
        // NGOs only: how many portions of food per day the NGO can take in
    capacity: { type: Number, min: [1, 'Capacity must be at least 1'], max: [100000, 'Capacity is too large'] },
    verified: { type: Boolean, default: false }, // NGOs need admin approval
    isActive: { type: Boolean, default: true },  // admin can disable accounts
    resetPasswordToken: { type: String, select: false },   // sha256 of the emailed token, never the token itself
    resetPasswordExpires: { type: Date, select: false },
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number], default: undefined }, // [longitude, latitude]
    },
  },
  { timestamps: true }
);

userSchema.index({ location: '2dsphere' }); // for "nearby" searches later

// One account per phone number. Partial, so users with no phone (like the admin) are not affected.
userSchema.index({ phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: 'string' } } });

// Before saving: scramble the password
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Used at login: compare typed password with the stored hash
userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Hide password when sending the user as JSON
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;