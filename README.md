# 🏢 AreneSHA Main Gate Visitor Entry Authorization System

A complete, production-grade **Main Gate Visitor Entry Authorization & Guard Checkpoint System** built with **Cloudflare Workers, Cloudflare D1 (Serverless SQLite), React 19 (Vite), Bcrypt PIN Hashing, Nodemailer (Gmail SMTP), and Twilio SMS**.

---

## 🌟 Key Features

- **Visitor Pass Registration (`/admin/invitations/create`)**:
  - Generate digital passes with secure 6-digit OTP codes and QR credentials.
  - Configurable Pass Validity Windows (Schedule From / Until).
  - Default Host and Office metadata pre-filled with easy inline editing.
  - Automatic dispatch of official email and SMS credentials.

- **Security Guard Terminal (`/gate`)**:
  - Camera-based QR Code Scanner with instant audio feedback.
  - 6-Digit PIN fallback for seamless check-in.
  - Visual verification with live ledger matching.
  - 1-Click Allow Entry or Deny Entry with logged incident reasons.

- **Admin Oversight & Pass Ledger (`/` & `/admin/invitations`)**:
  - Live visitor status tracking (Active, Entry Used, Expired).
  - Search by visitor name, PIN code, or host.
  - 1-Click Excel export (`.xlsx`) for compliance audits.
  - Active Guard management card with activation email dispatch.

- **Digital Pass View (`/invitation/:id`)**:
  - High-resolution scannable QR pass for visitors.
  - Shareable via WhatsApp, SMS, Email, or Print.
  - Real-time validity counter and checkpoint directions.

---

## 📁 Project Architecture

```
Main_Gate_Visitor/
├── src/
│   ├── worker.js            # Cloudflare Worker API & D1 Database queries
│   ├── emailService.js      # Gmail SMTP service & responsive HTML pass templates
│   ├── notifyServer.js      # Background notification dispatcher
│   └── logo.png             # Official company logo
├── frontend/
│   ├── src/
│   │   ├── components/      # Header, Sidebar, QR Scanner Modal, Status Badges
│   │   ├── pages/           # Dashboard, Create Pass, Visitor Ledger, Gate Terminal, History
│   │   ├── context/         # AuthContext & Session management
│   │   ├── utils/           # Excel export (.xlsx) & date formatters
│   │   ├── App.jsx          # Route configurations
│   │   └── main.jsx         # Vite entry point
│   ├── package.json         # Frontend dependencies (React, Vite, Lucide, XLSX)
│   └── vite.config.js       # Vite proxy & build configuration
├── migrations/
│   └── 0001_init.sql        # Cloudflare D1 SQLite database schema
├── wrangler.jsonc           # Cloudflare Workers & D1 database bindings
├── package.json             # Root scripts & dependencies
└── test-e2e.js              # Automated end-to-end integration test suite
```

---

## 🚀 Running Locally

### 1. Install Dependencies
```bash
npm install
cd frontend && npm install && cd ..
```

### 2. Run Database Migrations (Local D1)
```bash
npm run db:migrate:local
```

### 3. Start Development Server
```bash
npm start
```
This runs concurrently:
- **Backend**: Cloudflare Worker on `http://localhost:8788`
- **Notify Server**: Background SMTP Dispatcher on `http://localhost:8005`
- **Frontend**: React Vite UI on `http://localhost:5173`

---

## 🧪 Testing

Run the end-to-end test suite:
```bash
npm test
```

---

## 🌐 Production Deployment

Deploy to Cloudflare Workers with built-in assets:
```bash
npm run deploy
```
