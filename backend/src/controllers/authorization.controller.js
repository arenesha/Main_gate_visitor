const { createAuthorization } = require('../services/authorization.service');

async function authorize(req, res) {
  try {
    const { visitorNames, pin } = req.body;
    const result = await createAuthorization({ visitorNames, pin });

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(401).json(result);
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      authorizationStatus: 'NOT_AUTHORIZED',
      message: error.message || 'Internal server error during authorization.'
    });
  }
}

module.exports = {
  authorize
};
