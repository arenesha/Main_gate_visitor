const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

// Resolve database path
const rawDbPath = process.env.DATABASE_PATH || 'backend/data/visitor-entry.db';
const dbPath = path.isAbsolute(rawDbPath)
  ? rawDbPath
  : path.resolve(process.cwd(), rawDbPath);

const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    logger.error('Failed to connect to SQLite database:', err.message);
  } else {
    logger.info(`SQLite Database connected at: ${dbPath}`);
  }
});

// Helper for Promise-based queries
const query = {
  run: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },
  get: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  all: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }
};

async function initDatabase() {
  // 1. Visitors Table
  await query.run(`
    CREATE TABLE IF NOT EXISTS visitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      email TEXT,
      phone TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);

  // 2. Admins Table
  await query.run(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      pinHash TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);

  // 3. Authorizations Table
  await query.run(`
    CREATE TABLE IF NOT EXISTS authorizations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      authorizationId TEXT NOT NULL UNIQUE,
      visitorNames TEXT NOT NULL,
      authorizationStatus TEXT NOT NULL DEFAULT 'AUTHORIZED',
      createdAt TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      verifiedAt TEXT,
      entryStatus TEXT NOT NULL DEFAULT 'PENDING'
    )
  `);

  // 4. Entries Table
  await query.run(`
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      authorizationId TEXT NOT NULL,
      visitorNames TEXT NOT NULL,
      entryDate TEXT NOT NULL,
      entryTime TEXT NOT NULL,
      authorizationStatus TEXT NOT NULL,
      entryStatus TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `);

  // 5. Notifications Table
  await query.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      authorizationId TEXT NOT NULL,
      recipientType TEXT NOT NULL,
      recipient TEXT NOT NULL,
      channel TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT,
      sentAt TEXT NOT NULL,
      errorMessage TEXT
    )
  `);

  // Seed default admin with bcrypt hash of PIN if not set
  const adminRow = await query.get("SELECT * FROM admins WHERE username = 'admin'");
  if (!adminRow) {
    const defaultPin = process.env.DEFAULT_PIN || '1234';
    const salt = await bcrypt.genSalt(10);
    const pinHash = await bcrypt.hash(defaultPin, salt);
    const now = new Date().toISOString();
    await query.run(
      "INSERT INTO admins (username, pinHash, createdAt, updatedAt) VALUES (?, ?, ?, ?)",
      ['admin', pinHash, now, now]
    );
    logger.info('Initialized default admin with bcrypt hashed PIN.');
  }

  // Seed sample visitors in SQLite Visitor Directory if table is empty
  const visitorCount = await query.get("SELECT COUNT(*) as count FROM visitors");
  if (!visitorCount || visitorCount.count === 0) {
    const now = new Date().toISOString();
    const seedVisitors = [
      ['Rahul Patil', 'rahul@gmail.com', '+919876543210'],
      ['Amit Shah', 'amit@gmail.com', '+919876543211'],
      ['Sneha Joshi', 'sneha@gmail.com', '+919876543212'],
      ['Priti Mekale', 'mekalepriti202001@gmail.com', '+919876543213']
    ];
    for (const [name, email, phone] of seedVisitors) {
      await query.run(
        "INSERT OR IGNORE INTO visitors (name, email, phone, active, createdAt, updatedAt) VALUES (?, ?, ?, 1, ?, ?)",
        [name, email, phone, now, now]
      );
    }
    logger.info('Seeded default visitors in SQLite Visitor Directory.');
  }

  logger.info('All 5 SQLite tables initialized successfully.');
}

module.exports = {
  db,
  query,
  initDatabase,
  dbPath
};
