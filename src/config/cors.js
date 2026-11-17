// Which websites (origins) may call the API from a browser.
// Set CLIENT_URLS to a comma-separated list, for example:
//   CLIENT_URLS=http://localhost:3000,https://foodsynk.vercel.app
// (CLIENT_URL, a single address, still works too.)
// If nothing is set, any website is allowed.
// Used by both the REST API (app.js) and Socket.IO (socket.js).
const origins = [...new Set(
  `${process.env.CLIENT_URLS || ''},${process.env.CLIENT_URL || ''}`
    .split(',')
    .map((url) => url.trim().replace(/\/+$/, '')) // no spaces, no trailing slash
    .filter(Boolean)
)];

module.exports = { origins, origin: origins.length ? origins : '*' };