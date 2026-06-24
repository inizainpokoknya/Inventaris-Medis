// src/middleware/errorHandler.js
//
// SCoT Loop self-check #2: "Apakah ada try-catch yang menangani error tanpa
// membocorkan stack trace/struktur database ke response client?"
//
// Dengan error handler GLOBAL di satu tempat ini, jawabannya "ya, selalu" --
// tidak peduli endpoint mana yang error, klien tidak pernah melihat stack
// trace, nama kolom DB, atau detail driver pg. Detail lengkap hanya masuk
// ke logger internal.

const { logger, redact } = require('../config/logger');
const { AppError } = require('../services/inventarisService');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      code: err.code,
      message: err.message,
    });
  }

  // Error tak terduga (bug, koneksi DB putus, dll). Log detail lengkap
  // secara internal, tapi kirim pesan generik ke client.
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: redact(req.body),
  });

  return res.status(500).json({
    status: 'error',
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Terjadi kesalahan pada server. Tim teknis sudah diberi tahu.',
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    status: 'error',
    code: 'ROUTE_NOT_FOUND',
    message: `Endpoint ${req.method} ${req.path} tidak ditemukan.`,
  });
}

module.exports = { errorHandler, notFoundHandler };
