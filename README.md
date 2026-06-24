# Inventaris Medis API — Studi Kasus SCoT

Implementasi nyata dari prompt SCoT (Structured Chain-of-Thought) yang dirancang
sebagai jawaban Tugas 2. Proyek ini dibuat untuk menunjukkan bahwa setiap baris
pada prompt SCoT punya jejak yang dapat ditelusuri di kode — bukan sekadar teks
niat baik.

## Ringkasan Tugas

Tugas studi kasus ini terbagi menjadi dua bagian utama:

- TUGAS 1 — Analisis Risiko
  - Tujuan: Identifikasi tiga kerentanan fatal jika aplikasi dibangun menggunakan
    "pure vibe coding" tanpa review keamanan.
  - Contoh kerentanan yang diidentifikasi di tugas ini:
    1. Kebocoran data sensitif (mis. pelanggaran HIPAA) karena logging atau
       penyimpanan kredensial/PHI tanpa enkripsi.
    2. SQL Injection akibat query yang dikonstruksi dengan concatenation string
       dari input user.
    3. Kekurangan otorisasi/akses peran (role-based access control) sehingga
       pengguna dengan peran terbatas dapat melakukan aksi berbahaya (mis. POST/PUT/DELETE pada resource sensitif).
  - Output: Laporan singkat yang memetakan risiko dan mitigasi (mis. parameterized queries, enkripsi-at-rest, auditing, rate limiting).

- TUGAS 2 — Desain SCoT (Structured Chain-of-Thought)
  - Tujuan: Menulis ulang instruksi desain menggunakan kerangka SCoT sehingga
    implementasi backend mengikuti pola yang terstruktur dan dapat ditelusuri.
  - Komponen yang didesain:
    - Format Input-Output: spesifikasi bentuk request dan response, field wajib, tipe data, dan kolom yang tidak pernah diekspose (mis. `cost_price`).
    - Sequence/Branching: urutan middleware dan alur pengambilan keputusan (mis. `authenticate -> authorize -> validateBody -> controller`) serta branching untuk kasus spesifik (mis. PERAWAT ditolak untuk operasi tertentu, NARKOTIKA wajib audit log).
    - Security constraints: aturan wajib seperti enkripsi, penyimpanan secret di environment variables, pencatatan audit untuk transaksi sensitif, row-level locking, dan validasi ketat terhadap input mencurigakan.
  - Output: README ini dan implementasi kode (lihat tabel "Pemetaan Prompt SCoT -> Kode"), plus bukti uji manual yang mendemonstrasikan constraint yang ditetapkan.

## Cara Menjalankan

```bash
npm install
cp .env.example .env        # lalu isi DB_PASSWORD dan JWT_SECRET asli
psql -U postgres -d inventaris_medis -f schema.sql
npm run dev
```

## Pemetaan Prompt SCoT -> Kode (Traceability)

| Instruksi di Prompt SCoT | Diimplementasikan di | Bukti |
|---|---|---|
| Sequence: JWT -> role -> validasi input -> query -> output | `src/routes/inventarisRoutes.js` | Urutan middleware: `authenticate -> authorize -> validateBody -> controller` |
| Branch #1: PERAWAT ditolak 403 untuk POST/PUT/DELETE | `src/middleware/authorize.js` | Diuji: PERAWAT POST -> `403 FORBIDDEN_ROLE` |
| Branch #2: NARKOTIKA wajib audit log sebelum commit | `src/services/inventarisService.js` (`updateStok`) | `BEGIN` -> update stok -> insert audit log -> `COMMIT` (satu transaksi) |
| Branch #3: reject karakter mencurigakan, jangan sanitize-lalu-lanjut | `src/validators/inventarisValidator.js` (`SQLI_PATTERN`) | Diuji: query `nama=...; DROP TABLE...` -> `400 VALIDATION_ERROR` |
| Loop self-check #1: parameterized query, bukan concatenation | `src/repositories/inventarisRepository.js` | Semua query pakai `$1, $2, ...`, tidak ada template string berisi input user |
| Loop self-check #2: tidak bocorkan stack trace ke client | `src/middleware/errorHandler.js` | Diuji: route tak dikenal -> `404` generik tanpa detail internal |
| Constraint output: `cost_price` tidak pernah diekspos | `src/repositories/inventarisRepository.js` (`PUBLIC_COLUMNS`) | Kolom di-SELECT eksplisit, tidak pernah `SELECT *` |
| Constraint: tidak hardcode secret | `src/config/db.js` | Semua kredensial diambil dari `process.env` |
| Constraint: tidak log kredensial mentah | `src/config/logger.js` (`redact()`) | Field `password/token/jwt/secret` di-redact sebelum logging |
| Constraint: rate limiting | `src/server.js` (`express-rate-limit`) | 100 req / 15 menit per IP (global) |

## Catatan Desain Tambahan

- Row-level locking (`FOR UPDATE`) di `updateStok` mencegah race condition saat dua
  tenaga kesehatan mengubah stok obat yang sama secara bersamaan — penting untuk
  akurasi stok medis, terutama narkotika.
- `keterangan` wajib diisi khusus untuk NARKOTIKA saat update stok (validasi
  tambahan di service layer), memperkuat traceability "siapa, kapan, perubahan apa"
  yang diminta di Branch #2.
- Audit log tetap dicatat untuk kategori REGULAR juga (governance yang baik), tetapi
  hanya NARKOTIKA yang diberi validasi keras (wajib keterangan).

## Yang Belum Termasuk

- Endpoint DELETE (prompt fokus ke GET/POST/PUT).
- Refresh token flow — asumsi sistem auth sudah ada di luar modul ini (sesuai
  `[CONTEXT]`).
- Test suite otomatis (unit/integration) — verifikasi pada sesi ini dilakukan manual
  via `curl` untuk efisiensi, namun pola Service/Repository di atas sudah
  testable (dependency bisa di-mock).
