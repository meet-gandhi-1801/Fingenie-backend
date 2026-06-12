const express = require('express');
const router = express.Router();
const { getInsights, getSubscriptions } = require('../controllers/insightController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getInsights);
router.get('/subscriptions', protect, getSubscriptions);

module.exports = router;