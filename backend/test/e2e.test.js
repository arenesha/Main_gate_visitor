/**
 * Comprehensive 24-Point Automated Verification Suite
 * Tests all required features:
 * 1. Health API
 * 2. Database creation
 * 3. Admin PIN creation
 * 4. Correct PIN authorization
 * 5. Incorrect PIN rejection
 * 6. PIN change
 * 7. Old PIN rejected
 * 8. New PIN accepted
 * 9. Visitor creation
 * 10. Visitor lookup
 * 11. Multiple visitors
 * 12. Authorization creation
 * 13. Unique Authorization ID
 * 14. Email sending
 * 15. SMS sending
 * 16. Visitor email
 * 17. Visitor SMS
 * 18. Gate verification
 * 19. Wrong gate PIN
 * 20. Invalid authorization ID
 * 21. Duplicate gate verification
 * 22. Excel creation
 * 23. Excel append
 * 24. Database entry creation
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Use isolated test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = 'backend/data/visitor-entry.test.db';
process.env.EXCEL_FILE_PATH = 'backend/data/visitor-entry-records.test.xlsx';
process.env.DEFAULT_PIN = '1234';
process.env.SECURITY_EMAIL = 'security-test@company.com';
process.env.SECURITY_PHONE = '+19876543210';

// Clean test artifacts
const testDb = path.resolve(process.cwd(), process.env.DATABASE_PATH);
if (fs.existsSync(testDb)) {
  try { fs.unlinkSync(testDb); } catch (e) {}
}

const testExcel = path.resolve(process.cwd(), process.env.EXCEL_FILE_PATH);
if (fs.existsSync(testExcel)) {
  try { fs.unlinkSync(testExcel); } catch (e) {}
}

const app = require('../src/app');
const { initDatabase, query } = require('../src/database/db');

let server;
let baseUrl;

function request(method, urlPath, body = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlPath, baseUrl);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsed
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runAllTests() {
  console.log('\n===============================================================');
  console.log('🧪 RUNNING COMPLETE 24-POINT E2E TEST SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  // 1. Health API
  await test('1. Health API returns status: healthy', async () => {
    await initDatabase();
    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });

    const res = await request('GET', '/api/health');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.status, 'healthy');
  });

  // 2. Database Creation
  await test('2. SQLite database file & tables created', async () => {
    assert.ok(fs.existsSync(testDb), 'Test database file must exist');
    const tables = await query.all(`SELECT name FROM sqlite_master WHERE type='table'`);
    const tableNames = tables.map((t) => t.name);
    assert.ok(tableNames.includes('visitors'), 'visitors table must exist');
    assert.ok(tableNames.includes('admins'), 'admins table must exist');
    assert.ok(tableNames.includes('authorizations'), 'authorizations table must exist');
    assert.ok(tableNames.includes('entries'), 'entries table must exist');
    assert.ok(tableNames.includes('notifications'), 'notifications table must exist');
  });

  // 3. Admin PIN Creation
  await test('3. Admin record seeded with bcrypt pinHash', async () => {
    const admin = await query.get("SELECT * FROM admins WHERE username = 'admin'");
    assert.ok(admin, 'Admin must exist in database');
    assert.ok(admin.pinHash.startsWith('$2'), 'PIN must be bcrypt hashed');
  });

  // 4. Correct PIN Authorization
  let firstAuthId = null;
  await test('4. Correct PIN authorizes single visitor', async () => {
    const res = await request('POST', '/api/authorization/authorize', {
      visitorNames: ['Alice Johnson'],
      pin: '1234'
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.authorizationStatus, 'AUTHORIZED');
    assert.ok(res.body.authorizationId.startsWith('AUTH-') || res.body.authorizationId.startsWith('MG-'));
    firstAuthId = res.body.authorizationId;
  });

  // 5. Incorrect PIN Rejection
  await test('5. Incorrect PIN rejected with NOT_AUTHORIZED', async () => {
    const res = await request('POST', '/api/authorization/authorize', {
      visitorNames: ['Bob Smith'],
      pin: '9999'
    });
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.authorizationStatus, 'NOT_AUTHORIZED');
  });

  // 6. PIN Change
  await test('6. Admin can change PIN with bcrypt verification', async () => {
    const res = await request('POST', '/api/admin/change-pin', {
      currentPin: '1234',
      newPin: '5678',
      confirmNewPin: '5678'
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
  });

  // 7. Old PIN Rejected
  await test('7. Old PIN (1234) is rejected after change', async () => {
    const res = await request('POST', '/api/authorization/authorize', {
      visitorNames: ['Charlie Brown'],
      pin: '1234'
    });
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.success, false);
  });

  // 8. New PIN Accepted
  await test('8. New PIN (5678) is accepted after change', async () => {
    const res = await request('POST', '/api/authorization/authorize', {
      visitorNames: ['Charlie Brown'],
      pin: '5678'
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
  });

  // Reset PIN back to 1234 for subsequent tests
  await request('POST', '/api/admin/change-pin', {
    currentPin: '5678',
    newPin: '1234',
    confirmNewPin: '1234'
  });

  // 9. Visitor Creation
  await test('9. Admin can add visitor with email and phone to SQLite directory', async () => {
    const res = await request('POST', '/api/admin/visitors', {
      name: 'John Doe',
      email: 'johndoe@example.com',
      phone: '+1234567890',
      active: 1
    });
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.visitor.name, 'John Doe');
    assert.strictEqual(res.body.visitor.email, 'johndoe@example.com');
  });

  // 10. Visitor Lookup
  await test('10. Visitor directory search & lookup works', async () => {
    const res = await request('GET', '/api/admin/visitors?search=John');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.visitors.length >= 1);
    assert.strictEqual(res.body.visitors[0].name, 'John Doe');
  });

  // 11. Multiple Visitors Authorization
  let multiAuthId = null;
  await test('11. Multiple visitor names in single authorization request', async () => {
    // Add second visitor to directory
    await request('POST', '/api/admin/visitors', {
      name: 'Jane Doe',
      email: 'janedoe@example.com',
      phone: '+1987654321',
      active: 1
    });

    const res = await request('POST', '/api/authorization/authorize', {
      visitorNames: ['John Doe', 'Jane Doe'],
      pin: '1234'
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.deepStrictEqual(res.body.visitorNames, ['John Doe', 'Jane Doe']);
    multiAuthId = res.body.authorizationId;
  });

  // 12. Authorization Creation in DB
  await test('12. Authorization stored in SQLite authorizations table', async () => {
    const row = await query.get('SELECT * FROM authorizations WHERE authorizationId = ?', [multiAuthId]);
    assert.ok(row, 'Authorization record must exist in SQLite');
    assert.strictEqual(row.authorizationStatus, 'AUTHORIZED');
    assert.strictEqual(row.used, 0);
    assert.strictEqual(row.entryStatus, 'PENDING');
  });

  // 13. Unique Authorization ID
  await test('13. Unique Authorization IDs generated for separate authorizations', async () => {
    const resA = await request('POST', '/api/authorization/authorize', { visitorNames: ['Test A'], pin: '1234' });
    const resB = await request('POST', '/api/authorization/authorize', { visitorNames: ['Test B'], pin: '1234' });
    assert.notStrictEqual(resA.body.authorizationId, resB.body.authorizationId);
  });

  // 14. Email Sending Logged
  await test('14. Security Email notification attempt logged in notifications table', async () => {
    const notifs = await query.all('SELECT * FROM notifications WHERE authorizationId = ? AND recipientType = "SECURITY" AND channel = "EMAIL"', [multiAuthId]);
    assert.ok(notifs.length >= 1, 'Security email notification must be logged');
  });

  // 15. SMS Sending Logged
  await test('15. Security SMS notification attempt logged in notifications table', async () => {
    const notifs = await query.all('SELECT * FROM notifications WHERE authorizationId = ? AND recipientType = "SECURITY" AND channel = "SMS"', [multiAuthId]);
    assert.ok(notifs.length >= 1, 'Security SMS notification must be logged');
  });

  // 16. Visitor Email Logged
  await test('16. Visitor email dynamically looked up from DB and logged', async () => {
    const notifs = await query.all('SELECT * FROM notifications WHERE authorizationId = ? AND recipientType = "VISITOR" AND channel = "EMAIL"', [multiAuthId]);
    assert.ok(notifs.length >= 2, 'Both John Doe and Jane Doe emails must be processed');
  });

  // 17. Visitor SMS Logged
  await test('17. Visitor phone dynamically looked up from DB and logged', async () => {
    const notifs = await query.all('SELECT * FROM notifications WHERE authorizationId = ? AND recipientType = "VISITOR" AND channel = "SMS"', [multiAuthId]);
    assert.ok(notifs.length >= 2, 'Both John Doe and Jane Doe SMS must be processed');
  });

  // 18. Gate Verification (ENTRY AUTHORIZED)
  await test('18. Valid gate verification grants ENTRY AUTHORIZED', async () => {
    const res = await request('POST', '/api/gate/verify', {
      authorizationId: multiAuthId,
      pin: '1234'
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.entryStatus, 'ENTRY AUTHORIZED');
  });

  // 19. Wrong Gate PIN
  await test('19. Wrong gate PIN rejected with ENTRY NOT AUTHORIZED', async () => {
    const res = await request('POST', '/api/gate/verify', {
      authorizationId: firstAuthId,
      pin: 'WRONG'
    });
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.entryStatus, 'ENTRY NOT AUTHORIZED');
  });

  // 20. Invalid Authorization ID
  await test('20. Invalid authorization ID rejected with ENTRY NOT AUTHORIZED', async () => {
    const res = await request('POST', '/api/gate/verify', {
      authorizationId: 'AUTH-INVALID-999999',
      pin: '1234'
    });
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.entryStatus, 'ENTRY NOT AUTHORIZED');
  });

  // 21. Duplicate Gate Verification Rejection
  await test('21. Duplicate gate verification rejected (already used)', async () => {
    const res = await request('POST', '/api/gate/verify', {
      authorizationId: multiAuthId,
      pin: '1234'
    });
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.entryStatus, 'ENTRY NOT AUTHORIZED');
    assert.ok(res.body.message.toLowerCase().includes('already used'));
  });

  // 22. Excel File Creation
  await test('22. Real Excel .xlsx file created automatically on verified entry', async () => {
    assert.ok(fs.existsSync(testExcel), 'Excel file must exist on disk');
  });

  // 23. Excel Row Append
  await test('23. Excel file contains recorded row with header and entry data', async () => {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(testExcel);
    const sheet = workbook.getWorksheet('Visitor Entries');
    assert.ok(sheet, 'Worksheet "Visitor Entries" must exist');
    assert.ok(sheet.rowCount >= 2, 'Sheet must contain header row + at least 1 entry row');
    const row2 = sheet.getRow(2);
    assert.strictEqual(row2.getCell(4).value, 'AUTHORIZED');
    assert.strictEqual(row2.getCell(5).value, 'ENTERED');
  });

  // 24. Database Entry Creation
  await test('24. Gate verification creates persistent record in entries database table', async () => {
    const res = await request('GET', '/api/entries');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.entries.length >= 1, 'At least 1 entry must exist in entries table');
    const latest = res.body.entries[0];
    assert.strictEqual(latest.authorizationId, multiAuthId);
    assert.strictEqual(latest.entryStatus, 'ENTERED');
  });

  server.close();

  // Cleanup test files
  if (fs.existsSync(testDb)) {
    try { fs.unlinkSync(testDb); } catch (e) {}
  }
  if (fs.existsSync(testExcel)) {
    try { fs.unlinkSync(testExcel); } catch (e) {}
  }

  console.log('\n===============================================================');
  console.log(`📊 SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('===============================================================\n');

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runAllTests().catch((err) => {
  console.error('Fatal test error:', err);
  if (server) server.close();
  process.exit(1);
});
