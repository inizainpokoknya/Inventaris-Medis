// src/repositories/auditLogRepository.js
//
// SCoT Branch (#2): "JIKA kategori obat == NARKOTIKA -> wajib catat log audit
// terpisah (siapa, kapan, perubahan apa) sebelum commit transaksi ke database."

async function insertWithClient(client, entry) {
  const query = `
    INSERT INTO audit_log_stok
      (obat_id, user_id, user_role, action, jumlah_sebelum, jumlah_setelah, keterangan)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, created_at
  `;
  const values = [
    entry.obatId,
    entry.userId,
    entry.userRole,
    entry.action,
    entry.jumlahSebelum,
    entry.jumlahSetelah,
    entry.keterangan || null,
  ];
  const { rows } = await client.query(query, values);
  return rows[0];
}

module.exports = { insertWithClient };
