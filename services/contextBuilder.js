const Transaction = require('../models/Transaction');

const buildFinancialContext = async (userId) => {
  try {
    const now = new Date();

    // Get current month transactions
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthTx = await Transaction.find({
      user: userId,
      date: { $gte: startOfMonth }
    }).sort({ date: -1 });

    // Get last month transactions
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const lastMonthTx = await Transaction.find({
      user: userId,
      date: { $gte: startOfLastMonth, $lte: endOfLastMonth }
    });

    // Calculate current month summary
    let currentIncome = 0;
    let currentExpenses = 0;
    const categoryTotals = {};

// NEW
let currentInvestments = 0;

currentMonthTx.forEach(t => {
  if (t.type === 'credit') {
    currentIncome += t.amount;
  } else if (t.category === 'Investment') {
    currentInvestments += t.amount; // separate bucket
  } else {
    currentExpenses += t.amount;
    currentCategories[t.category] = (currentCategories[t.category] || 0) + t.amount;
  }
});

    // Calculate last month summary
    let lastIncome = 0;
    let lastExpenses = 0;
    lastMonthTx.forEach(t => {
      if (t.type === 'credit') lastIncome += t.amount;
      else lastExpenses += t.amount;
    });

    // Format category breakdown
    const categoryBreakdown = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amount]) => `  - ${cat}: ₹${amount}`)
      .join('\n');

    // Format recent transactions
    const recentList = currentMonthTx
      .slice(0, 10)
      .map(t => `  - ${t.merchant} | ₹${t.amount} | ${t.type} | ${t.category} | ${new Date(t.date).toLocaleDateString('en-IN')}`)
      .join('\n');

    // Build context string
 const context = `
=== CURRENT MONTH (${now.toLocaleString('default', { month: 'long', year: 'numeric' })}) ===
Total Income:      ₹${currentIncome}
Total Expenses:    ₹${currentExpenses}
Total Investments: ₹${currentInvestments}
Cash Savings:      ₹${currentIncome - currentExpenses - currentInvestments}
Total Wealth Built:₹${currentIncome - currentExpenses}
Savings Rate:      ${currentIncome > 0 ? ((currentIncome - currentExpenses) / currentIncome * 100).toFixed(1) : 0}%
Transactions:      ${currentMonthTx.length}
...

=== SPENDING BY CATEGORY ===
${categoryBreakdown || '  No expenses recorded yet'}

=== LAST MONTH COMPARISON ===
Last Month Income:   ₹${lastIncome}
Last Month Expenses: ₹${lastExpenses}
Expense Change:      ${lastExpenses > 0 ? ((currentExpenses - lastExpenses) / lastExpenses * 100).toFixed(1) : 0}% vs last month

=== RECENT TRANSACTIONS ===
${recentList || '  No transactions recorded yet'}
    `.trim();

    return context;

  } catch (error) {
    return `Error building context: ${error.message}`;
  }
};

module.exports = { buildFinancialContext };