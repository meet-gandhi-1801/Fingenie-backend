const Transaction = require('../models/Transaction');

// @route  GET /api/dashboard/summary
// @desc   Get this month's income, expenses, savings
const getMonthlySummary = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const transactions = await Transaction.find({
      user: req.user._id,
      date: { $gte: startOfMonth, $lte: endOfMonth }
    });

    let totalIncome = 0;
    let totalExpenses = 0;
    let totalInvestments = 0;

    transactions.forEach(t => {
      if (t.type === 'credit') {
        totalIncome += t.amount;
      } else if (t.category === 'Investment') {
        totalInvestments += t.amount;
      } else {
        totalExpenses += t.amount;
      }
    });

    const cashSavings = totalIncome - totalExpenses - totalInvestments;
    const totalWealthBuilt = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0
  ? ((cashSavings) / totalIncome * 100).toFixed(1)
  : 0;

const trueSavingsRate = totalIncome > 0
  ? (totalWealthBuilt / totalIncome * 100).toFixed(1)
  : 0;

    res.json({
      month: now.toLocaleString('default', { month: 'long', year: 'numeric' }),
      totalIncome,
      totalExpenses,
      totalInvestments,
      cashSavings,
      totalWealthBuilt,
      cashSavingsRate: `${savingsRate}%`,
      trueSavingsRate: `${trueSavingsRate}%`,
      transactionCount: transactions.length
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  GET /api/dashboard/categories
// @desc   Spending breakdown by category this month
const getCategoryBreakdown = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // MongoDB aggregation pipeline
    const breakdown = await Transaction.aggregate([
      {
        // Filter: only this user, this month, only debits
        $match: {
          user: req.user._id,
          date: { $gte: startOfMonth },
          type: 'debit'
        }
      },
      {
        // Group by category and sum amounts
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        // Sort by total descending
        $sort: { total: -1 }
      }
    ]);

    // Calculate total to get percentages
    const grandTotal = breakdown.reduce((sum, item) => sum + item.total, 0);

    const result = breakdown.map(item => ({
      category: item._id,
      total: item.total,
      count: item.count,
      percentage: grandTotal > 0
        ? ((item.total / grandTotal) * 100).toFixed(1)
        : 0
    }));

    res.json({
      totalExpenses: grandTotal,
      breakdown: result
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  GET /api/dashboard/trend
// @desc   Last 6 months spending trend
const getSpendingTrend = async (req, res) => {
  try {
    const now = new Date();

    // Get start of 6 months ago
    const sixMonthsAgo = new Date(
      now.getFullYear(),
      now.getMonth() - 5,
      1
    );

    const trend = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
          date: { $gte: sixMonthsAgo },
          type: 'debit'
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' }
          },
          totalExpenses: { $sum: '$amount' },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Format the result nicely
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    const result = trend.map(item => ({
      month: months[item._id.month - 1],
      year: item._id.year,
      totalExpenses: item.totalExpenses,
      transactionCount: item.transactionCount
    }));

    res.json(result);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  GET /api/dashboard/recent
// @desc   Get last 5 transactions
const getRecentTransactions = async (req, res) => {
  try {
    const recent = await Transaction.find({ user: req.user._id })
      .sort({ date: -1 })
      .limit(5);

    res.json(recent);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getMonthlySummary,
  getCategoryBreakdown,
  getSpendingTrend,
  getRecentTransactions
};