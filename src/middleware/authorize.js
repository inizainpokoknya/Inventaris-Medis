// src/middleware/authorize.js
// SCoT Branch (#1):
// "JIKA method adalah POST/PUT/DELETE -> wajib cek role == ADMIN_GUDANG atau APOTEKER.
//  JIKA role == PERAWAT -> tolak dengan HTTP 403, jangan proses lebih lanjut."
//
// Dibuat sebagai factory function agar reusable di berbagai route
// dengan daftar role yang berbeda-beda (RBAC declarative, bukan if-else tersebar).

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      // Harusnya tidak pernah terjadi jika authenticate() dijalankan duluan,
      // tapi defensive check tetap wajib (urutan middleware bisa salah di masa depan).
      return res.status(401).json({
        status: 'error',
        code: 'AUTH_REQUIRED',
        message: 'Autentikasi diperlukan sebelum otorisasi.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        code: 'FORBIDDEN_ROLE',
        message: 'Anda tidak memiliki izin untuk melakukan operasi ini.',
      });
    }

    return next();
  };
}

module.exports = authorize;
