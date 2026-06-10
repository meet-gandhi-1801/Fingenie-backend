const Transaction = require('../models/Transaction');

// @route  POST /api/transactions
// @access Private
const addTransaction = async (req, res) => {
  try {
    const { amount, type, category, merchant, description, date } = req.body;

    const transaction = await Transaction.create({
      user: req.user._id,
      amount,
      type,
      category,
      merchant,
      description,
      date
    });

    res.status(201).json(transaction);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  GET /api/transactions
// @access Private
const getTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user._id })
      .sort({ date: -1 }); // newest first

    res.json(transactions);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  GET /api/transactions/:id
// @access Private
const getTransactionById = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    // Make sure user owns this transaction
    if (transaction.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    res.json(transaction);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  PUT /api/transactions/:id
// @access Private
const updateTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    // Make sure user owns this transaction
    if (transaction.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const updated = await Transaction.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true } // return updated document
    );

    res.json(updated);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  DELETE /api/transactions/:id
// @access Private
const deleteTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    // Make sure user owns this transaction
    if (transaction.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    await Transaction.findByIdAndDelete(req.params.id);

    res.json({ message: 'Transaction deleted' });

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