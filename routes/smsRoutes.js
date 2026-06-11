const express = require('express');
const router = express.Router();
const { parseAndPreview, parseAndSave } = require('../controllers/smsController');
const { protect } = require('../middleware/authMiddleware');

// Preview parsed SMS without saving
router.post('/parse', protect, parseAndPreview);

// Parse and save directly to DB
router.post('/save', protect, parseAndSave);

module.exports = router;