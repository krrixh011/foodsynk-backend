require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');

(async () => {
  try {
    await connectDB();
    const email = (process.env.ADMIN_EMAIL || '').toLowerCase();
    if (!email || !process.env.ADMIN_PASSWORD) {
      throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env first');
    }
    if (await User.exists({ email })) {
      console.log('Admin already exists:', email);
    } else {
      await User.create({
        name: process.env.ADMIN_NAME || 'Foodsynk Admin',
        email,
        password: process.env.ADMIN_PASSWORD,
        role: 'admin',
        verified: true,
      });
      console.log('Admin created:', email);
    }
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();