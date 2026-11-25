const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const errorLogPath = path.join(logDir, 'error.log');

function logError(err, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    message: err && err.message ? err.message : String(err),
    stack: process.env.NODE_ENV === 'production' ? undefined : (err && err.stack),
    ...context
  };
  try {
    fs.appendFileSync(errorLogPath, JSON.stringify(entry) + '\n');
  } catch (_) {
    // Fallback to stderr if file logging fails
  }
  console.error(`[ERROR] ${entry.timestamp} - ${entry.message}`);
}

module.exports = { logError };
