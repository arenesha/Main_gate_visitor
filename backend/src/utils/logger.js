/**
 * Safe logger that redacts sensitive parameters
 */
function maskSecret(str) {
  if (!str || typeof str !== "string") return "[REDACTED]";
  if (str.length <= 4) return "****";
  return str.slice(0, 2) + "****" + str.slice(-2);
}

const logger = {
  info: (msg, ...args) => {
    console.log(`[${new Date().toISOString()}] [INFO] ${msg}`, ...args);
  },
  warn: (msg, ...args) => {
    console.warn(`[${new Date().toISOString()}] [WARN] ${msg}`, ...args);
  },
  error: (msg, ...args) => {
    console.error(`[${new Date().toISOString()}] [ERROR] ${msg}`, ...args);
  },
  maskSecret
};

module.exports = logger;
