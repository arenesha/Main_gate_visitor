const bcrypt = require('bcryptjs');
const db = require('../models/db');
const env = require('../config/env');
const logger = require('../utils/logger');
const { sendVisitorAuthorizationNotifications } = require('./notificationService');
const { sendAuthorizationEmail } = require('./emailService');
const { sendAuthorizationSms } = require('./smsService');
const { appendEntryToExcel } = require('./excel.service');

/**
 * Generates unique Authorization ID: AUTH-YYYYMMDD-XXXXXX
 */
function generateAuthId() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const randomSuffix = String(Math.floor(100000 + Math.random() * 900000));
  return `AUTH-${yyyy}${mm}${dd}-${randomSuffix}`;
}

/**
 * Verifies PIN against hashed admin PIN in database
 */
function verifyPin(inputPin) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT value FROM admin_settings WHERE key = 'auth_pin'`, (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(false);
      const isMatch = bcrypt.compareSync(String(inputPin).trim(), row.value);
      resolve(isMatch);
    });
  });
}

/**
 * Creates an authorization, dispatches real notifications, records results
 */
async function createAuthorization({ visitorNames, pin }) {
  // 1. Verify PIN
  const isValidPin = await verifyPin(pin);
  if (!isValidPin) {
    logger.warn('Visitor authorization attempted with INVALID PIN.');
    return {
      success: false,
      authorizationStatus: 'NOT_AUTHORIZED',
      emailSent: false,
      smsSent: false,
      message: 'Invalid authorization PIN.'
    };
  }

  // 2. Generate ID & Expiration
  const authorizationId = generateAuthId();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + env.AUTHORIZATION_EXPIRY_MINUTES * 60 * 1000);
  const namesArray = Array.isArray(visitorNames) ? visitorNames : [visitorNames];
  const namesJson = JSON.stringify(namesArray);

  const authDate = createdAt.toLocaleDateString('en-GB');
  const authTime = createdAt.toLocaleTimeString('en-GB');

  // 3. Dispatch Real Notifications (independent email & SMS)
  const notificationResult = await sendVisitorAuthorizationNotifications({
    visitorNames: namesArray,
    pin: String(pin).trim(),
    date: authDate,
    time: authTime,
    authorizationId
  });

  // Compose exact message per Section 8 specifications
  let statusMessage = 'Visitor entry authorized successfully.';
  if (!notificationResult.emailSent && !notificationResult.smsSent) {
    statusMessage = 'Entry authorized, but email and SMS notifications failed.';
  } else if (!notificationResult.emailSent) {
    statusMessage = 'Entry authorized, but email notification failed.';
  } else if (!notificationResult.smsSent) {
    statusMessage = 'Entry authorized, but SMS notification failed.';
  }

  // 4. Save to Database
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO authorizations (
        authorization_id, visitor_names, authorization_status,
        email_status, email_message_id,
        sms_status, sms_message_id,
        gate_status, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(
      query,
      [
        authorizationId,
        namesJson,
        'AUTHORIZED',
        notificationResult.emailStatus,
        notificationResult.emailMessageId,
        notificationResult.smsStatus,
        notificationResult.smsMessageId,
        'PENDING',
        createdAt.toISOString(),
        expiresAt.toISOString()
      ],
      (err) => {
        if (err) {
          logger.error('Failed to insert authorization record:', err.message);
          return reject(err);
        }

        // Structured audit log (NO secrets logged)
        logger.structuredAuthLog({
          id: authorizationId,
          emailStatus: notificationResult.emailStatus,
          emailMsgId: notificationResult.emailMessageId,
          smsStatus: notificationResult.smsStatus,
          smsMsgId: notificationResult.smsMessageId,
          gateStatus: 'PENDING'
        });

        resolve({
          success: true,
          authorizationStatus: 'AUTHORIZED',
          authorizationId: authorizationId,
          visitorNames: namesArray,
          emailSent: notificationResult.emailSent,
          smsSent: notificationResult.smsSent,
          emailStatus: notificationResult.emailStatus,
          emailError: notificationResult.emailError,
          smsStatus: notificationResult.smsStatus,
          smsError: notificationResult.smsError,
          gateStatus: 'PENDING',
          expiresAt: expiresAt.toISOString(),
          message: statusMessage
        });
      }
    );
  });
}

/**
 * Verifies authorization at Main Gate
 */
function verifyGateEntry({ authorizationId, visitorNames, pin }) {
  return new Promise(async (resolve) => {
    // Check PIN first
    const isPinValid = await verifyPin(pin);
    if (!isPinValid) {
      logger.warn(`Gate verification failed: Invalid PIN for ${authorizationId}`);
      return resolve({
        success: false,
        entryStatus: 'ENTRY NOT AUTHORIZED',
        reason: 'Invalid authorization PIN.'
      });
    }

    // Lookup authorization
    db.get(
      `SELECT * FROM authorizations WHERE authorization_id = ?`,
      [authorizationId],
      async (err, record) => {
        if (err || !record) {
          logger.warn(`Gate verification failed: Authorization ID ${authorizationId} not found.`);
          return resolve({
            success: false,
            entryStatus: 'ENTRY NOT AUTHORIZED',
            reason: 'Authorization record not found.'
          });
        }

        // Check if authorization was rejected or not authorized
        if (record.authorization_status !== 'AUTHORIZED') {
          return resolve({
            success: false,
            entryStatus: 'ENTRY NOT AUTHORIZED',
            reason: 'This entry was not authorized.'
          });
        }

        // Check visitor names if provided in verification request
        if (visitorNames && (Array.isArray(visitorNames) ? visitorNames.length > 0 : String(visitorNames).trim())) {
          let storedNames = [];
          try {
            storedNames = JSON.parse(record.visitor_names);
          } catch (e) {
            storedNames = [record.visitor_names];
          }

          const inputList = (Array.isArray(visitorNames) ? visitorNames : [visitorNames])
            .map(n => String(n).trim().toLowerCase())
            .filter(Boolean);
          const storedList = (Array.isArray(storedNames) ? storedNames : [storedNames])
            .map(n => String(n).trim().toLowerCase())
            .filter(Boolean);

          inputList.sort();
          storedList.sort();

          const namesMatch = inputList.length === storedList.length &&
            inputList.every((name, i) => name === storedList[i]);

          if (!namesMatch) {
            logger.warn(`Gate verification failed: Visitor name mismatch for ${authorizationId}`);
            return resolve({
              success: false,
              entryStatus: 'ENTRY NOT AUTHORIZED',
              reason: 'Visitor name(s) do not match authorization record.'
            });
          }
        }

        // Check duplicate entry (already used)
        if (record.gate_status === 'USED') {
          logger.warn(`Duplicate entry attempted for ${authorizationId} (Already used).`);
          return resolve({
            success: false,
            entryStatus: 'ENTRY NOT AUTHORIZED',
            reason: 'This authorization has already been used. Duplicate entry is not permitted.'
          });
        }

        // Check expiration
        const now = new Date();
        const expiresAt = new Date(record.expires_at);
        if (now > expiresAt) {
          logger.warn(`Gate verification failed: Authorization ${authorizationId} expired.`);
          return resolve({
            success: false,
            entryStatus: 'ENTRY NOT AUTHORIZED',
            reason: `Authorization expired at ${expiresAt.toLocaleTimeString('en-GB')}.`
          });
        }

        // All checks passed -> Mark as USED
        const verifiedAt = new Date().toISOString();
        db.run(
          `UPDATE authorizations SET gate_status = 'USED', verified_at = ?, used_at = ? WHERE authorization_id = ?`,
          [verifiedAt, verifiedAt, authorizationId],
          async (updateErr) => {
            if (updateErr) {
              logger.error(`Failed to update gate_status for ${authorizationId}:`, updateErr.message);
              return resolve({
                success: false,
                entryStatus: 'ENTRY NOT AUTHORIZED',
                reason: 'Database error while marking entry as used.'
              });
            }

            let visitorNames = [];
            try {
              visitorNames = JSON.parse(record.visitor_names);
            } catch (e) {
              visitorNames = [record.visitor_names];
            }

            // Append to Excel automatically
            await appendEntryToExcel({
              visitorNames,
              verifiedAt,
              authorizationId
            });

            logger.info(`ENTRY AUTHORIZED at Main Gate for ${authorizationId}`);
            resolve({
              success: true,
              entryStatus: 'ENTRY AUTHORIZED',
              authorizationId: authorizationId,
              visitorNames: visitorNames,
              verification: 'VALID',
              entryTime: new Date(verifiedAt).toLocaleTimeString('en-GB')
            });
          }
        );
      }
    );
  });
}

/**
 * Retries failed email or SMS notifications
 */
function retryNotification(authorizationId) {
  return new Promise((resolve) => {
    db.get(
      `SELECT * FROM authorizations WHERE authorization_id = ?`,
      [authorizationId],
      async (err, record) => {
        if (err || !record) {
          return resolve({ success: false, message: 'Authorization not found.' });
        }

        let visitorNames = [];
        try {
          visitorNames = JSON.parse(record.visitor_names);
        } catch (e) {
          visitorNames = [record.visitor_names];
        }

        const updates = {};
        let emailRes = { status: record.email_status, messageId: record.email_message_id };
        let smsRes = { status: record.sms_status, messageId: record.sms_message_id };

        if (record.email_status !== 'SENT') {
          emailRes = await sendAuthorizationEmail({
            authorizationId,
            visitorNames,
            createdAt: record.created_at
          });
          updates.email_status = emailRes.status;
          updates.email_message_id = emailRes.messageId || null;
        }

        if (record.sms_status !== 'SENT') {
          smsRes = await sendAuthorizationSms({
            authorizationId,
            visitorNames
          });
          updates.sms_status = smsRes.status;
          updates.sms_message_id = smsRes.messageId || null;
        }

        const retryCount = (record.retry_count || 0) + 1;
        const nowIso = new Date().toISOString();

        db.run(
          `UPDATE authorizations SET email_status = ?, email_message_id = ?, sms_status = ?, sms_message_id = ?, retry_count = ?, last_retry_at = ? WHERE authorization_id = ?`,
          [
            updates.email_status || record.email_status,
            updates.email_message_id !== undefined ? updates.email_message_id : record.email_message_id,
            updates.sms_status || record.sms_status,
            updates.sms_message_id !== undefined ? updates.sms_message_id : record.sms_message_id,
            retryCount,
            nowIso,
            authorizationId
          ],
          (updateErr) => {
            if (updateErr) {
              return resolve({ success: false, message: updateErr.message });
            }
            resolve({
              success: true,
              authorizationId,
              emailStatus: updates.email_status || record.email_status,
              smsStatus: updates.sms_status || record.sms_status,
              retryCount
            });
          }
        );
      }
    );
  });
}

module.exports = {
  createAuthorization,
  verifyGateEntry,
  retryNotification
};
