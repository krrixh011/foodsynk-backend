const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const errorHandler = require('./middleware/error');
const { origin: corsOrigin } = require('./config/cors');

const app = express();
app.set('trust proxy', 1);

app.use(helmet());                                            // safer HTTP headers
app.use(cors({ origin: corsOrigin }));     // lets your React app call the API
app.use(express.json({ limit: '10kb' }));                     // reads JSON sent by the website
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));  // prints each request in the terminal

app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'Too many attempts, try again later' },
});

app.get('/api/health', (req, res) => res.json({ success: true, status: 'ok' }));

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/listings', require('./routes/listingImages'));
app.use('/api/listings', require('./routes/listings'));
app.use('/api/claims', require('./routes/claims'));
app.use('/api/deliveries', require('./routes/deliveries'));
app.use('/api/deliveries', require('./routes/deliveryRoute'));
app.use('/api/users', require('./routes/users'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/predictions', require('./routes/predictions'));
app.use('/api/impact', require('./routes/impact'));
app.use('/api/ai', require('./routes/ai'));

app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use(errorHandler); // must be last

module.exports = app;