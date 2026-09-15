const express = require("express");
const router = express.Router();
const { changePin, getAdminStatus } = require("../controllers/admin.controller");
const { validateChangePinRequest } = require("../middleware/validator");
const { pinAuthLimiter } = require("../middleware/rateLimiter");

// POST /api/admin/change-pin
router.post("/change-pin", pinAuthLimiter, validateChangePinRequest, changePin);

// GET /api/admin/status
router.get("/status", getAdminStatus);

module.exports = router;
