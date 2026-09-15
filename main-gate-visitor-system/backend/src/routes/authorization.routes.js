const express = require('express');
const router = express.Router();
const { handleAuthorize, handleGetAuthorization, handleRetryNotification } = require('../controllers/authorization.controller');
const { validateAuthorizeRequest } = require('../middleware/validate');
const { authorizeLimiter } = require('../middleware/rateLimit');

// POST /api/visitor/authorize - Main Visitor Authorization
router.post('/authorize', authorizeLimiter, validateAuthorizeRequest, handleAuthorize);

// GET /api/visitor/authorization/:authorizationId - Check Authorization status
router.get('/authorization/:authorizationId', handleGetAuthorization);

// POST /api/notification/retry/:authorizationId - Safe Notification Retry
router.post('/notification/retry/:authorizationId', handleRetryNotification);

module.exports = router;
