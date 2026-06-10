const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['credit', 'debit'],
    required: true
  },
  category: {
    type: String,
    enum: [
      'Food',
      'Shopping',
      'Travel',
      'Rent',
      'Bills',
      'Health',
      'Entertainment',
      'Education',
      'Investment',
      'Salary',
      'Other'
    ],
    default: 'Other'
  },
  merchant: {
    type: String,
    trim: true,
    default: 'Unknown'
  },
  description: {
    type: String,
    trim: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  source: {
    type: String,
    enum: ['manual', 'sms', 'email'],
    default: 'manual'
  }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', TransactionSchema);