const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const logger = require('../utils/logger');

const dataDir = path.dirname(env.DATABASE_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(env.DATABASE_PATH, (err) => {
  if (err) {
    logger.error('Failed to connect to SQLite database:', err.message);
  } else {
    logger.info('Connected to SQLite database at ' + env.DATABASE_PATH);
  }
});

// Initialize tables
db.serialize(() => {
  // Authorizations table
  db.run(`
    CREATE TABLE IF NOT EXISTS authorizations (
      authorization_id TEXT PRIMARY KEY,
      visitor_names TEXT NOT NULL,
      authorization_status TEXT NOT NULL,
      email_status TEXT DEFAULT 'PENDING',
      email_message_id TEXT,
      sms_status TEXT DEFAULT 'PENDING',
      sms_message_id TEXT,
      gate_status TEXT DEFAULT 'PENDING',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      verified_at DATETIME,
      used_at DATETIME,
      retry_count INTEGER DEFAULT 0,
      last_retry_at DATETIME
    )
  `);

  // Admin settings table
  db.run(`
    CREATE TABLE IF NOT EXISTS admin_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed admin PIN hash strictly from environment if provided and not yet set
  db.get(`SELECT value FROM admin_settings WHERE key = 'auth_pin'`, async (err, row) => {
    if (err) {
      logger.error('Error checking admin PIN:', err.message);
      return;
    }
    if (!row && env.DEFAULT_PIN) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(env.DEFAULT_PIN, salt);
      db.run(`INSERT INTO admin_settings (key, value) VALUES ('auth_pin', ?)`, [hash], (insertErr) => {
        if (insertErr) logger.error('Error initializing PIN:', insertErr.message);
        else logger.info('Initial authorization PIN initialized from environment variable with bcrypt hash.');
      });
    }
  });
});

module.exports = db;
