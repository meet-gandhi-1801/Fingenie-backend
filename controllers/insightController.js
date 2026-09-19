const Insight = require('../models/Insight');

// @route GET /api/insights
// Now just fetches from DB — instant response
const getInsights = async (req, res) => {
  try {
    const insights = await Insight.find({
      user: req.user._id,
      type: { $nin: ['subscription-detected'] } // exclude subscriptions
    })
      .sort({ generatedAt: -1 })
      .limit(20);

    res.json({
      count: insights.length,
      insights: insights.map(i => ({
        id: i._id,
        type: i.type,
        title: i.title,
        message: i.description, // backward compatible
        severity: i.severity,
        icon: i.icon,
        isRead: i.isRead,
        generatedAt: i.generatedAt,
        metadata: i.metadata
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route GET /api/insights/subscriptions
const getSubscriptions = async (req, res) => {
  try {
    const subscriptions = await Insight.find({
      user: req.user._id,
      type: 'subscription-detected'
    }).sort({ 'metadata.annualCost': -1 });

    const totalMonthly = subscriptions
      .filter(s => s.metadata.frequency === 'Monthly')
      .reduce((sum, s) => sum + s.metadata.amount, 0);

    res.json({
      count: subscriptions.length,
      totalMonthlyCost: totalMonthly,
      totalAnnualCost: Math.round(totalMonthly * 12),
      subscriptions: subscriptions.map(s => ({
        merchant: s.metadata.merchant,
        amount: s.metadata.amount,
        frequency: s.metadata.frequency,
        annualCost: s.metadata.annualCost,
        timesCharged: s.metadata.timesCharged,
        lastCharged: s.generatedAt
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route PATCH /api/insights/:id/read
const markAsRead = async (req, res) => {
  try {
    await Insight.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ message: 'Marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getInsights, getSubscriptions, markAsRead };