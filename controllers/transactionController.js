const Transaction = require('../models/Transaction');
const { categorizeTransaction } = require('../services/categorizationService');
const { queueInsightGeneration } = require('../jobs/insightQueue');

const addTransaction = async (req, res) => {
  try {
    const { amount, type, merchant, description, date, category } = req.body;

    let finalCategory = category;
    if (!category || category === 'Other') {
      const result = categorizeTransaction(merchant, description);
      finalCategory = result.category;
    }

    const transaction = await Transaction.create({
      user: req.user._id,
      amount,
      type,
      category: finalCategory,
      merchant,
      description,
      date
    });

    // Trigger background insight generation
    await queueInsightGeneration(req.user._id);

    res.status(201).json(transaction);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add queue trigger to updateTransaction and deleteTransaction too
const updateTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
    if (transaction.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const updated = await Transaction.findByIdAndUpdate(
      req.params.id, req.body, { new: true }
    );

    // Trigger background insight generation
    await queueInsightGeneration(req.user._id);

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
    if (transaction.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    await Transaction.findByIdAndDelete(req.params.id);

    // Trigger background insight generation
    await queueInsightGeneration(req.user._id);

    res.json({ message: 'Transaction deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Keep getTransactions and getTransactionById exactly the same
const getTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user._id })
      .sort({ date: -1 });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getTransactionById = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
    if (transaction.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    res.json(transaction);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  addTransaction,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction
};