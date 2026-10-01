import http from 'http';
import { sendVisitorPassEmail, sendGuardActivationEmail, sendGuardAlertEmail } from './emailService.js';

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

  // 1. Dispatch Visitor Pass Email & Guard Alert Email
  if (req.url === '/api/dispatch-email' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const passData = JSON.parse(body);

        // A. Send Visitor Pass Email (if visitor email is provided)
        let visitorResult = null;
        if (passData.visitor_email && passData.visitor_email.includes('@')) {
          visitorResult = await sendVisitorPassEmail(passData);
        }

        // B. Send the exact [GATE ALERT] email to Guard Desk (arenesha20@gmail.com only)
        const guardAlertRes = await sendGuardAlertEmail({
          ...passData,
          guard_email: 'arenesha20@gmail.com'
        });

        const hasVisitor = passData.visitor_email && passData.visitor_email.includes('@');
        const visitorOk = !hasVisitor || (visitorResult && visitorResult.success);
        const guardOk = guardAlertRes && guardAlertRes.success;
        const allSuccess = Boolean(visitorOk && guardOk);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: allSuccess,
          visitor_email: passData.visitor_email || null,
          guard_email: 'arenesha20@gmail.com',
          visitor: visitorResult, 
          guard: guardAlertRes 
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 2. Dispatch Guard Access Activation Email
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
