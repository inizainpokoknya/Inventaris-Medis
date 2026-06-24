// src/validators/inventarisValidator.js
// SCoT Sequence step (d): Validasi & sanitasi input.
// SCoT Branch (#3):
// "JIKA input mengandung karakter non-alfanumerik mencurigakan (', ;, --, /*)
//  -> tolak request sebagai invalid input, JANGAN sanitize-lalu-lanjut — reject langsung."

const { z } = require('zod');

// Pola karakter yang mengindikasikan upaya SQL injection.
// Ini adalah pertahanan LAPIS KEDUA — pertahanan utama tetap parameterized query
// di repository layer. Validator ini menolak input mencurigakan SEBELUM
// mencapai query layer sama sekali (fail fast, reject don't sanitize).
const SQLI_PATTERN = /('|;|--|\/\*|\*\/|\bUNION\b|\bDROP\b|\bOR\s+1\s*=\s*1\b)/i;

const safeString = (maxLen) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maxLen)
    .refine((val) => !SQLI_PATTERN.test(val), {
      message: 'Input mengandung karakter atau pola yang tidak diizinkan.',
    });

const kodeNdcSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9-]{4,50}$/, 'Kode NDC harus alfanumerik (boleh tanda hubung).');

const createObatSchema = z.object({
  nama_obat: safeString(255),
  kode_ndc: kodeNdcSchema,
  jumlah_stok: z.number().int().nonnegative(),
  satuan: safeString(50),
  lokasi_gudang: safeString(100),
  tanggal_kadaluwarsa: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Format tanggal tidak valid (gunakan YYYY-MM-DD).',
  }),
  kategori: z.enum(['REGULAR', 'NARKOTIKA']),
});

const updateStokSchema = z.object({
  perubahan: z.number().int().refine((val) => val !== 0, {
    message: 'Perubahan stok tidak boleh nol.',
  }),
  // Wajib diisi bila aksi adalah pengurangan stok narkotika (dispensing),
  // diperiksa lebih lanjut di service layer (Branch #2 NARKOTIKA).
  keterangan: z.string().trim().max(500).optional(),
});

const searchQuerySchema = z.object({
  nama: safeString(255).optional(),
  kode_ndc: kodeNdcSchema.optional(),
  kategori: z.enum(['REGULAR', 'NARKOTIKA']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/**
 * Middleware factory: validasi body request terhadap skema Zod.
 * Mengikuti SCoT Loop self-check: setiap endpoint WAJIB lewat validator ini
 * sebelum query, tanpa kecuali.
 */
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Input tidak valid.',
        details: result.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    req.validatedBody = result.data;
    return next();
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Parameter query tidak valid.',
        details: result.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    req.validatedQuery = result.data;
    return next();
  };
}

module.exports = {
  createObatSchema,
  updateStokSchema,
  searchQuerySchema,
  validateBody,
  validateQuery,
};
