const express = require('express');
const router = express.Router();

const { authorize } = require('../controllers/authorization.controller');
const { verify } = require('../controllers/gate.controller');
const {
  handleChangePin,
  handleGetVisitors,
  handleCreateVisitor,
  handleUpdateVisitor,
  handleDeleteVisitor,
  handleGetEntries,
  handleDownloadExcel,
  handleGetNotifications,
  handleNotificationHealth
} = require('../controllers/admin.controller');

// 1. Authorization API
router.post('/authorization/authorize', authorize);
router.post('/visitor/authorize', authorize); // compatibility alias

// 2. Gate Verification API
router.post('/gate/verify', verify);

// 3. Admin PIN Change
router.post('/admin/change-pin', handleChangePin);

// 4. Admin Visitor Directory CRUD
router.get('/admin/visitors', handleGetVisitors);
router.post('/admin/visitors', handleCreateVisitor);
router.put('/admin/visitors/:id', handleUpdateVisitor);
router.delete('/admin/visitors/:id', handleDeleteVisitor);

// 5. Admin Entry Records & Excel Download
router.get('/entries', handleGetEntries);
router.get('/entries/download', handleDownloadExcel);
router.get('/admin/entries/download', handleDownloadExcel);

// 6. Notifications for Authorization
router.get('/notifications/health', handleNotificationHealth);
router.get('/notifications/:authorizationId', handleGetNotifications);

// 7. Health API
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'Main Gate Visitor Entry Authorization System',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
