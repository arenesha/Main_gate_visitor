# 🛡️ Main Gate Visitor Entry Authorization System

A complete, production-ready, locally runnable **Main Gate Visitor Entry Authorization System** built with **Node.js, Express, SQLite, Bcrypt PIN Hashing, Nodemailer (Gmail SMTP), and Twilio SMS**.

---

## 🌟 Features

- **Host Entry Authorization (`/`)**:
  - Add single or multiple visitor names dynamically (*Add Visitor*, *Remove Visitor*, *Clear All*).
  - Secure PIN Entry (`[ •••• ]` with visibility toggle).
  - Client sends requests securely to the backend (zero hardcoded PINs or credentials in frontend).
  - Animated, clear verdict cards with real-time Email & SMS delivery status badges.
- **PIN Verification & Security**:
  - Bcrypt PIN hashing with automatic initial seeding (Default PIN: `1234`).
  - Rate limiting to protect against brute-force attacks (max 10 attempts per 5-minute window).
  - HTTP Security headers via Helmet and CORS support.
  - Safe logging that never outputs PINs, tokens, or SMTP passwords.
- **Automated Dual Notifications**:
  - **Email Service (`services/email.service.js`)**: Nodemailer integration with Google App Password SMTP support and rich HTML/text security templates.
  - **SMS Service (`services/sms.service.js`)**: Twilio SMS provider integration.
  - **Development/Mock Mode**: Works out of the box locally without crashing if credentials are unconfigured.
  - **Fault-Tolerant Authorization**: Notification failure does **not** undo a successful PIN authorization.
- **Admin PIN Management (`/admin`)**:
  - Securely update authorization PIN by validating the current PIN first.
  - Real-time system health and configuration indicators.
- **Audit & Entry History (`/history`)**:
  - Live visitor authorization log stored in SQLite database.

---

## 📁 Project Architecture

```
visitor-entry-system/
├── backend/
│   └── src/
│       ├── controllers/
│       │   ├── admin.controller.js      # PIN updates & system status
│       │   └── visitor.controller.js    # Authorization logic & dispatch
│       ├── database/
│       │   └── db.js                    # SQLite connection & schema init
│       ├── middleware/
│       │   ├── rateLimiter.js           # Brute force protection
│       │   └── validator.js             # Request body validators
│       ├── routes/
│       │   ├── admin.routes.js          # Admin endpoints (/api/admin/*)
│       │   └── visitor.routes.js        # Visitor endpoints (/api/visitor/*)
│       ├── services/
│       │   ├── email.service.js         # Nodemailer SMTP email service
│       │   └── sms.service.js           # Twilio SMS service
│       ├── utils/
│       │   └── logger.js                # Safe credential-redacted logger
│       ├── app.js                       # Express app configuration
│       └── server.js                    # Main server entry point
├── frontend/
│   ├── js/
│   │   ├── admin.js                     # Admin UI logic
│   │   ├── app.js                       # Authorization UI logic
│   │   └── history.js                   # History table UI logic
│   ├── services/
│   │   └── visitor.service.js           # Central frontend API client
│   ├── styles/
│   │   └── style.css                    # Premium glassmorphism design system
│   ├── admin.html                       # Admin PIN Management UI
│   ├── history.html                     # Entry Log UI
│   └── index.html                       # Visitor Authorization UI
├── tests/
│   └── backend.test.js                  # Automated test suite
├── .env.example                         # Environment configuration template
├── .gitignore                           # Git ignore rules
├── package.json                         # Project metadata and dependencies
└── README.md                            # Complete documentation
```

---

## ⚙️ Prerequisites

- **Node.js**: v18.x or later (tested on v24.x)
- **npm**: v9.x or later

---

## 🚀 Quick Start (Local Setup)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
# Windows PowerShell
copy .env.example .env

# Linux / macOS
cp .env.example .env
```

### 3. Run the Application
```bash
npm start
```
> The server will start on **`http://localhost:8003`**.

---

## 🌐 Application Web Pages

| Page | URL | Description |
| :--- | :--- | :--- |
| **Visitor Authorization** | `http://localhost:8003/` | Host inputs visitor name(s) and PIN to authorize entry |
| **Entry Audit Log** | `http://localhost:8003/history` | Real-time log of all authorized entries |
| **Admin PIN Management** | `http://localhost:8003/admin` | Update active authorization PIN |
| **API Health Check** | `http://localhost:8003/api/health` | Backend status verification |

---

## 🔑 Notification Provider Setup

### 1. Gmail SMTP Setup (Google App Password)
To send real emails via Gmail:
1. Log into your Google Account and navigate to [Google Account Security](https://myaccount.google.com/security).
2. Ensure **2-Step Verification** is turned ON.
3. In the search bar at the top of Google Account, search for **App passwords**.
4. Create an app name (e.g. `Gatekeeper System`) and click **Create**.
5. Copy the generated **16-character password**.
6. Set the values in your `.env` file:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=xxxx-xxxx-xxxx-xxxx
   AUTH_EMAIL=recipient-security-gate@example.com
   ```

---

### 2. Twilio SMS Setup
To send real SMS alerts:
1. Sign up or log into [Twilio Console](https://console.twilio.com/).
2. Copy your **Account SID** and **Auth Token**.
3. Obtain a Twilio phone number with SMS capabilities.
4. Set the values in your `.env` file:
   ```env
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token_here
   TWILIO_PHONE_NUMBER=+1234567890
   AUTHORIZED_PHONE=+919876543210
   ```
*(Note: If Twilio or SMTP credentials are not filled, the application runs automatically in Mock/Dev mode so you can test all UI & API workflows immediately without errors)*.

---

## 📡 API Documentation

### 1. Authorize Visitor Entry
- **Endpoint**: `POST /api/visitor/authorize`
- **Request Body**:
  ```json
  {
    "visitorNames": ["Rahul Patil", "Sneha Sharma"],
    "pin": "1234"
  }
  ```
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Visitor entry authorized successfully.",
    "id": 1,
    "authorizationStatus": "AUTHORIZED",
    "visitorNames": ["Rahul Patil", "Sneha Sharma"],
    "date": "13 September 2026",
    "time": "03:10 PM",
    "emailSent": true,
    "smsSent": true
  }
  ```
- **Invalid PIN Response (`401 Unauthorized`)**:
  ```json
  {
    "success": false,
    "message": "Invalid authorization PIN.",
    "emailSent": false,
    "smsSent": false
  }
  ```

---

### 2. Change Authorization PIN
- **Endpoint**: `POST /api/admin/change-pin`
- **Request Body**:
  ```json
  {
    "currentPin": "1234",
    "newPin": "5678"
  }
  ```
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Authorization PIN updated successfully."
  }
  ```

---

### 3. Retrieve Entry History
- **Endpoint**: `GET /api/visitor/history`
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "entries": [
      {
        "id": 1,
        "visitorNames": ["Rahul Patil", "Sneha Sharma"],
        "authorizationStatus": "AUTHORIZED",
        "authorizedAt": "2026-09-13T15:10:00.000Z",
        "emailSent": true,
        "smsSent": true,
        "createdAt": "2026-09-13T15:10:00.000Z"
      }
    ]
  }
  ```

---

## 🧪 Automated Testing

Run the full end-to-end automated test suite:
```bash
npm test
```
The suite tests:
- Valid PIN authorization (single and multiple visitors)
- Rejection of invalid PIN without notification dispatch
- Validation of empty visitor names and missing PIN
- Admin PIN change validation and hash updating
- Historical entry querying
- System health and rate limiting

---

## 🛠️ Troubleshooting

1. **Port 8003 already in use**:
   Change `PORT=8004` in your `.env` file or terminate the running process on port 8003:
   ```powershell
   # Windows PowerShell
   Get-Process -Id (Get-NetTCPConnection -LocalPort 8003).OwningProcess | Stop-Process -Force
   ```
2. **Gmail SMTP Error `535-5.7.8 Username and Password not accepted`**:
   Ensure you are using a **16-character Google App Password**, not your personal Google account password.
3. **Database locked**:
   SQLite creates `database.sqlite` in the root folder. Ensure the application process has write permissions in the working directory.

---

## 🔒 Security Best Practices Implemented

1. **Bcrypt Password/PIN Hashing**: PINs are never stored in plaintext in the database or client.
2. **Brute Force Protection**: Rate limiter temporarily blocks repeated invalid PIN guesses.
3. **Zero Frontend Secret Leaks**: SMTP passwords, Twilio tokens, and PIN hashes are kept exclusively on the server.
4. **Helmet Security Headers**: Protects against clickjacking, MIME-sniffing, and cross-site scripting.
5. **Input Sanitization**: Multi-visitor array filtering and validation prevents injection and empty entry submissions.
