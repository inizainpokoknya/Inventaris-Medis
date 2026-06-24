// src/routes/inventarisRoutes.js
//
// SCoT Sequence: "Terima request -> Validasi JWT -> Validasi role/otorisasi ->
// Validasi & sanitasi input -> Eksekusi query -> Format output -> Kirim response."
//
// Urutan middleware di setiap route DI BAWAH INI mengikuti urutan tersebut
// secara harfiah. authenticate() selalu duluan, baru authorize(), baru
// validateBody/validateQuery, baru controller.

const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const controller = require('../controllers/inventarisController');
const {
  createObatSchema,
  updateStokSchema,
  searchQuerySchema,
  validateBody,
  validateQuery,
} = require('../validators/inventarisValidator');

const router = express.Router();

// GET /api/inventaris?nama=...&kategori=...
// Semua role (ADMIN_GUDANG, APOTEKER, PERAWAT) boleh membaca stok --
// PERAWAT hanya dibatasi dari mutasi (POST/PUT), sesuai Branch #1.
router.get(
  '/',
  authenticate,
  validateQuery(searchQuerySchema),
  controller.search
);

router.get('/:id', authenticate, controller.getOne);

// POST /api/inventaris -- registrasi obat baru.
// Branch #1: hanya ADMIN_GUDANG atau APOTEKER.
router.post(
  '/',
  authenticate,
  authorize('ADMIN_GUDANG', 'APOTEKER'),
  validateBody(createObatSchema),
  controller.create
);

// PUT /api/inventaris/:id/stok -- stok masuk (perubahan positif) atau
// stok keluar/dispensing (perubahan negatif).
// Branch #1: hanya ADMIN_GUDANG atau APOTEKER (PERAWAT ditolak 403 di sini).
// Branch #2 (kategori NARKOTIKA -> wajib audit log) ditegakkan di service layer.
router.put(
  '/:id/stok',
  authenticate,
  authorize('ADMIN_GUDANG', 'APOTEKER'),
  validateBody(updateStokSchema),
  controller.updateStok
);

module.exports = router;
