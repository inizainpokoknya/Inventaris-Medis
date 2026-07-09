Nama: Zain Ahmad Suraiban
Kelas: IF 04-01
NIM: 103072430001

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
    - Sequence/Branching: urutan middleware dan alur pengambilan keputusan (mis. `authenticate -> authorize -> validateBody -> controller`) serta branching untuk kasus spesifik (mis. PERAWAT ditol[...]
    - Security constraints: aturan wajib seperti enkripsi, penyimpanan secret di environment variables, pencatatan audit untuk transaksi sensitif, row-level locking, dan validasi ketat terhadap in[...]
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
| Branch #3: reject karakter mencurigakan, jangan sanitize-lalu-lanjut | `src/validators/inventarisValidator.js` (`SQLI_PATTERN`) | Diuji: query `nama=...; DROP TABLE...` -> `400 VALIDATION_ERROR`[...]
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


WAWASAN GLOBAL TIK Tugas 1: Analisis Risiko (3 Kerentanan Fatal Akibat Pure Vibe Coding) Jika sistem inventaris medis rumah sakit ini dibangun menggunakan metode Pure Vibe Coding (mendelegasikan implementasi teknis sepenuhnya kepada AI tanpa pengawasan, bersifat codeagnostic, dan tanpa security constraints yang eksplisit), 3 kerentanan fatal yang akan muncul berdasarkan dokumen adalah: Tingkat Kerentanan Keamanan yang Ekstrem (Hingga 91.5%) Dampak: Aplikasi yang murni dibangun via Vibe Coding memiliki tingkat kerentanan keamanan mencapai 91.5%. Tanpa pagar pengaman yang ketat, aplikasi ini sangat rentan terhadap serangan seperti Cross-Site Scripting (XSS) yang risikonya meningkat 2.74x lipat, Injections (seperti SQL Injection pada data inventaris), Auth Bypass (kebocoran hak akses), hingga kebocoran data sensitif (Data Leak) pasien atau rumah sakit yang melanggar hukum medis. Ledakan Technical Debt & Bug Resolution yang Sangat Lama (3.8x Lebih Lama) Dampak: AI cenderung melakukan duplikasi pola copy-paste hingga 8x lipat tanpa abstraksi yang benar. Jika terjadi bug pada sistem inventaris medis (misal: kesalahan pencatatan stok obat kritis), waktu perbaikannya (Time-to-Repair) menjadi 3.8x lebih lama karena kode "ajaib" buatan AI tersebut tidak dipahami arsitekturnya oleh pemelihara manusia, ditambah volume refactoring yang anjlok di bawah 10% karena developer takut merusak sistem. Comprehension Gap & Kegagalan Sistem di Jalur Produksi (Production) Dampak: Risiko terbesar terjadi saat developer langsung men-deploy kode ke tingkat production tanpa memahaminya secara utuh. Tanpa adanya Automated Evaluation Gates atau pengujian berbasis Deterministic & Probabilistic Testing (mengunci seed dan temperature), output AI akan bersifat probabilistik (flaky tests). Sistem inventaris bisa berjalan normal saat testing, namun gagal secara acak di rumah sakit saat menangani data riil. Tugas 2: Desain SCoT (Structured Chain-of-Thought) Untuk menjinakkan sifat non-deterministik AI, berikut adalah penulisan ulang instruksi menggunakan arsitektur logika Structured Chain-of-Thought (SCoT) yang dipadukan dengan pola Task-Context-Constraint (TCC) sesuai standar Enterprise: Markdown # PROMPT ARCHITECTURE: MEDICAL INVENTORY SYSTEM REST API [TASK] Membangun endpoint REST API untuk manajemen autentikasi pengguna dan manipulasi data inventaris medis rumah sakit. [CONTEXT] - Environment: Node.js dengan database PostgreSQL yang sudah ada. - Autentikasi: Menggunakan JSON Web Token (JWT). - Paradigma: Mengikuti spesifikasi OpenAPI / RESTful API. [STRUCTURED CHAIN-OF-THOUGHT (SCOT)] 1. SEQUENCE (Dekomposisi Masalah) a. Buat fungsi validasi input request (sanitasi data dari XSS dan Injections). b. Implementasikan fungsi autentikasi berbasis Role-Based Access Control (RBAC). c. Buat fungsi enkripsi untuk payload data medis sensitif sebelum disimpan ke database. d. Kembalikan respons dalam format terstruktur. 2. BRANCH (Logika Kondisional / If-Else) IF (request.user.role == 'Admin' ATAU request.user.role == 'Dokter/Apoteker') { Izinkan akses untuk melihat dan mengubah data inventaris medis (Read/Write). } ELSE IF (request.user.role == 'Staf_Umum') { Hanya izinkan akses membaca data stok (Read-Only). } ELSE { Kembalikan status HTTP 403 (Forbidden) dengan Error Auth Bypass Prevention. } IF (input.data == 'Sensitif/Data_Pasien_HIPAA') { Wajib jalankan PROCESS 1: Enkripsi dengan algoritma standar korporat sebelum masuk database. } ELSE { Jalankan PROCESS 2: Enkripsi standar log inventaris. } 3. LOOP (Verifikasi Berulang / For-While) - Lakukan iterasi pengujian (Loop Verification) pada setiap fungsi kriptografi dan sanitasi yang dihasilkan.  - Pastikan tidak ada satupun fungsi yang meloloskan karakter SQL Injection baku sebelum menghasilkan output akhir. [CONSTRAINTS (Pagar Pengaman Keamanan & Format)] - SECURITY: Wajib menerapkan Rate Limiting, Input Validation berbasis OWASP Top 10, dan 2FA. - PRIVACY: Wajib menggunakan algoritma bcrypt dengan salt rounds 12 untuk password. Dilarang keras melakukan hardcoding secret keys atau mencetak log kredensial/data pasien ke konsol. - FORMAT OUTPUT: Paksa AI untuk HANYA mengembalikan kode fungsional beserta dokumentasi JSON yang valid, tanpa teks penjelasan kasual (Zero-shot casual bypass). Insight Penutup: Dengan menerapkan disiplin SCoT dan menjauhi Pure Vibe Coding, performa eksekusi kode backend medis ini secara empiris dapat meningkat dan bebas bug hingga 13.79%.
