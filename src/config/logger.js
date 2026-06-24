// src/config/logger.js
// Constraint SCoT: "Dilarang keras mencetak log kredensial" dan
// "tanpa membocorkan stack trace/struktur database ke response client"
// Logger ini untuk observability INTERNAL saja, tidak pernah dikirim ke client.

const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

/**
 * Helper untuk redact field sensitif sebelum logging.
 * Dipakai di error handler agar request body tidak pernah ter-log mentah
 * jika mengandung token/password/JWT.
 */
function redact(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const SENSITIVE_KEYS = ['password', 'token', 'authorization', 'jwt', 'secret'];
  const clone = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const key of Object.keys(clone)) {
    if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
      clone[key] = '[REDACTED]';
    } else if (typeof clone[key] === 'object') {
      clone[key] = redact(clone[key]);
    }
  }
  return clone;
}

module.exports = { logger, redact };
