const Transaction = require('../models/Transaction');

const generateInsights = async (userId) => {
  const insights = [];
  const now = new Date();

  // Current month date range
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Last month date range
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  // Fetch transactions
  const currentMonthTx = await Transaction.find({
    user: userId,
    date: { $gte: startOfMonth, $lte: endOfMonth }
  });

  const lastMonthTx = await Transaction.find({
    user: userId,
    date: { $gte: startOfLastMonth, $lte: endOfLastMonth }
  });

  // Calculate totals
  let currentIncome = 0;
  let currentExpenses = 0;
  const currentCategories = {};
  let currentInvestments = 0;

currentMonthTx.forEach(t => {
  if (t.type === 'credit') {
    currentIncome += t.amount;
  } else if (t.category === 'Investment') {
    currentInvestments += t.amount;
  } else {
    currentExpenses += t.amount;
    currentCategories[t.category] = 
      (currentCategories[t.category] || 0) + t.amount;
  }
});

  let lastExpenses = 0;
  const lastCategories = {};

  lastMonthTx.forEach(t => {
    if (t.type === 'debit') {
      lastExpenses += t.amount;
      lastCategories[t.category] = (lastCategories[t.category] || 0) + t.amount;
    }
  });

  // ================================
  // INSIGHT 1: Overall spending trend
  // ================================
  if (lastExpenses > 0) {
    const changePercent = ((currentExpenses - lastExpenses) / lastExpenses * 100).toFixed(1);
    if (changePercent > 20) {
      insights.push({
        type: 'warning',
        title: 'Spending Increased',
        message: `Your spending is up ${changePercent}% compared to last month (₹${currentExpenses} vs ₹${lastExpenses})`,
        icon: '⚠️'
      });
    } else if (changePercent < -10) {
      insights.push({
        type: 'positive',
        title: 'Great Spending Control',
        message: `Your spending dropped ${Math.abs(changePercent)}% compared to last month. Keep it up!`,
        icon: '✅'
      });
    }
  }

  // ================================
  // INSIGHT 2: Category spike detection
  // ================================
  for (const [category, amount] of Object.entries(currentCategories)) {
    const lastAmount = lastCategories[category] || 0;
    if (lastAmount > 0) {
      const spike = ((amount - lastAmount) / lastAmount * 100).toFixed(1);
      if (spike > 50) {
        insights.push({
          type: 'warning',
          title: `${category} Spending Spike`,
          message: `Your ${category} spending increased ${spike}% vs last month (₹${amount} vs ₹${lastAmount})`,
          icon: '📈'
        });
      }
    }
  }

  // ================================
  // INSIGHT 3: Savings rate
  // ================================
  if (currentIncome > 0) {
    const savingsRate = ((currentIncome - currentExpenses) / currentIncome * 100).toFixed(1);
    if (savingsRate >= 30) {
      insights.push({
        type: 'positive',
        title: 'Excellent Savings Rate',
        message: `You're saving ${savingsRate}% of your income this month. Financial experts recommend 20%+`,
        icon: '🎯'
      });
    } else if (savingsRate < 10) {
      insights.push({
        type: 'warning',
        title: 'Low Savings Rate',
        message: `You're only saving ${savingsRate}% of your income. Try to reach at least 20%`,
        icon: '⚠️'
      });
    }
  }

  // ================================
  // INSIGHT 4: Budget burnout prediction
  // ================================
  const daysInMonth = endOfMonth.getDate();
  const daysPassed = now.getDate();
  const daysRemaining = daysInMonth - daysPassed;
  const dailySpendRate = currentExpenses / daysPassed;
  const projectedMonthlySpend = dailySpendRate * daysInMonth;

  if (currentIncome > 0 && projectedMonthlySpend > currentIncome) {
    insights.push({
      type: 'danger',
      title: 'Overspending Alert',
      message: `At your current rate you'll spend ₹${Math.round(projectedMonthlySpend)} this month, exceeding your income of ₹${currentIncome}`,
      icon: '🚨'
    });
  }

  // ================================
  // INSIGHT 5: Top spending category
  // ================================
  if (Object.keys(currentCategories).length > 0) {
    const topCategory = Object.entries(currentCategories)
      .sort((a, b) => b[1] - a[1])[0];

    const topPercent = (topCategory[1] / currentExpenses * 100).toFixed(1);
    if (topPercent > 40) {
      insights.push({
        type: 'info',
        title: 'Dominant Spending Category',
        message: `${topCategory[0]} accounts for ${topPercent}% of your total expenses (₹${topCategory[1]})`,
        icon: '📊'
      });
    }
  }

  // INSIGHT: Investment behavior
if (currentInvestments > 0 && currentIncome > 0) {
  const investPercent = (currentInvestments / currentIncome * 100).toFixed(1);
  if (investPercent >= 20) {
    insights.push({
      type: 'positive',
      title: 'Great Investment Habit',
      message: `You're investing ${investPercent}% of your income (₹${currentInvestments}). Wealth building on track!`,
      icon: '💰'
    });
  } else if (investPercent < 10 && currentIncome > 20000) {
    insights.push({
      type: 'info',
      title: 'Consider Investing More',
      message: `You're investing only ${investPercent}% of income. Financial experts recommend 20%+ for long term wealth`,
      icon: '📈'
    });
  }
}

  // ================================
  // INSIGHT 6: No income recorded
  // ================================
  if (currentIncome === 0 && currentExpenses > 0) {
    insights.push({
      type: 'info',
      title: 'Income Not Recorded',
      message: 'You have expenses but no income recorded this month. Add your salary for better insights',
      icon: '💡'
    });
  }

  return insights;
};

module.exports = { generateInsights };