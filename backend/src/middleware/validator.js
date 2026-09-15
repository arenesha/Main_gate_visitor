/**
 * Request validation middleware
 */

function validateAuthorizeRequest(req, res, next) {
  let { visitorNames, pin } = req.body;

  // Handle single string or array
  if (typeof visitorNames === "string") {
    visitorNames = [visitorNames];
  }

  if (!visitorNames || !Array.isArray(visitorNames) || visitorNames.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Please provide at least one visitor name.",
      emailSent: false,
      smsSent: false
    });
  }

  // Clean and filter non-empty strings
  const cleanedNames = visitorNames
    .map((name) => (typeof name === "string" ? name.trim() : ""))
    .filter((name) => name.length > 0);

  if (cleanedNames.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Visitor names cannot be empty.",
      emailSent: false,
      smsSent: false
    });
  }

  if (!pin || typeof pin !== "string" || pin.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: "Authorization PIN is required.",
      emailSent: false,
      smsSent: false
    });
  }

  req.cleanedVisitorNames = cleanedNames;
  req.cleanedPin = pin.trim();
  next();
}

function validateChangePinRequest(req, res, next) {
  const { currentPin, newPin } = req.body;

  if (!currentPin || typeof currentPin !== "string" || currentPin.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: "Current PIN is required."
    });
  }

  if (!newPin || typeof newPin !== "string" || newPin.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: "New PIN is required."
    });
  }

  const cleanNewPin = newPin.trim();
  if (cleanNewPin.length < 4 || cleanNewPin.length > 8 || !/^\d+$/.test(cleanNewPin)) {
    return res.status(400).json({
      success: false,
      message: "New PIN must be between 4 and 8 numeric digits."
    });
  }

  req.cleanedCurrentPin = currentPin.trim();
  req.cleanedNewPin = cleanNewPin;
  next();
}

module.exports = {
  validateAuthorizeRequest,
  validateChangePinRequest
};
