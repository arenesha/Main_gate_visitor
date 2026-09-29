/**
 * Comprehensive Automated End-to-End Test Suite for Real Production Guard Gate Flow & Guard Activation Email
 * Tests Worker API, D1 logic, and Email Dispatching against all requirements.
 */

const BASE_URL = process.env.TEST_URL || 'http://127.0.0.1:8788';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function request(method, path, body = null, token = null) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  return { status: res.status, data };
}

async function runTests() {
  console.log('====================================================');
  console.log('STARTING REAL PRODUCTION GUARD GATE & EMAIL TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Health Check
    console.log('1. Testing /api/health endpoint...');
    const health = await request('GET', '/api/health');
    assert(health.status === 200 && health.data.status === 'ok', 'GET /api/health returns 200 OK');
    assert(health.data.database === 'CONNECTED', 'D1 database binding is CONNECTED');

    // 2. Guard Authorization & Real Activation Email Dispatch
    console.log('\n2. Testing Guard Authorization & "Guard Access Activated" First Email...');
    const guardAuthRes = await request('POST', '/api/admin/guards', {
      email: 'arenesha20@gmail.com',
      name: 'AreneSHA Guard',
      assigned_location: 'B-Block, MEENAKSHI TECH PARK, 11th, Gachibowli, Hyderabad, Telangana 500032',
      force_resend: true
    });
    assert(guardAuthRes.status === 201 && guardAuthRes.data.success, 'Admin successfully authorizes Guard account');
    assert(guardAuthRes.data.guard.email === 'arenesha20@gmail.com', 'Guard email saved in database');
    assert(guardAuthRes.data.guard.role === 'GUARD', 'Guard role is GUARD');
    assert(guardAuthRes.data.email_notification !== undefined, 'Email notification dispatch attempted');

    // Test duplicate email protection
    console.log('\n3. Testing Duplicate Activation Email Protection...');
    const dupGuardAuthRes = await request('POST', '/api/admin/guards', {
      email: 'arenesha20@gmail.com',
      name: 'AreneSHA Guard',
      assigned_location: 'B-Block, MEENAKSHI TECH PARK, 11th, Gachibowli, Hyderabad, Telangana 500032',
      force_resend: false
    });
    assert(dupGuardAuthRes.status === 201 && dupGuardAuthRes.data.success, 'Subsequent authorize request succeeds');
    assert(dupGuardAuthRes.data.email_notification.already_sent === true, 'Duplicate activation email prevented by server log check');

    // Test list guards endpoint
    console.log('\n4. Testing GET /api/admin/guards list...');
    const listGuardsRes = await request('GET', '/api/admin/guards');
    assert(listGuardsRes.status === 200 && listGuardsRes.data.success, 'GET /api/admin/guards returns guards');
    const hasGuard = listGuardsRes.data.guards.some(g => g.email === 'arenesha20@gmail.com');
    assert(hasGuard, 'Guard arenesha20@gmail.com listed in authorized guards directory');

    // 5. Guard Authentication (Server-Side)
    console.log('\n5. Testing Server-side Guard Authentication...');
    const loginRes = await request('POST', '/api/auth/login', {
      email: 'arenesha20@gmail.com',
      password: 'Guard@AreneSHA2026'
    });
    assert(loginRes.status === 200 && loginRes.data.success, 'Guard logs in via POST /api/auth/login');
    const guardToken = loginRes.data.token;
    assert(guardToken && guardToken.startsWith('SES_'), `Valid session token received: ${guardToken?.substring(0, 12)}...`);
    assert(loginRes.data.user.role === 'GUARD', 'User role is correctly set to GUARD');
    assert(loginRes.data.user.email === 'arenesha20@gmail.com', 'Authorized Guard email verified');

    // Verify /api/auth/me with session token
    const meRes = await request('GET', '/api/auth/me', null, guardToken);
    assert(meRes.status === 200 && meRes.data.user.email === 'arenesha20@gmail.com', 'GET /api/auth/me validates session');

    // 6. Unauthorized User Access Check
    console.log('\n6. Testing Security Protection for Unauthorized Request...');
    const unauthScan = await request('POST', '/api/gate/scan-pass', { qr_payload: 'QR_SAMPLE' }, null);
    assert(unauthScan.status === 401, 'Unauthenticated scan request rejected with 401');

    // 7. TEST 1: Real Invitation -> QR Scanned -> Valid Details Shown -> Allow Entry -> DB Recorded
    console.log('\n7. TEST 1: Complete Real Guard Gate QR Flow (Scan -> Visual Inspect -> Allow Entry)...');
    const now = new Date();
    const validUntil = new Date(now.getTime() + 12 * 60 * 60 * 1000);

    const createRes = await request('POST', '/api/invitations', {
      visitor_name: 'Nutan Tech Lead',
      visitor_phone: '+91 9876543210',
      visitor_email: 'nutan@example.com',
      purpose: 'Technical Security Verification',
      host_name: 'AreneSHA Owner',
      host_department: 'B-Block, MEENAKSHI TECH PARK, 11th, Gachibowli, Hyderabad, Telangana 500032',
      vehicle_number: 'TS-09-GA-1234',
      valid_from: now.toISOString(),
      valid_until: validUntil.toISOString(),
      entry_type: 'SINGLE'
    });
    assert(createRes.status === 201 && createRes.data.success, 'Invitation created successfully in D1');
    const inv1 = createRes.data.invitation;

    // Step 7a: Guard scans QR -> Backend validates & returns real details WITHOUT checking in yet
    const scanRes = await request('POST', '/api/gate/scan-pass', { qr_payload: inv1.qr_token }, guardToken);
    assert(scanRes.status === 200 && scanRes.data.valid === true, 'Backend validates QR pass');
    assert(scanRes.data.invitation.visitor_name === 'Nutan Tech Lead', 'Real visitor name returned from DB');
    assert(scanRes.data.invitation.host_name === 'AreneSHA Owner', 'Real host name returned from DB');
    assert(scanRes.data.invitation.vehicle_number === 'TS-09-GA-1234', 'Vehicle plate number returned from DB');
    assert(scanRes.data.invitation.entries_used === 0, 'Pass is NOT marked used during scan step');

    // Step 7b: Guard visually confirms visitor and clicks ALLOW ENTRY
    const allowRes = await request('POST', '/api/gate/allow-entry', {
      invitation_id: inv1.id,
      verification_method: 'QR_SCAN'
    }, guardToken);
    assert(allowRes.status === 200 && allowRes.data.authorized === true, 'Guard ALLOW ENTRY records successful check-in');
    assert(allowRes.data.message === 'ENTRY ALLOWED', 'Message confirms ENTRY ALLOWED');
    assert(allowRes.data.server_timestamp !== undefined, 'Server-generated timestamp is stored');
    assert(allowRes.data.invitation.status === 'USED', 'Single-entry pass transitioned to USED');

    // 8. TEST 5: Re-scan of Already Checked-in Pass
    console.log('\n8. TEST 5: Protection Against Duplicate Check-in on Used Pass...');
    const dupScan = await request('POST', '/api/gate/scan-pass', { qr_payload: inv1.qr_token }, guardToken);
    assert(dupScan.data.valid === false, 'Already checked in QR rejected on scan');
    assert(dupScan.data.message.includes('ALREADY CHECKED IN') || dupScan.data.reason.includes('Maximum allowed entries'), 'Correct rejection reason provided');

    // Also test allow-entry attempt on used pass
    const dupAllow = await request('POST', '/api/gate/allow-entry', {
      invitation_id: inv1.id,
      verification_method: 'QR_SCAN'
    }, guardToken);
    assert(dupAllow.data.authorized === false, 'Duplicate Allow Entry rejected by server');

    // 9. TEST 6 & 7: Race Condition / Concurrent Allow Entry Protection
    console.log('\n9. TEST 6 & 7: Concurrent & Double-Click Entry Protection...');
    const multiCreate = await request('POST', '/api/invitations', {
      visitor_name: 'Concurrent Visitor',
      purpose: 'Stress Testing',
      host_name: 'AreneSHA Security Admin',
      host_department: 'B-Block, MEENAKSHI TECH PARK',
      entry_type: 'SINGLE'
    });
    const invConc = multiCreate.data.invitation;

    // Send two simultaneous allow requests
    const [raceRes1, raceRes2] = await Promise.all([
      request('POST', '/api/gate/allow-entry', { invitation_id: invConc.id, verification_method: 'QR_SCAN' }, guardToken),
      request('POST', '/api/gate/allow-entry', { invitation_id: invConc.id, verification_method: 'QR_SCAN' }, guardToken)
    ]);

    const successCount = [raceRes1, raceRes2].filter(r => r.data.authorized === true).length;
    const rejectCount = [raceRes1, raceRes2].filter(r => r.data.authorized === false).length;
    assert(successCount === 1, 'Exactly ONE concurrent request authorized');
    assert(rejectCount === 1, 'Exactly ONE concurrent request rejected due to atomic DB constraint');

    // 10. TEST 2: Expired Pass Rejection
    console.log('\n10. TEST 2: Expired QR Rejection...');
    const pastFrom = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const pastUntil = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const expiredCreate = await request('POST', '/api/invitations', {
      visitor_name: 'Expired Guest',
      purpose: 'Yesterday Meeting',
      host_name: 'Host Officer',
      host_department: 'B-Block, MEENAKSHI TECH PARK',
      valid_from: pastFrom,
      valid_until: pastUntil
    });
    const expiredInv = expiredCreate.data.invitation;

    const expiredScan = await request('POST', '/api/gate/scan-pass', { qr_payload: expiredInv.qr_token }, guardToken);
    assert(expiredScan.data.valid === false, 'Expired QR rejected');
    assert(expiredScan.data.reason.includes('EXPIRED'), 'Reason states pass has EXPIRED');

    // 11. TEST 3: Revoked Pass Rejection
    console.log('\n11. TEST 3: Revoked Pass Rejection...');
    const revCreate = await request('POST', '/api/invitations', {
      visitor_name: 'Revoked Guest',
      purpose: 'Cancelled Visit',
      host_name: 'Host Officer',
      host_department: 'B-Block, MEENAKSHI TECH PARK'
    });
    const revInv = revCreate.data.invitation;
    await request('POST', `/api/invitations/${revInv.id}/revoke`);

    const revScan = await request('POST', '/api/gate/scan-pass', { qr_payload: revInv.qr_token }, guardToken);
    assert(revScan.data.valid === false, 'Revoked QR rejected');
    assert(revScan.data.reason.includes('REVOKED'), 'Reason states pass is REVOKED');

    // 12. TEST 4: Invalid / Random QR Payload
    console.log('\n12. TEST 4: Invalid Random QR String Rejection...');
    const invalidScan = await request('POST', '/api/gate/scan-pass', { qr_payload: 'RANDOM_GARBAGE_QR_12345' }, guardToken);
    assert(invalidScan.data.valid === false, 'Random QR rejected with INVALID PASS');

    // 13. TEST 8: 6-Digit OTP Fallback Flow
    console.log('\n13. TEST 8: OTP Fallback Flow...');
    const otpPassCreate = await request('POST', '/api/invitations', {
      visitor_name: 'OTP Guest',
      purpose: 'Camera Unavailable Test',
      host_name: 'Host Officer',
      host_department: 'B-Block, MEENAKSHI TECH PARK'
    });
    const otpInv = otpPassCreate.data.invitation;

    // Scan via OTP code
    const otpScanRes = await request('POST', '/api/gate/scan-pass', { otp_code: otpInv.entry_code }, guardToken);
    assert(otpScanRes.data.valid === true, 'Valid 6-digit OTP recognized');
    assert(otpScanRes.data.invitation.visitor_name === 'OTP Guest', 'Visitor details returned for OTP');

    // Allow entry
    const otpAllowRes = await request('POST', '/api/gate/allow-entry', {
      invitation_id: otpInv.id,
      verification_method: 'OTP_FALLBACK'
    }, guardToken);
    assert(otpAllowRes.data.authorized === true, 'OTP Fallback entry successfully authorized');

    // 14. TEST 9: Structured Deny Entry Flow
    console.log('\n14. TEST 9: Guard Deny Entry with Structured Reason...');
    const denyGuestCreate = await request('POST', '/api/invitations', {
      visitor_name: 'Suspicious Guest',
      purpose: 'Audit Inspection',
      host_name: 'Security Head',
      host_department: 'B-Block, MEENAKSHI TECH PARK'
    });
    const denyInv = denyGuestCreate.data.invitation;

    const denyRes = await request('POST', '/api/gate/deny-entry', {
      invitation_id: denyInv.id,
      verification_method: 'QR_SCAN',
      reason: 'Visitor details do not match',
      notes: 'Photo ID did not match person presented'
    }, guardToken);
    assert(denyRes.data.authorized === false && denyRes.data.message === 'ENTRY DENIED', 'Denial recorded in DB');
    assert(denyRes.data.reason === 'Visitor details do not match', 'Denial reason logged properly');

    // 15. Verification Audit Log Check
    console.log('\n15. Testing Verification History Audit Logging...');
    const historyRes = await request('GET', '/api/verifications/history');
    assert(historyRes.status === 200 && historyRes.data.verifications.length >= 5, `Audit log contains ${historyRes.data.verifications.length} verified events`);
    const guardLogged = historyRes.data.verifications.some(v => v.verified_by && v.verified_by.includes('arenesha20@gmail.com'));
    assert(guardLogged, 'Audit logs accurately record Guard identity (arenesha20@gmail.com)');

    console.log('\n====================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed === 0) {
      console.log('🎉 ALL PRODUCTION GUARD GATE & EMAIL ACTIVATION TESTS PASSED 100%!');
      process.exit(0);
    } else {
      process.exit(1);
    }

  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
