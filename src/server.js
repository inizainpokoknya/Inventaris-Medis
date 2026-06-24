// src/server.js
//
// Constraint SCoT: "WAJIB rate limiting pada endpoint pencarian (mitigasi DoS/brute force)."
// Diterapkan secara global di sini untuk SEMUA endpoint, sekaligus melindungi
// rute autentikasi dari brute force token-guessing.
//
// Urutan middleware: cors -> helmet -> rateLimit -> json parser -> routes -> errorHandler
// (sesuai pola standar Express dari skill fullstack-expert).

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const inventarisRoutes = require('./routes/inventarisRoutes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { logger } = require('./config/logger');

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : false,
    credentials: true,
  })
);
app.use(helmet());

// Rate limiter global: 100 request / 15 menit per IP.
// Mencegah DoS sederhana dan brute-force pada endpoint manapun.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Terlalu banyak permintaan. Coba lagi nanti.',
  },
});
app.use(globalLimiter);

app.use(express.json({ limit: '1mb' })); // limit body size, cegah payload DoS

app.use('/api/inventaris', inventarisRoutes);

app.use(notFoundHandler);
app.use(errorHandler); // WAJIB paling akhir -- error handler harus middleware terakhir

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Inventaris Medis API berjalan di port ${PORT}`);
});

module.exports = app;
