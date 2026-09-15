/**
 * Input validation middleware
 */

function validateAuthorizeRequest(req, res, next) {
  const { visitorNames, pin } = req.body;

  // 1. Validate visitorNames
  if (!visitorNames) {
    return res.status(400).json({
      success: false,
      authorizationStatus: 'NOT_AUTHORIZED',
      message: 'Visitor Name(s) are required.'
    });
  }

  const namesList = Array.isArray(visitorNames)
    ? visitorNames.map(n => String(n).trim()).filter(Boolean)
    : [String(visitorNames).trim()].filter(Boolean);

  if (namesList.length === 0) {
    return res.status(400).json({
      success: false,
      authorizationStatus: 'NOT_AUTHORIZED',
      message: 'At least one valid visitor name must be provided.'
    });
  }

  // 2. Validate PIN format (must be non-empty string/number)
  if (!pin || String(pin).trim().length === 0) {
    return res.status(400).json({
      success: false,
      authorizationStatus: 'NOT_AUTHORIZED',
      message: 'Authorization PIN is required.'
    });
  }

  req.body.visitorNames = namesList;
  req.body.pin = String(pin).trim();
  next();
}

function validateGateVerifyRequest(req, res, next) {
  const { authorizationId, pin } = req.body;

  if (!authorizationId || !String(authorizationId).trim()) {
    return res.status(400).json({
      success: false,
      entryStatus: 'ENTRY NOT AUTHORIZED',
      reason: 'Authorization ID is required.'
    });
  }

  if (!pin || !String(pin).trim()) {
    return res.status(400).json({
      success: false,
      entryStatus: 'ENTRY NOT AUTHORIZED',
      reason: 'Authorization PIN is required for verification.'
    });
  }

  req.body.authorizationId = String(authorizationId).trim();
  req.body.pin = String(pin).trim();
  next();
}

module.exports = {
  validateAuthorizeRequest,
  validateGateVerifyRequest
};
