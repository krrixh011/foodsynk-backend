const { getIO } = require("../socket");

const notify = {
  toUser(userId, event, payload) {
    getIO()?.to(`user:${userId}`).emit(event, payload);
  },
  toRole(role, event, payload) {
    getIO()?.to(`role:${role}`).emit(event, payload);
  },
  toAll(event, payload) {
    getIO()?.emit(event, payload);
  },
};

module.exports = notify;