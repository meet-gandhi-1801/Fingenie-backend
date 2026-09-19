const express = require('express');
const router = express.Router();
const {
  getInsights,
  getSubscriptions,
  markAsRead
} = require('../controllers/insightController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getInsights);
router.get('/subscriptions', protect, getSubscriptions);
router.patch('/:id/read', protect, markAsRead);

module.exports = router;