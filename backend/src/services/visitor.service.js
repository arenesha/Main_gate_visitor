const { query } = require('../database/db');

async function getAllVisitors(search = '') {
  const cleanSearch = (search || '').trim();
  if (cleanSearch) {
    return await query.all(
      `SELECT * FROM visitors WHERE name LIKE ? OR email LIKE ? OR phone LIKE ? ORDER BY name ASC`,
      [`%${cleanSearch}%`, `%${cleanSearch}%`, `%${cleanSearch}%`]
    );
  }
  return await query.all(`SELECT * FROM visitors ORDER BY name ASC`);
}

async function getVisitorById(id) {
  return await query.get(`SELECT * FROM visitors WHERE id = ?`, [id]);
}

async function getVisitorByName(name) {
  if (!name || typeof name !== 'string') return null;
  const target = name.trim().toLowerCase();
  return await query.get(`SELECT * FROM visitors WHERE LOWER(TRIM(name)) = ?`, [target]);
}

async function getVisitorsByNames(names = []) {
  const results = [];
  for (const n of names) {
    const row = await getVisitorByName(n);
    if (row) results.push(row);
  }
  return results;
}

async function createVisitor({ name, email = '', phone = '', active = 1 }) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('Visitor name is required.');
  }
  const cleanName = name.trim();
  const existing = await getVisitorByName(cleanName);
  if (existing) {
    throw new Error(`Visitor with name "${cleanName}" already exists.`);
  }

  const now = new Date().toISOString();
  const res = await query.run(
    `INSERT INTO visitors (name, email, phone, active, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`,
    [cleanName, (email || '').trim(), (phone || '').trim(), active ? 1 : 0, now, now]
  );

  return await getVisitorById(res.lastID);
}

async function updateVisitor(id, { name, email, phone, active }) {
  const existing = await getVisitorById(id);
  if (!existing) {
    throw new Error('Visitor not found.');
  }

  const cleanName = name !== undefined ? name.trim() : existing.name;
  const cleanEmail = email !== undefined ? (email || '').trim() : existing.email;
  const cleanPhone = phone !== undefined ? (phone || '').trim() : existing.phone;
  const cleanActive = active !== undefined ? (active ? 1 : 0) : existing.active;
  const now = new Date().toISOString();

  await query.run(
    `UPDATE visitors SET name = ?, email = ?, phone = ?, active = ?, updatedAt = ? WHERE id = ?`,
    [cleanName, cleanEmail, cleanPhone, cleanActive, now, id]
  );

  return await getVisitorById(id);
}

async function deleteVisitor(id) {
  const existing = await getVisitorById(id);
  if (!existing) {
    throw new Error('Visitor not found.');
  }
  await query.run(`DELETE FROM visitors WHERE id = ?`, [id]);
  return { success: true, message: 'Visitor deleted successfully.' };
}

module.exports = {
  getAllVisitors,
  getVisitorById,
  getVisitorByName,
  getVisitorsByNames,
  createVisitor,
  updateVisitor,
  deleteVisitor
};
