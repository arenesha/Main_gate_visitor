const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const apiRoutes = require('./routes/api.routes');
const logger = require('./utils/logger');

const app = express();

// Security Headers
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

// CORS
const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:4200';
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server) or matching origin
      if (!origin || origin === allowedOrigin || origin === 'http://localhost:8003') {
        callback(null, true);
      } else {
        callback(null, true); // Permissive for local dev
      }
    },
    credentials: true
  })
);

// Body Parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  }
});
app.use('/api/', limiter);

// Mount API Routes
app.use('/api', apiRoutes);

// Static frontend serving
const frontendPath = path.resolve(__dirname, '../../frontend');
const publicPath = path.resolve(__dirname, '../../public');

app.use(express.static(frontendPath));
app.use(express.static(publicPath));

// Frontend Clean URLs / SPA Fallback
const serveFrontend = (req, res) => {
  const angularDist = path.resolve(__dirname, '../../frontend/index.html');
  const publicIndex = path.resolve(__dirname, '../../public/index.html');
  if (require('fs').existsSync(angularDist)) {
    res.sendFile(angularDist);
  } else {
    res.sendFile(publicIndex);
  }
};

app.get('/', serveFrontend);
app.get('/authorization', serveFrontend);
app.get('/gate-verification', serveFrontend);
app.get('/admin/pin', serveFrontend);
app.get('/admin/visitors', serveFrontend);
app.get('/admin/entries', serveFrontend);
app.get('/gate', serveFrontend);
app.get('/admin', serveFrontend);

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error('Unhandled Application Error:', err);
  res.status(500).json({
    success: false,
    message: 'An internal server error occurred.'
  });
});

module.exports = app;
