const fs = require('fs');
const path = require('path');
const { runQuery } = require('./db');

const FILE = path.join(__dirname, '..', 'data', 'authorizations.json');

function ensureFile() {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify([], null, 2));
}

function readAll() {
  ensureFile();
  try {
    const data = fs.readFileSync(FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

function writeAll(records) {
  fs.writeFileSync(FILE, JSON.stringify(records, null, 2));
}

function addAuthorization(record) {
  const all = readAll();
  const namesList = record.names || record.visitorNames || [];
  const cleanRecord = {
    ...record,
    names: namesList,
    usedNames: record.usedNames || []
  };
  all.push(cleanRecord);
  writeAll(all);

  // Sync to SQLite Database
  runQuery(
    `INSERT INTO authorizations (id, visitor_names, pin, status, used_names, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      cleanRecord.id,
      JSON.stringify(cleanRecord.names),
      cleanRecord.pin,
      cleanRecord.status,
      JSON.stringify(cleanRecord.usedNames),
      cleanRecord.createdAt || new Date().toISOString()
    ]
  ).catch((err) => console.error('[DB Error] Failed to insert authorization to SQLite:', err.message));

  return cleanRecord;
}

// Finds an authorization for this visitor+PIN where THIS visitor
// specifically hasn't entered yet (others in the same group can still be pending)
function findPendingAuthorization(visitorName, pin) {
  if (!visitorName) return null;
  const target = visitorName.toLowerCase().trim();
  const all = readAll();

  return all.find((r) => {
    const namesList = r.names || r.visitorNames || [];
    const usedList = r.usedNames || [];
    return (
      r.pin === pin &&
      namesList.some((n) => typeof n === 'string' && n.toLowerCase().trim() === target) &&
      !usedList.some((n) => typeof n === 'string' && n.toLowerCase().trim() === target)
    );
  });
}

// Marks only THIS visitor as entered — others in the group stay pending
function markUsed(id, visitorName) {
  const all = readAll();
  const idx = all.findIndex((r) => r.id === id);
  if (idx !== -1) {
    if (!all[idx].usedNames) all[idx].usedNames = [];
    all[idx].usedNames.push(visitorName);
    writeAll(all);

    // Sync to SQLite Database
    runQuery(`UPDATE authorizations SET used_names = ? WHERE id = ?`, [
      JSON.stringify(all[idx].usedNames),
      id
    ]).catch((err) => console.error('[DB Error] Failed to update authorization in SQLite:', err.message));
  }
}

function listPending() {
  return readAll()
    .map((r) => {
      const namesList = r.names || r.visitorNames || [];
      const usedList = r.usedNames || [];
      return {
        ...r,
        names: namesList.filter(
          (n) => typeof n === 'string' && !usedList.some((u) => typeof u === 'string' && u.toLowerCase().trim() === n.toLowerCase().trim())
        )
      };
    })
    .filter((r) => r.names.length > 0);
}

module.exports = { addAuthorization, findPendingAuthorization, markUsed, listPending };
