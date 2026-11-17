require('dotenv').config();
const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const { initSocket } = require('./socket');
const { startExpiryJob } = require('./jobs/expireListings');

const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set in .env');
  process.exit(1);
}

connectDB()
  .then(() => {
    startExpiryJob();
    const server = http.createServer(app);
    initSocket(server);
    server.listen(PORT, () => console.log(`Foodsynk API running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Startup failed:', err.message);
    process.exit(1);
  });