const { getFinancialAdvice } = require('../services/aiService');
const { buildFinancialContext } = require('../services/contextBuilder');

// Store chat history per user (in memory for MVP)
const chatHistories = {};

// @route  POST /api/chat
const chat = async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user._id.toString();

    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }

    // Build real financial context for this user
    const financialContext = await buildFinancialContext(userId);

    // Initialize chat history for user if not exists
    if (!chatHistories[userId]) {
      chatHistories[userId] = [];
    }

    // Add user message to history
    chatHistories[userId].push({
      role: 'user',
      message,
      timestamp: new Date()
    });

    // Get AI response
    const response = await getFinancialAdvice(message, financialContext);

    if (!response.success) {
      return res.status(500).json({ message: response.message });
    }

    // Add AI response to history
    chatHistories[userId].push({
      role: 'assistant',
      message: response.message,
      timestamp: new Date()
    });

    // Keep only last 20 messages per user
    if (chatHistories[userId].length > 20) {
      chatHistories[userId] = chatHistories[userId].slice(-20);
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

// @route  GET /api/chat/history
const getChatHistory = async (req, res) => {
  const userId = req.user._id.toString();
  res.json(chatHistories[userId] || []);
};

// @route  DELETE /api/chat/history
const clearChatHistory = async (req, res) => {
  const userId = req.user._id.toString();
  chatHistories[userId] = [];
  res.json({ message: 'Chat history cleared' });
};

module.exports = { chat, getChatHistory, clearChatHistory };