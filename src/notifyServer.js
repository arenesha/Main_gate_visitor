import http from 'http';
import { sendVisitorPassEmail, sendGuardActivationEmail, sendSecurityVisitorAlertEmail } from './emailService.js';

const PORT = 8005;

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // 1. Dispatch Visitor Pass Email (to Visitor)
  if (req.url === '/api/dispatch-email' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const passData = JSON.parse(body);
        const result = await sendVisitorPassEmail(passData);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 2. Dispatch Guard Access Activation Email (to Guard)
  if ((req.url === '/api/dispatch-guard-activation-email' || req.url === '/api/dispatch-guard-email') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const guardData = JSON.parse(body);
        const result = await sendGuardActivationEmail(guardData);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 3. Dispatch Real-time Guard/Security Alert (to arenesha20@gmail.com whenever visitor visits)
  if (req.url === '/api/dispatch-security-alert' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const alertData = JSON.parse(body);
        const result = await sendSecurityVisitorAlertEmail(alertData);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', service: 'Email Dispatcher' }));
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`✅ Automated Gmail SMTP Notification Dispatcher running on http://localhost:${PORT}`);
});
