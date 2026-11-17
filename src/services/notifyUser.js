const Notification = require('../models/Notification');
const notify = require('./notify');

async function notifyUser(userId, { type, title, message, data }) {
  const doc = await Notification.create({ user: userId, type, title, message, data });
  try {
    notify.toUser(userId, 'notification:new', doc);
  } catch (err) {
    console.warn('Socket emit failed:', err.message); // the saved notification is still safe
  }
  return doc;
}

module.exports = notifyUser;