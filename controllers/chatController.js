const { getFinancialAdvice } = require('../services/aiService');
const { buildFinancialContext } = require('../services/contextBuilder');
const ChatMessage = require('../models/ChatMessage');

// @route POST /api/chat
const chat = async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user._id;

    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }

    const financialContext = await buildFinancialContext(userId);

    // Save user message
    await ChatMessage.create({
      user: userId,
      role: 'user',
      message
    });

    const response = await getFinancialAdvice(message, financialContext);

    if (!response.success) {
      return res.status(500).json({ message: response.message });
    }

    // Save AI response
    await ChatMessage.create({
      user: userId,
      role: 'assistant',
      message: response.message
    });

    // Trim to last 20 messages
    const messageCount = await ChatMessage.countDocuments({ user: userId });
    if (messageCount > 20) {
      const oldest = await ChatMessage.find({ user: userId })
        .sort({ createdAt: 1 })
        .limit(messageCount - 20);
      await ChatMessage.deleteMany({
        _id: { $in: oldest.map(m => m._id) }
      });
    }

    res.json({
      message: response.message,
      context: {
        transactionsAnalyzed: financialContext.split('\n').length
      }
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route GET /api/chat/history
const getChatHistory = async (req, res) => {
  try {
    const messages = await ChatMessage.find({ user: req.user._id })
      .sort({ createdAt: 1 })
      .limit(20);

    res.json(messages.map(m => ({
      role: m.role,
      message: m.message,
      timestamp: m.createdAt
    })));

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route DELETE /api/chat/history
const clearChatHistory = async (req, res) => {
  try {
    await ChatMessage.deleteMany({ user: req.user._id });
    res.json({ message: 'Chat history cleared' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { chat, getChatHistory, clearChatHistory };