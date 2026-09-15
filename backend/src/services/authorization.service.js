const crypto = require('crypto');
const { query } = require('../database/db');
const { verifyPin } = require('./admin.service');
const { getVisitorsByNames } = require('./visitor.service');
const { dispatchAuthorizationAlerts } = require('./notification.service');
const { appendEntryToExcel } = require('./excel.service');
const logger = require('../utils/logger');

function generateDynamicAuthId() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const datePart = `${yyyy}${mm}${dd}`;
  const randomPart = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `MG-${datePart}-${randomPart}`;
}

/**
 * STEP 1 + 2 + 3: Authorize visitor names with bcrypt PIN
 */
async function createAuthorization({ visitorNames, pin }) {
  // 1. Validate visitor names
  let rawNames = [];
  if (Array.isArray(visitorNames)) {
    rawNames = visitorNames;
  } else if (typeof visitorNames === 'string') {
    rawNames = visitorNames.split(/\r?\n|,/).map((n) => n.trim());
  }

  // Deduplicate and trim
  const cleanNames = [];
  const seen = new Set();
  for (const n of rawNames) {
    if (typeof n === 'string' && n.trim()) {
      const trimmed = n.trim();
      const lower = trimmed.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        cleanNames.push(trimmed);
      }
    }
  }

  if (cleanNames.length === 0) {
    return {
      success: false,
      authorized: false,
      authorizationStatus: 'NOT_AUTHORIZED',
      message: 'Please enter at least one valid visitor name.'
    };
  }

  // 2. Validate PIN via bcrypt
  const isPinValid = await verifyPin(pin);
  if (!isPinValid) {
    logger.warn('Visitor authorization rejected: Invalid PIN');
    return {
      success: false,
      authorized: false,
      authorizationStatus: 'NOT_AUTHORIZED',
      message: 'Invalid authorization PIN.'
    };
  }

  // 3. Generate dynamic unique Authorization ID
  const authorizationId = generateDynamicAuthId();

  // 4. Lookup visitor records from SQLite
  const visitorContacts = await getVisitorsByNames(cleanNames);

  // 5. Calculate timestamps (24 hours expiration)
  const now = new Date();
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nowIso = now.toISOString();
  const expiresIso = expires.toISOString();

  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // 6. Save to authorizations table
  await query.run(
    `INSERT INTO authorizations (authorizationId, visitorNames, authorizationStatus, createdAt, expiresAt, used, entryStatus)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [authorizationId, JSON.stringify(cleanNames), 'AUTHORIZED', nowIso, expiresIso, 0, 'PENDING']
  );

  logger.info(`[AUTHORIZATION CREATED] ID: ${authorizationId} | Visitors: ${cleanNames.join(', ')}`);

  // 7. Dispatch real notifications (Email + SMS)
  const notifAlerts = await dispatchAuthorizationAlerts({
    authorizationId,
    visitorNames: cleanNames,
    authorizationStatus: 'AUTHORIZED',
    authorizationDate: dateStr,
    authorizationTime: timeStr,
    gateVerificationStatus: 'PENDING VERIFICATION',
    visitorContacts
  });

  const emailSent = notifAlerts.email.status === 'sent';
  const smsSent = notifAlerts.sms.status === 'sent';

  return {
    success: true,
    authorized: true,
    authorizationStatus: 'AUTHORIZED',
    authorizationId,
    visitorNames: cleanNames,
    date: dateStr,
    time: timeStr,
    gateStatus: 'PENDING VERIFICATION',
    email: notifAlerts.email,
    sms: notifAlerts.sms,
    emailSent,
    smsSent,
    message: emailSent
      ? 'Visitor authorized and security email sent successfully.'
      : 'Visitor authorized, but security email could not be sent.'
  };
}

/**
 * STEP 4 + 5: Main Gate Verification with single-use enforcement & Excel logging
 */
async function verifyGateEntry({ authorizationId, pin }) {
  if (!authorizationId || typeof authorizationId !== 'string' || !authorizationId.trim()) {
    return {
      success: false,
      entryStatus: 'ENTRY NOT AUTHORIZED',
      message: 'Authorization ID is required.'
    };
  }

  const cleanAuthId = authorizationId.trim();

  // 1. Fetch authorization from database
  const record = await query.get(
    `SELECT * FROM authorizations WHERE authorizationId = ?`,
    [cleanAuthId]
  );

  if (!record) {
    return {
      success: false,
      entryStatus: 'ENTRY NOT AUTHORIZED',
      message: 'Authorization ID does not exist.'
    };
  }

  // 2. Check if already used
  if (record.used === 1 || record.entryStatus === 'ENTERED') {
    return {
      success: false,
      entryStatus: 'ENTRY NOT AUTHORIZED',
      message: 'Authorization already used. Duplicate entry denied.'
    };
  }

  // 3. Check expiration
  const now = new Date();
  if (new Date(record.expiresAt) < now) {
    return {
      success: false,
      entryStatus: 'ENTRY NOT AUTHORIZED',
      message: 'Authorization has expired.'
    };
  }

  // 4. Verify PIN with bcrypt
  const isPinValid = await verifyPin(pin);
  if (!isPinValid) {
    return {
      success: false,
      entryStatus: 'ENTRY NOT AUTHORIZED',
      message: 'Invalid authorization PIN.'
    };
  }

  // 5. Ensure authorizationStatus is AUTHORIZED
  if (record.authorizationStatus !== 'AUTHORIZED') {
    return {
      success: false,
      entryStatus: 'ENTRY NOT AUTHORIZED',
      message: 'Visitor authorization status is not AUTHORIZED.'
    };
  }

  // Parse names
  let visitorNames = [];
  try {
    visitorNames = JSON.parse(record.visitorNames);
  } catch (e) {
    visitorNames = [record.visitorNames];
  }

  const nowIso = now.toISOString();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // 6. Mark used and update status in authorizations table
  await query.run(
    `UPDATE authorizations SET used = 1, entryStatus = 'ENTERED', verifiedAt = ? WHERE authorizationId = ?`,
    [nowIso, cleanAuthId]
  );

  // 7. Insert into entries database table
  await query.run(
    `INSERT INTO entries (authorizationId, visitorNames, entryDate, entryTime, authorizationStatus, entryStatus, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [cleanAuthId, JSON.stringify(visitorNames), dateStr, timeStr, 'AUTHORIZED', 'ENTERED', nowIso]
  );

  // 8. Append real row to Excel file
  try {
    await appendEntryToExcel({
      visitorNames,
      entryDate: dateStr,
      entryTime: timeStr,
      authorizationStatus: 'AUTHORIZED',
      entryStatus: 'ENTERED'
    });
  } catch (excelErr) {
    logger.error('Failed to append entry to Excel:', excelErr.message);
  }

  logger.info(`[GATE VERIFIED] ENTRY AUTHORIZED for ${visitorNames.join(', ')} (ID: ${cleanAuthId})`);

  return {
    success: true,
    entryStatus: 'ENTRY AUTHORIZED',
    authorizationStatus: 'AUTHORIZED',
    authorizationId: cleanAuthId,
    visitorNames,
    entryDate: dateStr,
    entryTime: timeStr,
    message: 'Visitor entry authorized at gate.'
  };
}

module.exports = {
  createAuthorization,
  verifyGateEntry,
  generateDynamicAuthId
};
