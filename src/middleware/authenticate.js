// src/middleware/authenticate.js
// SCoT Sequence step (b): Validasi JWT — dijalankan SEBELUM business logic apapun.

const jwt = require('jsonwebtoken');
const { logger } = require('../config/logger');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      status: 'error',
      code: 'AUTH_HEADER_MISSING',
      message: 'Token otorisasi tidak ditemukan.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // payload diharapkan berisi: { sub: userId, role: 'ADMIN_GUDANG' | 'APOTEKER' | 'PERAWAT' }
    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch (err) {
    // Constraint: jangan bocorkan detail teknis JWT (expired vs malformed vs invalid signature)
    // ke client — cukup informasi generik untuk mencegah token-probing attack.
    logger.warn('JWT verification failed', { reason: err.name });
    return res.status(401).json({
      status: 'error',
      code: 'AUTH_TOKEN_INVALID',
      message: 'Token tidak valid atau sudah kedaluwarsa.',
    });
  }
}

module.exports = authenticate;
