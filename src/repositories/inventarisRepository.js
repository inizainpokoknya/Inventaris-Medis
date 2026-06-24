// src/repositories/inventarisRepository.js
//
// SCoT Loop self-check #1: "Apakah query menggunakan parameterized statement
// (bukan string concatenation)? Jika tidak, perbaiki sebelum lanjut."
// -> SETIAP query di file ini memakai placeholder ($1, $2, ...), TIDAK ADA
//    string interpolation dari input user ke dalam SQL.
//
// SCoT Constraint output: "JANGAN mengembalikan field internal (cost_price,
// supplier_internal_notes)" -> kolom yang di-SELECT didaftarkan EKSPLISIT,
// tidak pernah `SELECT *`, sehingga cost_price tidak pernah keluar dari layer ini.

const pool = require('../config/db');

const PUBLIC_COLUMNS = `
  id, nama_obat, kode_ndc, jumlah_stok, satuan,
  lokasi_gudang, tanggal_kadaluwarsa, kategori, created_at, updated_at
`; // cost_price SENGAJA tidak disertakan di sini.

async function findById(id) {
  const query = `SELECT ${PUBLIC_COLUMNS} FROM inventaris_obat WHERE id = $1`;
  const { rows } = await pool.query(query, [id]);
  return rows[0] || null;
}

async function findByKodeNdc(kodeNdc) {
  const query = `SELECT ${PUBLIC_COLUMNS} FROM inventaris_obat WHERE kode_ndc = $1`;
  const { rows } = await pool.query(query, [kodeNdc]);
  return rows[0] || null;
}

/**
 * Pencarian dengan filter dinamis namun tetap 100% parameterized.
 * Setiap filter ditambahkan sebagai placeholder bernomor — TIDAK PERNAH
 * mengonkatenasi nilai filter langsung ke string query.
 */
async function search({ nama, kode_ndc, kategori, page, limit }) {
  const conditions = [];
  const values = [];
  let idx = 1;

  if (nama) {
    conditions.push(`nama_obat ILIKE $${idx++}`);
    values.push(`%${nama}%`);
  }
  if (kode_ndc) {
    conditions.push(`kode_ndc = $${idx++}`);
    values.push(kode_ndc);
  }
  if (kategori) {
    conditions.push(`kategori = $${idx++}`);
    values.push(kategori);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const dataQuery = `
    SELECT ${PUBLIC_COLUMNS}
    FROM inventaris_obat
    ${whereClause}
    ORDER BY nama_obat ASC
    LIMIT $${idx++} OFFSET $${idx++}
  `;
  const countQuery = `SELECT COUNT(*) AS total FROM inventaris_obat ${whereClause}`;

  const dataValues = [...values, limit, offset];

  const [dataResult, countResult] = await Promise.all([
    pool.query(dataQuery, dataValues),
    pool.query(countQuery, values),
  ]);

  return {
    items: dataResult.rows,
    total: Number(countResult.rows[0].total),
    page,
    limit,
  };
}

async function create(data) {
  const query = `
    INSERT INTO inventaris_obat
      (nama_obat, kode_ndc, jumlah_stok, satuan, lokasi_gudang, tanggal_kadaluwarsa, kategori)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING ${PUBLIC_COLUMNS}
  `;
  const values = [
    data.nama_obat,
    data.kode_ndc,
    data.jumlah_stok,
    data.satuan,
    data.lokasi_gudang,
    data.tanggal_kadaluwarsa,
    data.kategori,
  ];
  const { rows } = await pool.query(query, values);
  return rows[0];
}

/**
 * Update stok secara atomik menggunakan transaksi.
 * Dipakai oleh service layer yang juga menulis audit_log_stok pada
 * transaksi yang SAMA (lihat SCoT Branch #2: kategori NARKOTIKA wajib
 * audit log sebelum commit).
 *
 * @param {import('pg').PoolClient} client - koneksi transaksi yang sudah dibuka oleh service
 */
async function updateStokWithClient(client, id, jumlahBaru) {
  const query = `
    UPDATE inventaris_obat
    SET jumlah_stok = $1
    WHERE id = $2
    RETURNING ${PUBLIC_COLUMNS}
  `;
  const { rows } = await client.query(query, [jumlahBaru, id]);
  return rows[0] || null;
}

async function findByIdWithClient(client, id) {
  // FOR UPDATE -> row-level lock, mencegah race condition saat dua request
  // mengubah stok obat yang sama secara bersamaan (penting untuk akurasi stok medis).
  const query = `SELECT ${PUBLIC_COLUMNS}, jumlah_stok FROM inventaris_obat WHERE id = $1 FOR UPDATE`;
  const { rows } = await client.query(query, [id]);
  return rows[0] || null;
}

module.exports = {
  findById,
  findByKodeNdc,
  search,
  create,
  updateStokWithClient,
  findByIdWithClient,
};
