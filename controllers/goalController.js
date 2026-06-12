const Goal = require('../models/Goal');
const Transaction = require('../models/Transaction');

// @route POST /api/goals
const createGoal = async (req, res) => {
  try {
    const {
      goalName,
      targetAmount,
      savedAmount,
      deadline,
      category,
      monthlyContribution
    } = req.body;

    const goal = await Goal.create({
      user: req.user._id,
      goalName,
      targetAmount,
      savedAmount: savedAmount || 0,
      deadline,
      category,
      monthlyContribution
    });

    res.status(201).json(goal);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route GET /api/goals
const getGoals = async (req, res) => {
  try {
    const goals = await Goal.find({
      user: req.user._id,
      status: 'active'
    });

    const now = new Date();

    // Enrich each goal with progress data
    const enrichedGoals = goals.map(goal => {
      const remaining = goal.targetAmount - goal.savedAmount;
      const progressPercent = ((goal.savedAmount / goal.targetAmount) * 100).toFixed(1);

      // Calculate months remaining
      const monthsRemaining = Math.max(
        0,
        (goal.deadline.getFullYear() - now.getFullYear()) * 12 +
        (goal.deadline.getMonth() - now.getMonth())
      );

      // Calculate required monthly saving
      const requiredMonthlySaving = monthsRemaining > 0
        ? Math.ceil(remaining / monthsRemaining)
        : remaining;

      // Is goal on track?
      const onTrack = goal.monthlyContribution >= requiredMonthlySaving;

      return {
        ...goal.toObject(),
        remaining,
        progressPercent: `${progressPercent}%`,
        monthsRemaining,
        requiredMonthlySaving,
        onTrack
      };
    });

    res.json(enrichedGoals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route PUT /api/goals/:id
const updateGoal = async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);

    if (!goal) {
      return res.status(404).json({ message: 'Goal not found' });
    }

    if (goal.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const updated = await Goal.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    // Auto complete if target reached
    if (updated.savedAmount >= updated.targetAmount) {
      updated.status = 'completed';
      await updated.save();
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route DELETE /api/goals/:id
const deleteGoal = async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);

    if (!goal) {
      return res.status(404).json({ message: 'Goal not found' });
    }

    if (goal.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    await Goal.findByIdAndDelete(req.params.id);
    res.json({ message: 'Goal deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route POST /api/goals/afford
const canIAfford = async (req, res) => {
  try {
    const { itemName, amount } = req.body;
    const now = new Date();

    // Get current month summary
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const transactions = await Transaction.find({
      user: req.user._id,
      date: { $gte: startOfMonth }
    });

    let monthlyIncome = 0;
    let monthlyExpenses = 0;
    let monthlyInvestments = 0;

    transactions.forEach(t => {
      if (t.type === 'credit') monthlyIncome += t.amount;
      else if (t.category === 'Investment') monthlyInvestments += t.amount;
      else monthlyExpenses += t.amount;
    });

    const monthlySavings = monthlyIncome - monthlyExpenses - monthlyInvestments;

    // Get active goals
    const goals = await Goal.find({
      user: req.user._id,
      status: 'active'
    });

    // Calculate total monthly goal commitments
    const totalGoalCommitments = goals.reduce(
      (sum, g) => sum + (g.monthlyContribution || 0), 0
    );

    const freeCash = monthlySavings - totalGoalCommitments;

    // Build context for AI
    const affordContext = `
User wants to buy: ${itemName}
Purchase amount: ₹${amount}

Current Financial Snapshot:
- Monthly Income: ₹${monthlyIncome}
- Monthly Expenses: ₹${monthlyExpenses}
- Monthly Investments: ₹${monthlyInvestments}
- Monthly Savings: ₹${monthlySavings}
- Monthly Goal Commitments: ₹${totalGoalCommitments}
- Free Cash After Goals: ₹${freeCash}

Active Goals:
${goals.map(g => {
  const remaining = g.targetAmount - g.savedAmount;
  const months = Math.max(0,
    (g.deadline.getFullYear() - now.getFullYear()) * 12 +
    (g.deadline.getMonth() - now.getMonth())
  );
  return `- ${g.goalName}: ₹${remaining} remaining, ${months} months left`;
}).join('\n') || '- No active goals'}

Months to save for purchase at current free cash rate: ${freeCash > 0 ? Math.ceil(amount / freeCash) : 'Cannot afford'}
    `;

    // Get AI response
    const { getFinancialAdvice } = require('../services/aiService');
    const response = await getFinancialAdvice(
      `Can I afford to buy ${itemName} for ₹${amount}?`,
      affordContext
    );

    res.json({
      itemName,
      amount,
      monthlySavings,
      freeCash,
      monthsToSave: freeCash > 0 ? Math.ceil(amount / freeCash) : null,
      canAffordNow: freeCash >= amount,
      aiAdvice: response.message
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createGoal,
  getGoals,
  updateGoal,
  deleteGoal,
  canIAfford
};