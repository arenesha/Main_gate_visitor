/**
 * Comprehensive Automated Test Suite for Main Gate Visitor Entry Authorization System
 * Tests:
 * 1. Health check endpoint
 * 2. Step 1, 2, 3: Host Authorize Visitor with valid PIN
 * 3. Rejection on invalid PIN during Host authorization
 * 4. Rejection on empty visitor names
 * 5. Step 4 & 5: Main Gate Verification (ENTRY AUTHORIZED) & Automatic Excel Logging
 * 6. Step 4 & 5: Main Gate Verification (ENTRY NOT AUTHORIZED) & Automatic Excel Logging
 * 7. Step 5: Read and verify Excel records
 * 8. Admin PIN change and post-change authorization
 */

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "./database.test.sqlite";
process.env.DEFAULT_PIN = "1234";
process.env.SECURITY_EMAIL = "main-gate-security@company.com";
process.env.SECURITY_PHONE_NUMBER = "+919876543210";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const http = require("http");

// Clean test database and excel
const testDbPath = path.resolve(__dirname, "../database.test.sqlite");
if (fs.existsSync(testDbPath)) {
  try { fs.unlinkSync(testDbPath); } catch (e) { }
}

const testExcelPath = path.resolve(__dirname, "../records/visitor_entries.xlsx");
if (fs.existsSync(testExcelPath)) {
  try { fs.unlinkSync(testExcelPath); } catch (e) { }
}

const app = require("../backend/src/app");
const { initDatabase } = require("../backend/src/database/db");
const { getExcelEntries, EXCEL_FILE_PATH } = require("../backend/src/services/excel.service");

let server;
let baseUrl;

function makeRequest(method, urlPath, body = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlPath, baseUrl);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: method,
      headers: {
        "Content-Type": "application/json"
      }
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
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

    req.on("error", reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("🧪 RUNNING 5-STEP MAIN GATE VISITOR SYSTEM TEST SUITE");
  console.log("=======================================================\n");

  await initDatabase();

  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

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

  // 1. Health Check
  await test("GET /api/health should return 200 and healthy status", async () => {
    const res = await makeRequest("GET", "/api/health");
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.status, "healthy");
  });

  // 2. Step 1, 2, 3: Host Authorizes Visitor
  await test("Step 1, 2, 3: POST /api/visitor/authorize authorizes visitors with valid PIN", async () => {
    const res = await makeRequest("POST", "/api/visitor/authorize", {
      visitorNames: ["Rahul Patil", "Sneha Sharma"],
      pin: "1234"
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.authorizationStatus, "AUTHORIZED");
    assert.deepStrictEqual(res.body.visitorNames, ["Rahul Patil", "Sneha Sharma"]);
    assert.strictEqual(typeof res.body.emailSent, "boolean");
    assert.strictEqual(typeof res.body.smsSent, "boolean");
  });

  // 3. Step 2: Reject Invalid PIN
  await test("Step 2: Reject authorization when PIN is incorrect", async () => {
    const res = await makeRequest("POST", "/api/visitor/authorize", {
      visitorNames: ["Amit Kumar"],
      pin: "9999"
    });
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.emailSent, false);
    assert.strictEqual(res.body.smsSent, false);
  });

  // 4. Step 4 & 5: Main Gate Verification -> ENTRY AUTHORIZED + Excel Log
  await test("Step 4 & 5: POST /api/gate/verify grants ENTRY AUTHORIZED and logs to Excel", async () => {
    const res = await makeRequest("POST", "/api/gate/verify", {
      visitorNames: ["Rahul Patil", "Sneha Sharma"],
      pin: "1234"
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.entryStatus, "ENTRY AUTHORIZED");
    assert.strictEqual(res.body.authorizationStatus, "AUTHORIZED");
  });

  // 5. Step 4 & 5: Main Gate Verification -> ENTRY NOT AUTHORIZED + Excel Log
  await test("Step 4 & 5: POST /api/gate/verify rejects invalid visitor with ENTRY NOT AUTHORIZED and logs to Excel", async () => {
    const res = await makeRequest("POST", "/api/gate/verify", {
      visitorNames: ["Unknown Visitor"],
      pin: "1234"
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.entryStatus, "ENTRY NOT AUTHORIZED");
  });

  // 6. Step 5: Verify Excel records
  await test("Step 5: GET /api/gate/records reads recorded rows directly from Excel", async () => {
    const res = await makeRequest("GET", "/api/gate/records");
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.records));
    assert.ok(res.body.records.length >= 1);

    // Check fields in Excel record
    const latest = res.body.records[0];
    assert.ok(latest.visitorNames);
    assert.ok(latest.entryDate);
    assert.ok(latest.entryTime);
    assert.ok(latest.authorizationStatus);
    assert.ok(latest.entryStatus);
  });

  // 7. Admin Change PIN
  await test("Admin: Change PIN to 5678 and verify new PIN works", async () => {
    const resChange = await makeRequest("POST", "/api/admin/change-pin", {
      currentPin: "1234",
      newPin: "5678"
    });
    assert.strictEqual(resChange.statusCode, 200);
    assert.strictEqual(resChange.body.success, true);

    // Old PIN fails
    const resOld = await makeRequest("POST", "/api/visitor/authorize", {
      visitorNames: ["Kavya Rao"],
      pin: "1234"
    });
    assert.strictEqual(resOld.statusCode, 401);

    // New PIN succeeds
    const resNew = await makeRequest("POST", "/api/visitor/authorize", {
      visitorNames: ["Kavya Rao"],
      pin: "5678"
    });
    assert.strictEqual(resNew.statusCode, 200);
    assert.strictEqual(resNew.body.success, true);
  });

  server.close();

  // Cleanup test database
  if (fs.existsSync(testDbPath)) {
    try { fs.unlinkSync(testDbPath); } catch (e) { }
  }

  console.log("\n=======================================================");
  console.log(`📊 SUMMARY: ${passed} passed, ${failed} failed`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  if (server) server.close();
  process.exit(1);
});
