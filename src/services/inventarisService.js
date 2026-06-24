// src/services/inventarisService.js
//
// Lapisan business logic. Mengimplementasikan SCoT Branch (#2) secara penuh:
// perubahan stok obat NARKOTIKA dan penulisan audit log dieksekusi dalam
// SATU transaksi database (BEGIN...COMMIT/ROLLBACK) -- jika audit log gagal
// ditulis, perubahan stok ikut di-rollback. Ini mencegah skenario "stok
// narkotika berubah tapi tidak tercatat", celah utama untuk drug diversion
// (pencurian obat keras yang ditutupi manipulasi data).

const pool = require('../config/db');
const inventarisRepo = require('../repositories/inventarisRepository');
const auditLogRepo = require('../repositories/auditLogRepository');

class AppError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

async function getById(id) {
  const obat = await inventarisRepo.findById(id);
  if (!obat) {
    throw new AppError(404, 'OBAT_NOT_FOUND', 'Obat tidak ditemukan.');
  }
  return obat;
}

async function searchObat(filters) {
  return inventarisRepo.search(filters);
}

async function createObat(data) {
  const existing = await inventarisRepo.findByKodeNdc(data.kode_ndc);
  if (existing) {
    throw new AppError(409, 'KODE_NDC_DUPLICATE', 'Kode NDC sudah terdaftar.');
  }
  return inventarisRepo.create(data);
}

/**
 * Mengubah jumlah stok (bisa positif = stok masuk, atau negatif = stok keluar/dispensing).
 * Mengikuti SCoT Sequence + Branch secara berurutan:
 *   1. Lock baris obat (FOR UPDATE) agar tidak ada race condition.
 *   2. Hitung jumlah baru, validasi tidak boleh negatif.
 *   3. JIKA kategori == NARKOTIKA -> tulis audit log WAJIB dalam transaksi yang sama.
 *   4. Commit. Jika langkah manapun gagal -> rollback total.
 */
async function updateStok({ obatId, perubahan, keterangan, userId, userRole }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const obat = await inventarisRepo.findByIdWithClient(client, obatId);
    if (!obat) {
      throw new AppError(404, 'OBAT_NOT_FOUND', 'Obat tidak ditemukan.');
    }

    const jumlahSebelum = obat.jumlah_stok;
    const jumlahSetelah = jumlahSebelum + perubahan;

    if (jumlahSetelah < 0) {
      throw new AppError(
        422,
        'STOK_TIDAK_CUKUP',
        `Stok tidak cukup. Stok saat ini: ${jumlahSebelum}, diminta: ${Math.abs(perubahan)}.`
      );
    }

    // --- SCoT Branch (#2): kategori NARKOTIKA wajib audit log sebelum commit ---
    if (obat.kategori === 'NARKOTIKA') {
      if (!keterangan || keterangan.trim().length === 0) {
        throw new AppError(
          400,
          'KETERANGAN_WAJIB_NARKOTIKA',
          'Keterangan wajib diisi untuk perubahan stok obat kategori NARKOTIKA.'
        );
      }
    }

    const updated = await inventarisRepo.updateStokWithClient(client, obatId, jumlahSetelah);

    // Audit log ditulis untuk SEMUA kategori (governance baik), tapi WAJIB
    // dan diberi validasi ekstra untuk NARKOTIKA (lihat blok di atas).
    await auditLogRepo.insertWithClient(client, {
      obatId,
      userId,
      userRole,
      action: perubahan > 0 ? 'STOCK_IN' : 'STOCK_OUT',
      jumlahSebelum,
      jumlahSetelah,
      keterangan,
    });

    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  AppError,
  getById,
  searchObat,
  createObat,
  updateStok,
};
