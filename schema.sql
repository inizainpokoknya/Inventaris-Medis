-- ============================================================
-- SCHEMA: Inventaris Medis
-- Mengimplementasikan [CONTEXT] dari SCoT prompt:
-- - kategori REGULAR/NARKOTIKA membedakan jalur audit (lihat BRANCH #2)
-- - audit_log terpisah dari tabel utama agar immutable & traceable
-- ============================================================

CREATE TYPE kategori_obat AS ENUM ('REGULAR', 'NARKOTIKA');
CREATE TYPE user_role AS ENUM ('ADMIN_GUDANG', 'APOTEKER', 'PERAWAT');
CREATE TYPE audit_action AS ENUM ('STOCK_IN', 'STOCK_OUT', 'CREATE', 'UPDATE');

CREATE TABLE inventaris_obat (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_obat       VARCHAR(255) NOT NULL,
    kode_ndc        VARCHAR(50) NOT NULL UNIQUE,
    jumlah_stok     INTEGER NOT NULL CHECK (jumlah_stok >= 0),
    satuan          VARCHAR(50) NOT NULL,
    lokasi_gudang   VARCHAR(100) NOT NULL,
    tanggal_kadaluwarsa DATE NOT NULL,
    kategori        kategori_obat NOT NULL DEFAULT 'REGULAR',
    cost_price      NUMERIC(12, 2),  -- field internal, TIDAK PERNAH diekspos via API (lihat Constraint output)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index wajib di kolom yang sering di-query (WHERE / ORDER BY)
CREATE INDEX idx_inventaris_nama_obat ON inventaris_obat (nama_obat);
CREATE INDEX idx_inventaris_kode_ndc ON inventaris_obat (kode_ndc);
CREATE INDEX idx_inventaris_kategori ON inventaris_obat (kategori);
CREATE INDEX idx_inventaris_kadaluwarsa ON inventaris_obat (tanggal_kadaluwarsa);

-- Tabel audit log TERPISAH, khusus wajib diisi untuk kategori NARKOTIKA
-- sebelum transaksi di-commit (lihat SCoT Branch #2)
CREATE TABLE audit_log_stok (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    obat_id         UUID NOT NULL REFERENCES inventaris_obat(id),
    user_id         UUID NOT NULL,
    user_role       user_role NOT NULL,
    action          audit_action NOT NULL,
    jumlah_sebelum  INTEGER NOT NULL,
    jumlah_setelah  INTEGER NOT NULL,
    keterangan      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_obat_id ON audit_log_stok (obat_id);
CREATE INDEX idx_audit_created_at ON audit_log_stok (created_at DESC);

-- Trigger: auto-update updated_at setiap kali baris diubah
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inventaris_updated_at
BEFORE UPDATE ON inventaris_obat
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
