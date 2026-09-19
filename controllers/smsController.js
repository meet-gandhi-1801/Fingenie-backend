// NEW
const { parseSMS } = require('../services/sms/smsParserService');
const Transaction = require('../models/Transaction');

// @route POST /api/sms/parse
const parseAndPreview = async (req, res) => {
  try {
    const { smsText } = req.body;

    if (!smsText) {
      return res.status(400).json({ message: 'SMS text is required' });
    }

    const result = await parseSMS(smsText);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Could not parse SMS',
        issues: result.issues,
        suggestion: 'Please add this transaction manually'
      });
    }

    // Add confidence label for frontend
    const confidenceLabel =
      result.finalConfidence >= 0.85 ? 'High' :
      result.finalConfidence >= 0.65 ? 'Medium' : 'Low';

    res.json({
      success: true,
      parser: result.source,
      usedAI: result.usedAI,
      confidence: result.finalConfidence,
      confidenceLabel,
      bank: result.bank,
      data: result.data
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route POST /api/sms/save
const parseAndSave = async (req, res) => {
  try {
    const { smsText } = req.body;

    if (!smsText) {
      return res.status(400).json({ message: 'SMS text is required' });
    }

    const result = await parseSMS(smsText);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Could not parse SMS. Please add manually.',
        issues: result.issues
      });
    }

    // Reject very low confidence saves
    if (result.finalConfidence < 0.4) {
      return res.status(400).json({
        success: false,
        message: 'Confidence too low to auto-save. Please verify and add manually.',
        confidence: result.finalConfidence,
        parsedData: result.data
      });
    }

    const transaction = await Transaction.create({
      user: req.user._id,
      amount: result.data.amount,
      type: result.data.type,
      merchant: result.data.merchant,
      category: result.data.category,
      date: result.data.date || new Date(),
      source: 'sms',
      description: `Parsed via ${result.source} parser (${result.bank})`
    });

    res.status(201).json({
      message: 'Transaction saved from SMS',
      parser: result.source,
      usedAI: result.usedAI,
      confidence: result.finalConfidence,
      transaction
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { parseAndPreview, parseAndSave };