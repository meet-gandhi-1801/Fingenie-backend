const express = require('express');
const router = express.Router();
const {
  getMonthlySummary,
  getCategoryBreakdown,
  getSpendingTrend,
  getRecentTransactions
} = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');

router.get('/summary', protect, getMonthlySummary);
router.get('/categories', protect, getCategoryBreakdown);
router.get('/trend', protect, getSpendingTrend);
router.get('/recent', protect, getRecentTransactions);

module.exports = router;