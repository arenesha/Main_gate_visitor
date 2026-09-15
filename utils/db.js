const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'visitor_system.db');
const db = new sqlite3.Database(dbPath);

// Initialize Tables
db.serialize(() => {
  // 1. Config Table
  db.run(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  // Set default PIN if not set
  db.get(`SELECT value FROM config WHERE key = 'pin'`, (err, row) => {
    if (!row) {
      db.run(`INSERT INTO config (key, value) VALUES ('pin', '1234')`);
    }
  });

  // 2. Authorizations Table
  db.run(`
    CREATE TABLE IF NOT EXISTS authorizations (
      id TEXT PRIMARY KEY,
      visitor_names TEXT NOT NULL,
      pin TEXT NOT NULL,
      status TEXT NOT NULL,
      used_names TEXT,
      created_at TEXT NOT NULL
    )
  `);

  // 3. Gate Entries Table
  db.run(`
    CREATE TABLE IF NOT EXISTS gate_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_name TEXT NOT NULL,
      entry_date TEXT NOT NULL,
      entry_time TEXT NOT NULL,
      authorization_status TEXT NOT NULL,
      entry_status TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
});

// Helper Database Methods
function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

module.exports = {
  db,
  getQuery,
  allQuery,
  runQuery,
  dbPath
};
