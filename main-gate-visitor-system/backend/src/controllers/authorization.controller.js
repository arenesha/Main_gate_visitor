const db = require('../models/db');
const { createAuthorization, retryNotification } = require('../services/authorization.service');
const logger = require('../utils/logger');

async function handleAuthorize(req, res) {
  try {
    const { visitorNames, pin } = req.body;
    const result = await createAuthorization({ visitorNames, pin });

    if (!result.success) {
      return res.status(401).json({
        success: false,
        authorizationStatus: 'NOT_AUTHORIZED',
        emailSent: false,
        smsSent: false,
        message: result.message || 'Invalid authorization PIN.'
      });
    }

    return res.status(200).json({
      success: true,
      authorizationStatus: 'AUTHORIZED',
      authorizationId: result.authorizationId,
      visitorNames: result.visitorNames,
      emailSent: Boolean(result.emailSent),
      smsSent: Boolean(result.smsSent),
      emailStatus: result.emailStatus,
      emailError: result.emailError,
      smsStatus: result.smsStatus,
      smsError: result.smsError,
      gateStatus: result.gateStatus,
      expiresAt: result.expiresAt,
      message: result.message
    });
  } catch (err) {
    logger.error('Error in handleAuthorize:', err.message);
    return res.status(500).json({
      success: false,
      authorizationStatus: 'NOT_AUTHORIZED',
      emailSent: false,
      smsSent: false,
      message: 'Internal server error during authorization.'
    });
  }
}

function handleGetAuthorization(req, res) {
  const { authorizationId } = req.params;
  db.get(`SELECT * FROM authorizations WHERE authorization_id = ?`, [authorizationId], (err, row) => {
    if (err) {
      logger.error('Error fetching authorization:', err.message);
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    if (!row) {
      return res.status(404).json({ success: false, message: 'Authorization not found' });
    }

    let visitorNames = [];
    try {
      visitorNames = JSON.parse(row.visitor_names);
    } catch (e) {
      visitorNames = [row.visitor_names];
    }

    return res.json({
      success: true,
      authorization: {
        authorizationId: row.authorization_id,
        visitorNames,
        authorizationStatus: row.authorization_status,
        emailStatus: row.email_status,
        emailMessageId: row.email_message_id,
        smsStatus: row.sms_status,
        smsMessageId: row.sms_message_id,
        gateStatus: row.gate_status,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        verifiedAt: row.verified_at,
        usedAt: row.used_at,
        retryCount: row.retry_count
      }
    });
  });
}

async function handleRetryNotification(req, res) {
  const { authorizationId } = req.params;
  try {
    const result = await retryNotification(authorizationId);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err) {
    logger.error('Error retrying notification:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  handleAuthorize,
  handleGetAuthorization,
  handleRetryNotification
};
