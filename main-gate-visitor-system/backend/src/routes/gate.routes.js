const express = require('express');
const router = express.Router();
const { handleGateVerify } = require('../controllers/gate.controller');
const { validateGateVerifyRequest } = require('../middleware/validate');
const { gateVerifyLimiter } = require('../middleware/rateLimit');

// POST /api/gate/verify - Main Gate Security Counter Verification
router.post('/verify', gateVerifyLimiter, validateGateVerifyRequest, handleGateVerify);

module.exports = router;
