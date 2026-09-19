const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const { uploadStatement, confirmStatement } = require('../controllers/statementController');
const { protect } = require('../middleware/authMiddleware');

router.post('/upload', protect, upload.single('statement'), uploadStatement);
router.post('/confirm', protect, confirmStatement);

module.exports = router;