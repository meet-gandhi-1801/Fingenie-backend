const mongoose = require('mongoose');

const GoalSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  goalName: {
    type: String,
    required: true,
    trim: true
  },
  targetAmount: {
    type: Number,
    required: true
  },
  savedAmount: {
    type: Number,
    default: 0
  },
  deadline: {
    type: Date,
    required: true
  },
  category: {
    type: String,
    enum: [
      'Emergency Fund',
      'Travel',
      'Gadget',
      'Vehicle',
      'Home',
      'Education',
      'Wedding',
      'Investment',
      'Other'
    ],
    default: 'Other'
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'paused'],
    default: 'active'
  },
  monthlyContribution: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

module.exports = mongoose.model('Goal', GoalSchema);    