const { generateInsights } = require('../services/insightGenerator');
const { detectSubscriptions } = require('../services/subscriptionDetector');

// @route GET /api/insights
const getInsights = async (req, res) => {
  try {
    const insights = await generateInsights(req.user._id);
    res.json({
      count: insights.length,
      insights
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route GET /api/insights/subscriptions
const getSubscriptions = async (req, res) => {
  try {
    const subscriptions = await detectSubscriptions(req.user._id);

    // Calculate total monthly cost
    const totalMonthly = subscriptions
      .filter(s => s.frequency === 'Monthly')
      .reduce((sum, s) => sum + s.amount, 0);

    res.json({
      count: subscriptions.length,
      totalMonthlyCost: totalMonthly,
      totalAnnualCost: Math.round(totalMonthly * 12),
      subscriptions
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getInsights, getSubscriptions };