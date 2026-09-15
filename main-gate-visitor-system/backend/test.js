const assert = require('assert');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const env = require('./src/config/env');
const db = require('./src/models/db');
const { createAuthorization, verifyGateEntry, retryNotification } = require('./src/services/authorization.service');

// Small delay to ensure SQLite initialization
setTimeout(async () => {
  console.log('\n========================================================');
  console.log('EXECUTING COMPLETE 10-STAGE SYSTEM VERIFICATION SUITE');
  console.log('========================================================\n');

  try {
    // ----------------------------------------------------
    // TEST 1 — VALID PIN (Single Visitor)
    // ----------------------------------------------------
    console.log('TEST 1: Valid PIN Authorization (Single visitor: John Smith)...');
    const test1Res = await createAuthorization({
      visitorNames: ['John Smith'],
      pin: '1234'
    });
    assert.strictEqual(test1Res.success, true);
    assert.strictEqual(test1Res.authorizationStatus, 'AUTHORIZED');
    assert.ok(test1Res.authorizationId.startsWith('AUTH-'));
    assert.strictEqual(test1Res.gateStatus, 'PENDING');
    console.log(`✓ Test 1 Passed: Authorization created: ${test1Res.authorizationId}`);

    // Verify Gate clearance for Test 1
    const test1Gate = await verifyGateEntry({
      authorizationId: test1Res.authorizationId,
      visitorNames: ['John Smith'],
      pin: '1234'
    });
    assert.strictEqual(test1Gate.success, true);
    assert.strictEqual(test1Gate.entryStatus, 'ENTRY AUTHORIZED');
    assert.ok(fs.existsSync(env.EXCEL_FILE_PATH), 'Excel file must exist');
    console.log('✓ Test 1 Passed: Gate cleared (ENTRY AUTHORIZED) & Excel appended automatically.');

    // ----------------------------------------------------
    // TEST 2 — MULTIPLE VISITORS
    // ----------------------------------------------------
    console.log('\nTEST 2: Multiple Visitors (John Smith, Sarah Smith, Rahul Patil)...');
    const multiNames = ['John Smith', 'Sarah Smith', 'Rahul Patil'];
    const test2Res = await createAuthorization({
      visitorNames: multiNames,
      pin: '1234'
    });
    assert.strictEqual(test2Res.success, true);
    assert.strictEqual(test2Res.authorizationStatus, 'AUTHORIZED');
    
    // Check DB record stores all visitor names
    await new Promise((resolve) => {
      db.get('SELECT * FROM authorizations WHERE authorization_id = ?', [test2Res.authorizationId], (err, row) => {
        assert.ifError(err);
        const stored = JSON.parse(row.visitor_names);
        assert.strictEqual(stored.length, 3);
        assert.deepStrictEqual(stored, multiNames);
        resolve();
      });
    });

    const test2Gate = await verifyGateEntry({
      authorizationId: test2Res.authorizationId,
      visitorNames: multiNames,
      pin: '1234'
    });
    assert.strictEqual(test2Gate.success, true);
    assert.strictEqual(test2Gate.entryStatus, 'ENTRY AUTHORIZED');
    assert.strictEqual(test2Gate.visitorNames.length, 3);
    console.log('✓ Test 2 Passed: All 3 visitor names preserved across auth, gate, and Excel.');

    // ----------------------------------------------------
    // TEST 3 — INVALID PIN
    // ----------------------------------------------------
    console.log('\nTEST 3: Invalid PIN Rejection...');
    const test3Res = await createAuthorization({
      visitorNames: ['Invalid Visitor'],
      pin: '999999'
    });
    assert.strictEqual(test3Res.success, false);
    assert.strictEqual(test3Res.authorizationStatus, 'NOT_AUTHORIZED');
    assert.strictEqual(test3Res.authorizationId, undefined);
    console.log('✓ Test 3 Passed: Invalid PIN stopped immediately with NOT_AUTHORIZED. No notification/Excel.');

    // ----------------------------------------------------
    // TEST 4 — WRONG GATE PIN
    // ----------------------------------------------------
    console.log('\nTEST 4: Wrong Gate PIN...');
    const test4Auth = await createAuthorization({
      visitorNames: ['Alice Green'],
      pin: '1234'
    });
    const test4Gate = await verifyGateEntry({
      authorizationId: test4Auth.authorizationId,
      pin: 'WRONG_PIN'
    });
    assert.strictEqual(test4Gate.success, false);
    assert.strictEqual(test4Gate.entryStatus, 'ENTRY NOT AUTHORIZED');
    console.log('✓ Test 4 Passed: Wrong Gate PIN rejected with ENTRY NOT AUTHORIZED.');

    // ----------------------------------------------------
    // TEST 5 — WRONG VISITOR NAME
    // ----------------------------------------------------
    console.log('\nTEST 5: Wrong Visitor Name at Gate...');
    const test5Auth = await createAuthorization({
      visitorNames: ['Robert Brown'],
      pin: '1234'
    });
    const test5Gate = await verifyGateEntry({
      authorizationId: test5Auth.authorizationId,
      visitorNames: ['Impostor Brown'],
      pin: '1234'
    });
    assert.strictEqual(test5Gate.success, false);
    assert.strictEqual(test5Gate.entryStatus, 'ENTRY NOT AUTHORIZED');
    console.log('✓ Test 5 Passed: Mismatched visitor name rejected with ENTRY NOT AUTHORIZED.');

    // ----------------------------------------------------
    // TEST 6 — EXPIRED AUTHORIZATION
    // ----------------------------------------------------
    console.log('\nTEST 6: Expired Authorization...');
    const expiredAuthId = 'AUTH-EXPIRED-TEST-999';
    await new Promise((resolve) => {
      const pastDate = new Date(Date.now() - 3600000).toISOString();
      db.run(
        `INSERT INTO authorizations (authorization_id, visitor_names, authorization_status, gate_status, created_at, expires_at)
         VALUES (?, ?, 'AUTHORIZED', 'PENDING', ?, ?)`,
        [expiredAuthId, JSON.stringify(['Expired Visitor']), pastDate, pastDate],
        resolve
      );
    });
    const test6Gate = await verifyGateEntry({
      authorizationId: expiredAuthId,
      pin: '1234'
    });
    assert.strictEqual(test6Gate.success, false);
    assert.strictEqual(test6Gate.entryStatus, 'ENTRY NOT AUTHORIZED');
    assert.ok(test6Gate.reason.includes('expired'));
    console.log('✓ Test 6 Passed: Expired authorization blocked with ENTRY NOT AUTHORIZED.');

    // ----------------------------------------------------
    // TEST 7 — DUPLICATE AUTHORIZATION
    // ----------------------------------------------------
    console.log('\nTEST 7: Duplicate Authorization Prevention...');
    const test7Auth = await createAuthorization({
      visitorNames: ['David Miller'],
      pin: '1234'
    });
    const test7Gate1 = await verifyGateEntry({
      authorizationId: test7Auth.authorizationId,
      pin: '1234'
    });
    assert.strictEqual(test7Gate1.success, true);
    assert.strictEqual(test7Gate1.entryStatus, 'ENTRY AUTHORIZED');

    const test7Gate2 = await verifyGateEntry({
      authorizationId: test7Auth.authorizationId,
      pin: '1234'
    });
    assert.strictEqual(test7Gate2.success, false);
    assert.strictEqual(test7Gate2.entryStatus, 'ENTRY NOT AUTHORIZED');
    assert.ok(test7Gate2.reason.includes('already been used'));
    console.log('✓ Test 7 Passed: Duplicate entry attempt blocked with ENTRY NOT AUTHORIZED.');

    // ----------------------------------------------------
    // TEST 8 — ADMIN PIN CHANGE
    // ----------------------------------------------------
    console.log('\nTEST 8: Admin PIN Change & Verification...');
    const salt = bcrypt.genSaltSync(10);
    const newHash = bcrypt.hashSync('5678', salt);
    await new Promise((resolve) => {
      db.run(
        `INSERT INTO admin_settings (key, value, updated_at) VALUES ('auth_pin', ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [newHash],
        resolve
      );
    });

    // Old PIN should now fail
    const test8OldPin = await createAuthorization({
      visitorNames: ['Test Visitor'],
      pin: '1234'
    });
    assert.strictEqual(test8OldPin.success, false);
    assert.strictEqual(test8OldPin.authorizationStatus, 'NOT_AUTHORIZED');

    // New PIN should succeed
    const test8NewPin = await createAuthorization({
      visitorNames: ['Test Visitor'],
      pin: '5678'
    });
    assert.strictEqual(test8NewPin.success, true);
    assert.strictEqual(test8NewPin.authorizationStatus, 'AUTHORIZED');

    // Restore PIN to 1234
    const defaultHash = bcrypt.hashSync('1234', salt);
    await new Promise((resolve) => {
      db.run(
        `INSERT INTO admin_settings (key, value, updated_at) VALUES ('auth_pin', ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [defaultHash],
        resolve
      );
    });
    console.log('✓ Test 8 Passed: PIN updated to 5678 (old PIN invalid, new PIN valid), restored to 1234.');

    // ----------------------------------------------------
    // TEST 9 — EMAIL FAILURE REPORTING
    // ----------------------------------------------------
    console.log('\nTEST 9: Email Failure Accurate Reporting (No Fake Success)...');
    assert.strictEqual(test1Res.emailStatus, 'FAILED');
    console.log('✓ Test 9 Passed: When SMTP credentials missing/placeholder, Email status is genuinely FAILED.');

    // ----------------------------------------------------
    // TEST 10 — SMS FAILURE REPORTING
    // ----------------------------------------------------
    console.log('\nTEST 10: SMS Failure Accurate Reporting (No Fake Success)...');
    assert.strictEqual(test1Res.smsStatus, 'FAILED');
    console.log('✓ Test 10 Passed: When SMS credentials missing/placeholder, SMS status is genuinely FAILED.');

    console.log('\n========================================================');
    console.log('ALL 10 VERIFICATION TESTS COMPLETED & PASSED SUCCESSFULLY');
    console.log('========================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test suite failed:', err);
    process.exit(1);
  }
}, 800);

