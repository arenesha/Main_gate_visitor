const { verifyGateEntry } = require('../services/authorization.service');

async function verify(req, res) {
  try {
    const { authorizationId, pin } = req.body;
    const result = await verifyGateEntry({ authorizationId, pin });

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(200).json(result);
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      entryStatus: 'ENTRY NOT AUTHORIZED',
      message: error.message || 'Internal server error during gate verification.'
    });
  }
}

module.exports = {
  verify
};
