const express = require('express');
const router = express.Router();
const {
  handleChangePin,
  handleGetAuthorizations,
  handleDownloadExcel,
  handleGetConfig,
  handleSaveSettings,
  handleTestSend
} = require('../controllers/admin.controller');

// PUT /api/admin/authorization-pin - Change administrator PIN
router.put('/authorization-pin', handleChangePin);

// GET /api/admin/authorizations - View all logs
router.get('/authorizations', handleGetAuthorizations);

// GET /api/admin/download-excel - Download generated visitor-entry.xlsx
router.get('/download-excel', handleDownloadExcel);

// GET /api/admin/config - Get current configuration status (no secrets exposed)
router.get('/config', handleGetConfig);

// POST /api/admin/save-settings - Save notification credentials
router.post('/save-settings', handleSaveSettings);

// POST /api/admin/test-send - Test email or SMS
router.post('/test-send', handleTestSend);

module.exports = router;
