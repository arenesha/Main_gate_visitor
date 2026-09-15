const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const { runQuery } = require('./db');

const FILE = path.join(__dirname, '..', 'data', 'entries.xlsx');
const HEADERS = ['Visitor Name(s)', 'Entry Date', 'Entry Time', 'Authorization Status', 'Entry Status'];

async function logEntry(entry) {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // 1. Log to Excel file
  const workbook = new ExcelJS.Workbook();
  let sheet;

  if (fs.existsSync(FILE)) {
    await workbook.xlsx.readFile(FILE);
    sheet = workbook.getWorksheet('Entries') || workbook.addWorksheet('Entries');
    if (sheet.rowCount === 0) sheet.addRow(HEADERS);
  } else {
    sheet = workbook.addWorksheet('Entries');
    sheet.addRow(HEADERS);
    sheet.getRow(1).font = { bold: true };
  }

  sheet.addRow([
    entry.visitorNames,
    entry.entryDate,
    entry.entryTime,
    entry.authorizationStatus,
    entry.entryStatus
  ]);

  sheet.columns.forEach((col) => { col.width = 24; });
  await workbook.xlsx.writeFile(FILE);

  // 2. Sync to SQLite Database
  try {
    await runQuery(
      `INSERT INTO gate_entries (visitor_name, entry_date, entry_time, authorization_status, entry_status, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        entry.visitorNames,
        entry.entryDate,
        entry.entryTime,
        entry.authorizationStatus,
        entry.entryStatus,
        new Date().toISOString()
      ]
    );
  } catch (err) {
    console.error('[DB Error] Failed to log gate entry to SQLite:', err.message);
  }
}

module.exports = { logEntry, FILE };
