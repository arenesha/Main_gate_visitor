const bcrypt = require('bcryptjs');
const { query } = require('../database/db');
const logger = require('../utils/logger');

async function getAdmin() {
  const admin = await query.get("SELECT * FROM admins WHERE username = 'admin'");
  return admin;
}

/**
 * Compares entered PIN with bcrypt hash stored in admins table
 */
async function verifyPin(pin) {
  if (!pin || typeof pin !== 'string') return false;
  const admin = await getAdmin();
  if (!admin || !admin.pinHash) {
    logger.error('No admin record found in database');
    return false;
  }
  return await bcrypt.compare(pin.trim(), admin.pinHash);
}

/**
 * Changes administrator PIN after bcrypt verification of current PIN
 */
async function changePin({ currentPin, newPin, confirmNewPin }) {
  if (!currentPin) {
    return { success: false, message: 'Current PIN is required.' };
  }
  if (!newPin || typeof newPin !== 'string') {
    return { success: false, message: 'New PIN is required.' };
  }
  const cleanNewPin = newPin.trim();
  if (!/^\d{4,6}$/.test(cleanNewPin)) {
    return { success: false, message: 'New PIN must be between 4 and 6 digits.' };
  }
  if (cleanNewPin !== (confirmNewPin || '').trim()) {
    return { success: false, message: 'New PIN and confirmation do not match.' };
  }

  const isValid = await verifyPin(currentPin);
  if (!isValid) {
    return { success: false, message: 'Incorrect current PIN. Authorization denied.' };
  }

  const salt = await bcrypt.genSalt(10);
  const newPinHash = await bcrypt.hash(cleanNewPin, salt);
  const now = new Date().toISOString();

  await query.run(
    "UPDATE admins SET pinHash = ?, updatedAt = ? WHERE username = 'admin'",
    [newPinHash, now]
  );

  logger.info('Administrator PIN successfully updated with new bcrypt hash.');
  return { success: true, message: 'Authorization PIN updated successfully.' };
}

module.exports = {
  getAdmin,
  verifyPin,
  changePin
};
