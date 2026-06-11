const { parseSMS } = require('../services/smsParser');
const Transaction = require('../models/Transaction');

// @route  POST /api/sms/parse
// @desc   Parse SMS text and return transaction data
const parseAndPreview = async (req, res) => {
  try {
    const { smsText } = req.body;

    if (!smsText) {
      return res.status(400).json({ message: 'SMS text is required' });
    }

    const result = parseSMS(smsText);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  POST /api/sms/save
// @desc   Parse SMS and directly save as transaction
const parseAndSave = async (req, res) => {
  try {
    const { smsText } = req.body;

    if (!smsText) {
      return res.status(400).json({ message: 'SMS text is required' });
    }

    const result = parseSMS(smsText);

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Save to database
    const transaction = await Transaction.create({
      user: req.user._id,
      amount: result.data.amount,
      type: result.data.type,
      merchant: result.data.merchant,
      category: result.data.category,
      source: 'sms',
      description: `Parsed from ${result.bank} SMS`
    });

    res.status(201).json({
      message: 'Transaction saved from SMS',
      transaction
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { parseAndPreview, parseAndSave };