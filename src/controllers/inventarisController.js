// src/controllers/inventarisController.js
//
// Controller HANYA menangani HTTP request/response. Tidak ada query DB
// atau business logic di sini -- semua didelegasikan ke service layer.
// Setiap fungsi dibungkus try/catch yang melempar ke next(err), ditangani
// oleh error handler global (lihat src/middleware/errorHandler.js) sehingga
// stack trace TIDAK PERNAH bocor ke response client.

const service = require('../services/inventarisService');

async function getOne(req, res, next) {
  try {
    const obat = await service.getById(req.params.id);
    res.status(200).json({ status: 'success', data: obat });
  } catch (err) {
    next(err);
  }
}

async function search(req, res, next) {
  try {
    const result = await service.searchObat(req.validatedQuery);
    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const obat = await service.createObat(req.validatedBody);
    res.status(201).json({ status: 'success', data: obat });
  } catch (err) {
    next(err);
  }
}

async function updateStok(req, res, next) {
  try {
    const { perubahan, keterangan } = req.validatedBody;
    const updated = await service.updateStok({
      obatId: req.params.id,
      perubahan,
      keterangan,
      userId: req.user.id,
      userRole: req.user.role,
    });
    res.status(200).json({ status: 'success', data: updated });
  } catch (err) {
    next(err);
  }
}

module.exports = { getOne, search, create, updateStok };
