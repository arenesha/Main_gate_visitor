const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const logger = require('./utils/logger');

const authorizationRoutes = require('./routes/authorization.routes');
const gateRoutes = require('./routes/gate.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();

// Security Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // max 300 requests per 15 min window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api', apiLimiter);

// Request audit logger
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Health check endpoint
const healthRoutes = require('./routes/health.routes');
app.use('/api/health', healthRoutes);

// API Routes
const testRoutes = require('./routes/test.routes');
app.use('/api/test', testRoutes);
app.use('/api/visitor', authorizationRoutes);
app.use('/api/gate', gateRoutes);
app.use('/api/admin', adminRoutes);

// Optional notification route alias for backward compatibility: /api/notification/retry/:id
app.post('/api/notification/retry/:authorizationId', (req, res, next) => {
  const { handleRetryNotification } = require('./controllers/authorization.controller');
  return handleRetryNotification(req, res, next);
});

// 404 Handler for API
app.all('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: 'API endpoint not found' });
});

// Serve Angular frontend if built
const frontendDist = path.resolve(__dirname, '../../frontend/dist/frontend/browser');
const legacyStatic = path.resolve(__dirname, '../../frontend/dist');

if (require('fs').existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else if (require('fs').existsSync(legacyStatic)) {
  app.use(express.static(legacyStatic));
}

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error('Unhandled Server Error:', err.stack || err.message);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

module.exports = app;
