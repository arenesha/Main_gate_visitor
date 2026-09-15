const { query } = require('../database/db');

async function getAllEntries() {
  const rows = await query.all(`SELECT * FROM entries ORDER BY id DESC`);
  return rows.map((row) => {
    let visitorNames = row.visitorNames;
    try {
      const parsed = JSON.parse(row.visitorNames);
      if (Array.isArray(parsed)) visitorNames = parsed.join(', ');
    } catch (e) {}
    return {
      id: row.id,
      authorizationId: row.authorizationId,
      visitorNames,
      entryDate: row.entryDate,
      entryTime: row.entryTime,
      authorizationStatus: row.authorizationStatus,
      entryStatus: row.entryStatus,
      createdAt: row.createdAt
    };
  });
}

module.exports = {
  getAllEntries
};
