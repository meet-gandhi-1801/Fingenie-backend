const multer = require('multer');

// Store files in memory, not disk — we process and discard
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['text/csv', 'application/pdf', 'application/vnd.ms-excel'];

  if (allowedTypes.includes(file.mimetype) ||
      file.originalname.endsWith('.csv') ||
      file.originalname.endsWith('.pdf')) {
    cb(null, true);
  } else {
    cb(new Error('Only CSV and PDF files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

module.exports = upload;