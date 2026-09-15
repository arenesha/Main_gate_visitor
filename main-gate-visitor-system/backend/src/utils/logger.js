/**
 * Structured backend logging utility
 * Masks secrets (PIN, passwords, tokens)
 */

function sanitize(msg) {
  if (typeof msg !== 'string') return msg;
  return msg
    .replace(/(password|token|pin|secret|auth)\s*[:=]\s*["']?[^"'\s,]+["']?/gi, '$1: [REDACTED]')
    .replace(/\b\d{4,6}\b(?=.*(?:pin|pass))/gi, '[REDACTED]');
}

const logger = {
  info: (msg, ...args) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [INFO]: ${sanitize(msg)}`, ...args);
  },
  warn: (msg, ...args) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [WARN]: ${sanitize(msg)}`, ...args);
  },
  error: (msg, ...args) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [ERROR]: ${sanitize(msg)}`, ...args);
  },
  structuredAuthLog: ({ id, emailStatus, emailMsgId, smsStatus, smsMsgId, gateStatus }) => {
    console.log('\n=============================================');
    console.log('AUTHORIZATION RECORD PROCESSED');
    console.log(`ID:     ${id}`);
    console.log('EMAIL:');
    console.log(`  Status:     ${emailStatus}`);
    if (emailMsgId) console.log(`  Message ID: ${emailMsgId}`);
    console.log('SMS:');
    console.log(`  Status:     ${smsStatus}`);
    if (smsMsgId) console.log(`  Message ID: ${smsMsgId}`);
    console.log(`GATE:   ${gateStatus}`);
    console.log('=============================================\n');
  }
};

module.exports = logger;
