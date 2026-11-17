const { origin: corsOrigin } = require('./config/cors');
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let io;

function initSocket(httpServer) {
  io = new Server(httpServer, { cors: { origin: corsOrigin } });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const user = jwt.verify(token, process.env.JWT_SECRET);
       socket.userId = user.id;
      socket.role = user.role; // the token carries { id, role }
      next();
    } catch (e) {
      next(new Error("unauthorized"));
    }
  });

    io.on("connection", (socket) => {
    socket.join(`user:${socket.userId}`);
    socket.join(`role:${socket.role}`);
    socket.emit("connected:ok", { userId: socket.userId, role: socket.role });
  });
  return io;
}

const getIO = () => io;
module.exports = { initSocket, getIO };