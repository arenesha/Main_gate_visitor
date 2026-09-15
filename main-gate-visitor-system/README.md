# GATEKEEPER — Main Gate Visitor Entry Authorization System

A complete, production-style, real-time automated visitor entry authorization system built with **Node.js + Express** (Backend), **Angular** (Frontend), **SQLite** (Persistent Database), **Nodemailer** (Real SMTP Email), **Twilio** (Real SMS), and **ExcelJS** (Automatic Excel Record Logging).

---

## 🏗 Exact System Flow

```
[Step 1] Visitor Names  +  Authorization PIN
                       ↓
[Step 2] Backend PIN Verification (bcrypt hash)
                       ↓
               PIN Valid? ──── No ────> [AUTHORIZATION NOT AUTHORIZED] (Flow stops)
                       │
                      Yes
                       ↓
[Step 3] Authorization Created (AUTH-YYYYMMDD-XXXXXX)
                       +
         REAL EMAIL (Gmail SMTP)  +  REAL SMS (Twilio) to Main Gate Security
                       ↓
[Step 4] Main Gate Security Verification Screen (POST /api/gate/verify)
         • Authorization ID exists
         • Status is AUTHORIZED
         • Visitor Name(s) match
         • Authorization PIN correct
         • Expiration window valid
         • Single-use only (blocks duplicate clearance)
                       ↓
               Cleared? ──── No ────> [ENTRY NOT AUTHORIZED]
                       │
                      Yes
                       ↓
               [ENTRY AUTHORIZED]
                       ↓
[Step 5] Automatically Appends Row to visitor-entry.xlsx
```

---

## 🔒 Only Two Visitor Inputs

The visitor entry screen strictly accepts ONLY:
1. **Visitor Name(s)** (single or multiple)
2. **Authorization PIN**

No additional visitor input fields exist.

---

## ⚙️ Environment Configuration (`.env`)

Create `backend/.env` based on `backend/.env.example`:

```ini
# Server Port (Default 8003 per specification)
PORT=8003
NODE_ENV=development
REAL_NOTIFICATIONS=true

# Security PIN
DEFAULT_PIN=1234
AUTHORIZATION_EXPIRY_MINUTES=300

# Email (Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-letter-google-app-password
SECURITY_EMAIL=main_gate_security@example.com

# SMS (Twilio)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
SECURITY_PHONE_NUMBER=+91xxxxxxxxxx
```

---

## 📧 Real Email Setup (Gmail App Password)

Google does **not** allow your personal Gmail password for SMTP connections. You must generate a **Google App Password**:

1. Open your [Google Account](https://myaccount.google.com/).
2. In the left navigation, select **Security**.
3. Under *How you sign in to Google*, ensure **2-Step Verification** is turned **ON**.
4. Search for **App passwords** (or go to `Security` → `2-Step Verification` → `App passwords`).
5. Enter an App Name (e.g. `Gatekeeper Security System`) and click **Create**.
6. Google will display a **16-character passcode** (e.g. `abcd efgh ijkl mnop`).
7. Copy this 16-character code into `backend/.env` as:
   ```ini
   SMTP_PASSWORD=abcdefghijklmnop
   ```
8. Save `backend/.env`.

---

## 📱 Real SMS Setup (Twilio)

1. Sign up for a free or production account at [Twilio Console](https://console.twilio.com/).
2. On your Twilio Dashboard, locate:
   - **Account SID** (starts with `AC...`)
   - **Auth Token**
3. Obtain a Twilio phone number under **Phone Numbers → Manage → Active numbers**.
4. In `backend/.env`, set:
   ```ini
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_real_auth_token
   TWILIO_PHONE_NUMBER=+12015550123
   SECURITY_PHONE_NUMBER=+919876543210
   ```
5. If using a Twilio Trial account, verify `SECURITY_PHONE_NUMBER` in your Twilio Verified Caller IDs.

---

## 🚀 Installation & Execution

### 1. Backend Installation & Start
```bash
cd backend
npm install
npm start
```
- The backend starts on **port 8003** (with dual-port 5000 support for local browser convenience).
- Health check: `http://localhost:8003/api/health`
- Diagnostic test status: `http://localhost:8003/api/test/status`

### 2. Run Comprehensive Automated Tests
```bash
cd backend
npm test
```
Executes all 10 verification test stages against the active database, covering valid authorizations, invalid PINs, mismatched names, expired authorizations, duplicate attempts, admin PIN updates, and error reporting.

---

## 🧪 Independent Test Endpoints

Test each provider independently without submitting visitor forms:

- **Email Delivery Test**:
  ```bash
  curl -X POST http://localhost:8003/api/test/email -H "Content-Type: application/json" -d "{\"to\":\"security@example.com\"}"
  ```
- **SMS Delivery Test**:
  ```bash
  curl -X POST http://localhost:8003/api/test/sms -H "Content-Type: application/json" -d "{\"to\":\"+1234567890\"}"
  ```
- **Check Configuration Readiness**:
  ```bash
  curl http://localhost:8003/api/test/status
  ```

---

## 📊 Automatic Excel Record

When gate clearance is verified:
- Row appended to: `records/visitor-entry.xlsx`
- Columns:
  1. `Visitor Name(s)`
  2. `Entry Date` (DD-MM-YYYY)
  3. `Entry Time` (HH:MM:SS)
  4. `Authorization Status` (`AUTHORIZED`)
  5. `Entry Status` (`ENTRY AUTHORIZED` — green bold)
  6. `Authorization Reference` (`AUTH-...`)
- No manual saving required.

---

## 🛠️ Comprehensive Troubleshooting Guide

### 1. Gmail Authentication Failure (`535 5.7.8 Username and Password not accepted`)
- **Cause**: Using your regular Gmail account password instead of a Google App Password, or 2-Step Verification was disabled.
- **Fix**: Re-generate a dedicated 16-character App Password from Google Account → Security → App Passwords and paste it into `SMTP_PASSWORD` in `backend/.env`.

### 2. SMTP Connection Timeout / Failure (`ETIMEDOUT` / `ECONNREFUSED`)
- **Cause**: Port 587 or 465 blocked by a firewall, ISP, or corporate proxy.
- **Fix**: Check that outbound connections on port 587 (TLS/STARTTLS) are permitted. Set `SMTP_PORT=587` and `SMTP_SECURE=false`. For SSL port 465, set `SMTP_PORT=465` and `SMTP_SECURE=true`.

### 3. Twilio Authentication Failure (`20003 Authentication Error`)
- **Cause**: Incorrect `TWILIO_ACCOUNT_SID` or `TWILIO_AUTH_TOKEN`.
- **Fix**: Verify your Account SID and Token directly in Twilio Console. Ensure no whitespace or quote characters were copied.

### 4. Twilio Phone Number Error (`21606 Invalid From Number`)
- **Cause**: `TWILIO_PHONE_NUMBER` does not belong to your Twilio account, or SMS capability is disabled.
- **Fix**: Use the E.164 formatted number (e.g. `+12015550123`) provided in Twilio Console → Active Numbers.

### 5. Invalid Destination Phone Number (`21211 Invalid To Phone Number`)
- **Cause**: Destination phone number not formatted in E.164.
- **Fix**: Include the `+` country code prefix (e.g. `+919876543210` or `+14155552671`).

### 6. SMS Not Received on Twilio Trial Account (`21608 Unverified Number`)
- **Cause**: Trial accounts can only send SMS to pre-verified numbers.
- **Fix**: Add the security phone number in Twilio Console → Phone Numbers → Manage → Verified Caller IDs.

### 7. Email Not Received
- **Cause**: Email delivered to Spam/Junk folder or recipient address misspelled.
- **Fix**: Check your Spam folder; test directly using `POST /api/test/email` and examine the terminal log for `[EMAIL] SENT: Message ID`.

### 8. Backend Not Running / Connection Refused
- **Cause**: Backend process stopped or crashed.
- **Fix**: Run `npm start` in `backend/` and verify the log prints `Main Gate Visitor Authorization Server running Listening on port: 8003`.

### 9. Missing `.env` Variables
- **Cause**: Backend running without `.env` or variables using placeholder strings.
- **Fix**: Inspect startup logs under `NOTIFICATION CREDENTIAL STATUS:` which highlights any missing variables.
