function getRoot(req, res) {
  res.json({ status: 'ok', service: 'Medical Imaging DICOM API (Node)', version: '1.0.0' });
}

module.exports = { getRoot };