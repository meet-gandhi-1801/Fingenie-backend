const mongoose = require('mongoose');

const InsightSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: [
      'spending-increase',
      'spending-decrease',
      'category-spike',
      'savings-rate',
      'overspending-alert',
      'dominant-category',
      'no-income',
      'investment-habit',
      'subscription-detected',
      'budget-warning'
    ],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  severity: {
    type: String,
    enum: ['positive', 'info', 'warning', 'danger'],
    default: 'info'
  },
  icon: {
    type: String,
    default: '💡'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    // Insights expire after 30 days
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
    // Stores extra data like:
    // { category: 'Food', changePercent: 45, amount: 2000 }
  }
}, { timestamps: true });

// Auto delete expired insights
InsightSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for fast user queries
InsightSchema.index({ user: 1, generatedAt: -1 });

module.exports = mongoose.model('Insight', InsightSchema);