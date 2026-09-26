const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const { protect } = require('../middleware/authMiddleware');
const {
    uploadImport,
    getImportStatus,
    confirmImport
} = require('../controllers/importController');

router.post('/', protect, upload.single('statement'), uploadImport);
router.get('/:jobId', protect, getImportStatus);
router.post('/:jobId/confirm', protect, confirmImport);

module.exports = router;
