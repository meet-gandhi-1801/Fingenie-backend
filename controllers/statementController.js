const { parseCSV } = require('../services/statements/csvParser');
const { parsePDF } = require('../services/statements/pdfParser');
const Transaction = require('../models/Transaction');
const { queueInsightGeneration } = require('../jobs/insightQueue');

// In-memory temp storage for preview before confirm
// Keyed by userId, holds parsed transactions awaiting confirmation
const pendingUploads = {};

// @route POST /api/statements/upload
const uploadStatement = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { buffer, mimetype, originalname } = req.file;
    const userId = req.user._id.toString();

    let result;

    if (mimetype === 'text/csv' || originalname.endsWith('.csv')) {
      result = await parseCSV(buffer);
    } else if (mimetype === 'application/pdf' || originalname.endsWith('.pdf')) {
      console.log('uploadStatement: calling parsePDF, typeof parsePDF =', typeof parsePDF);
      try {
        result = await parsePDF(buffer);
      } catch (err) {
        console.error('uploadStatement: parsePDF threw an error:', err && err.message);
        throw err;
      }
    } else {
      return res.status(400).json({ message: 'Unsupported file type' });
    }

    if (!result.success || result.transactions.length === 0) {
      return res.status(400).json({
        message: result.message || 'Could not extract transactions from this file',
        detectedHeaders: result.detectedHeaders
      });
    }

    // Store in memory for this user, awaiting confirmation
    pendingUploads[userId] = result.transactions;

    res.json({
      message: `Found ${result.validCount} transactions`,
      totalFound: result.totalFound,
      validCount: result.validCount,
      transactions: result.transactions
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route POST /api/statements/confirm
const confirmStatement = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { transactions } = req.body; // user-edited/filtered list from frontend

    if (!transactions || transactions.length === 0) {
      return res.status(400).json({ message: 'No transactions to save' });
    }

    const toInsert = transactions.map(t => ({
      user: req.user._id,
      amount: t.amount,
      type: t.type,
      merchant: t.merchant,
      category: t.category,
      description: t.description,
      date: t.date,
      source: 'statement'
    }));

    const saved = await Transaction.insertMany(toInsert);

    // Clear pending upload
    delete pendingUploads[userId];

    // Trigger insight regeneration
    await queueInsightGeneration(req.user._id);

    res.status(201).json({
      message: `${saved.length} transactions imported successfully`,
      count: saved.length
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { uploadStatement, confirmStatement };