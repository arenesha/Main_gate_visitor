const { verifyGateEntry } = require('../services/authorization.service');
const logger = require('../utils/logger');

async function handleGateVerify(req, res) {
  try {
    const { authorizationId, visitorNames, pin } = req.body;
    const result = await verifyGateEntry({ authorizationId, visitorNames, pin });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        entryStatus: 'ENTRY NOT AUTHORIZED',
        reason: result.reason || 'Verification failed.'
      });
    }

    return res.status(200).json({
      success: true,
      entryStatus: 'ENTRY AUTHORIZED',
      authorizationId: result.authorizationId,
      visitorNames: result.visitorNames,
      verification: 'VALID',
      entryTime: result.entryTime
    });
  } catch (err) {
    logger.error('Error in handleGateVerify:', err.message);
    return res.status(500).json({
      success: false,
      entryStatus: 'ENTRY NOT AUTHORIZED',
      reason: 'Internal server error during verification.'
    });
  }
}

module.exports = {
  handleGateVerify
};
