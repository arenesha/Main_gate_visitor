const bcrypt = require("bcryptjs");
const { query } = require("../database/db");
const { dispatchVisitorAuthorizationNotifications } = require("../services/notificationService");
const { appendExcelEntry, getExcelEntries, getExcelFilePath } = require("../services/excel.service");
const logger = require("../utils/logger");

function formatDate(dateObj) {
  return dateObj.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function formatTime(dateObj) {
  return dateObj.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

/**
 * STEP 1, 2, 3: Host Authorizes Visitor Entry
 * POST /api/visitor/authorize
 * Body: { visitorNames: ["Priti"], pin: "1234" }
 */
async function authorizeVisitor(req, res) {
  try {
    const visitorNames = req.cleanedVisitorNames;
    const enteredPin = req.cleanedPin;

    // 1. Retrieve stored PIN hash from database
    const pinSetting = await query.get("SELECT value FROM app_settings WHERE key = 'pin_hash'");
    if (!pinSetting || !pinSetting.value) {
      return res.status(500).json({
        success: false,
        authorizationStatus: "NOT_AUTHORIZED",
        emailSent: false,
        smsSent: false,
        message: "Authorization system configuration error."
      });
    }

    // 2. Verify PIN using bcrypt
    const isPinValid = await bcrypt.compare(enteredPin, pinSetting.value);
    if (!isPinValid) {
      logger.warn(`[AUTHORIZATION DENIED] Invalid PIN attempt for visitors: ${visitorNames.join(", ")}`);
      return res.status(401).json({
        success: false,
        authorizationStatus: "NOT_AUTHORIZED",
        emailSent: false,
        smsSent: false,
        message: "Invalid authorization PIN."
      });
    }

    // 3. Current timestamp & formatting
    const now = new Date();
    const isoTimestamp = now.toISOString();
    const formattedDate = formatDate(now);
    const formattedTime = formatTime(now);

    logger.info(`[AUTHORIZATION APPROVED] PIN verified for visitor(s): ${visitorNames.join(", ")}`);

    // 4. Retrieve optional Security Email / Phone overrides from DB if configured by Admin
    const dbSecEmail = await query.get("SELECT value FROM app_settings WHERE key = 'security_email'");
    const dbSecPhone = await query.get("SELECT value FROM app_settings WHERE key = 'security_phone'");

    const secEmail = dbSecEmail ? dbSecEmail.value : null;
    const secPhone = dbSecPhone ? dbSecPhone.value : null;

    // 5. Trigger REAL notifications via Email Service (Nodemailer) and SMS Service (Twilio)
    const notifResult = await dispatchVisitorAuthorizationNotifications(
      visitorNames,
      enteredPin,
      formattedDate,
      formattedTime,
      secEmail,
      secPhone
    );

    // 6. Save visitor entry record to database
    const insertResult = await query.run(
      `INSERT INTO visitor_entries (visitorNames, authorizationStatus, authorizedAt, emailSent, smsSent, createdAt)
       VALUES (?, 'AUTHORIZED', ?, ?, ?, ?)`,
      [
        JSON.stringify(visitorNames),
        isoTimestamp,
        notifResult.emailSent ? 1 : 0,
        notifResult.smsSent ? 1 : 0,
        isoTimestamp
      ]
    );

    const entryId = insertResult.lastID;

    // 7. Return actual results of authorization and notifications
    return res.status(200).json({
      success: true,
      authorizationStatus: "AUTHORIZED",
      emailSent: notifResult.emailSent,
      smsSent: notifResult.smsSent,
      message: "Visitor entry authorized successfully.",
      id: entryId,
      visitorNames,
      date: formattedDate,
      time: formattedTime,
      emailError: notifResult.emailError,
      smsError: notifResult.smsError
    });
  } catch (error) {
    logger.error("Error in authorizeVisitor:", error);
    return res.status(500).json({
      success: false,
      authorizationStatus: "NOT_AUTHORIZED",
      emailSent: false,
      smsSent: false,
      message: "An internal server error occurred during authorization."
    });
  }
}

/**
 * STEP 4 & 5: Main Gate Security Verification & Automatic Excel Logging
 * POST /api/gate/verify
 */
async function verifyGateEntry(req, res) {
  try {
    let { visitorNames, pin } = req.body;

    if (typeof visitorNames === "string") {
      visitorNames = [visitorNames];
    }

    const cleanedNames = (visitorNames || [])
      .map((n) => (typeof n === "string" ? n.trim() : ""))
      .filter((n) => n.length > 0);

    const enteredPin = (pin || "").trim();
    const now = new Date();
    const entryDate = formatDate(now);
    const entryTime = formatTime(now);

    if (cleanedNames.length === 0 || !enteredPin) {
      return res.status(400).json({
        success: false,
        entryStatus: "ENTRY NOT AUTHORIZED",
        message: "Visitor Name(s) and Authorization PIN are required for gate verification."
      });
    }

    // 1. Verify PIN against stored PIN hash
    const pinSetting = await query.get("SELECT value FROM app_settings WHERE key = 'pin_hash'");
    const isPinMatch = pinSetting ? await bcrypt.compare(enteredPin, pinSetting.value) : false;

    // 2. Check authorized records
    let isVisitorAuthorized = false;
    if (isPinMatch) {
      const recentAuthorizations = await query.all(
        "SELECT * FROM visitor_entries WHERE authorizationStatus = 'AUTHORIZED' ORDER BY id DESC LIMIT 50"
      );

      const targetSet = new Set(cleanedNames.map((n) => n.toLowerCase()));
      for (const row of recentAuthorizations) {
        let authNames = [];
        try {
          authNames = JSON.parse(row.visitorNames);
        } catch (e) {
          authNames = [row.visitorNames];
        }
        const rowSet = new Set(authNames.map((n) => String(n).trim().toLowerCase()));
        let hasOverlap = false;
        for (const name of targetSet) {
          if (rowSet.has(name)) {
            hasOverlap = true;
            break;
          }
        }
        if (hasOverlap) {
          isVisitorAuthorized = true;
          break;
        }
      }
    }

    const isAuthorized = isPinMatch && isVisitorAuthorized;
    const entryStatus = isAuthorized ? "ENTRY AUTHORIZED" : "ENTRY NOT AUTHORIZED";
    const authStatus = isAuthorized ? "AUTHORIZED" : "NOT AUTHORIZED";

    // 3. Step 5: Automatically save entry to Excel file
    try {
      await appendExcelEntry({
        visitorNames: cleanedNames,
        entryDate,
        entryTime,
        authorizationStatus: authStatus,
        entryStatus
      });
    } catch (excelErr) {
      logger.error("Failed to write to Excel file:", excelErr);
    }

    if (isAuthorized) {
      return res.status(200).json({
        success: true,
        entryStatus: "ENTRY AUTHORIZED",
        authorizationStatus: "AUTHORIZED",
        message: "Visitor entry authorized. Access granted.",
        visitorNames: cleanedNames,
        entryDate,
        entryTime
      });
    } else {
      return res.status(200).json({
        success: false,
        entryStatus: "ENTRY NOT AUTHORIZED",
        authorizationStatus: "NOT AUTHORIZED",
        message: "Verification failed. Invalid PIN or unauthorized visitor.",
        visitorNames: cleanedNames,
        entryDate,
        entryTime
      });
    }
  } catch (error) {
    logger.error("Error in verifyGateEntry:", error);
    return res.status(500).json({
      success: false,
      entryStatus: "ENTRY NOT AUTHORIZED",
      message: "An internal server error occurred during gate verification."
    });
  }
}

/**
 * GET /api/gate/records
 */
async function getGateExcelRecords(req, res) {
  try {
    const records = await getExcelEntries();
    return res.status(200).json({
      success: true,
      records
    });
  } catch (error) {
    logger.error("Error reading Excel records:", error);
    return res.status(500).json({
      success: false,
      records: []
    });
  }
}

/**
 * GET /api/gate/download-excel
 */
function downloadExcelFile(req, res) {
  const filePath = getExcelFilePath();
  res.download(filePath, "visitor_entries.xlsx", (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ error: "Excel log file not created yet." });
    }
  });
}

/**
 * GET /api/visitor/history
 */
async function getVisitorHistory(req, res) {
  try {
    const rows = await query.all("SELECT * FROM visitor_entries ORDER BY id DESC LIMIT 100");
    const formattedRows = rows.map((r) => {
      let parsedNames = [];
      try {
        parsedNames = JSON.parse(r.visitorNames);
      } catch (e) {
        parsedNames = [r.visitorNames];
      }
      return {
        id: r.id,
        visitorNames: parsedNames,
        authorizationStatus: r.authorizationStatus,
        authorizedAt: r.authorizedAt,
        emailSent: Boolean(r.emailSent),
        smsSent: Boolean(r.smsSent),
        createdAt: r.createdAt
      };
    });

    return res.status(200).json({
      success: true,
      entries: formattedRows
    });
  } catch (error) {
    logger.error("Error in getVisitorHistory:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve visitor history."
    });
  }
}

module.exports = {
  authorizeVisitor,
  verifyGateEntry,
  getGateExcelRecords,
  downloadExcelFile,
  getVisitorHistory
};
