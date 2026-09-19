const mongoose = require('mongoose');

const ChatMessageSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  }
}, { timestamps: true });

ChatMessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
ChatMessageSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('ChatMessage', ChatMessageSchema);