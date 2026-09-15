const fs = require('fs');
const path = require('path');
const { getQuery, runQuery } = require('./db');

const FILE = path.join(__dirname, '..', 'data', 'config.json');

function ensureFile() {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, JSON.stringify({ pin: '1234' }, null, 2));
  }
}

function getPin() {
  ensureFile();
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
    return data.pin || '1234';
  } catch (e) {
    return '1234';
  }
}

function setPin(newPin) {
  ensureFile();
  const cleanPin = String(newPin).trim();
  fs.writeFileSync(FILE, JSON.stringify({ pin: cleanPin }, null, 2));

  // Sync to SQLite asynchronously
  runQuery(`INSERT INTO config (key, value) VALUES ('pin', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [cleanPin])
    .catch((err) => console.error('[DB Error] Failed to sync PIN to SQLite:', err.message));

  return cleanPin;
}

module.exports = { getPin, setPin };
