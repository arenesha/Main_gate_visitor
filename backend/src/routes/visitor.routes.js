const express = require("express");
const router = express.Router();
const {
  authorizeVisitor,
  verifyGateEntry,
  getGateExcelRecords,
  downloadExcelFile,
  getVisitorHistory
} = require("../controllers/visitor.controller");
const { validateAuthorizeRequest } = require("../middleware/validator");
const { pinAuthLimiter } = require("../middleware/rateLimiter");

// Host: Authorize Entry (Step 1, 2, 3)
router.post("/authorize", pinAuthLimiter, validateAuthorizeRequest, authorizeVisitor);

// Main Gate: Verify Entry (Step 4 & 5)
router.post("/verify", pinAuthLimiter, verifyGateEntry);

// Excel Records & Download (Step 5)
router.get("/records", getGateExcelRecords);
router.get("/download-excel", downloadExcelFile);

// History
router.get("/history", getVisitorHistory);

module.exports = router;
