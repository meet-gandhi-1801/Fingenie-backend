const { Worker } = require('bullmq');
const { getRedisConnection } = require('../config/redis');
const Insight = require('../models/Insight');
const Transaction = require('../models/Transaction');

// ================================
// HELPER: Calculate monthly data
// ================================
const getMonthlyData = async (userId) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const [currentTx, lastTx] = await Promise.all([
    Transaction.find({ user: userId, date: { $gte: startOfMonth } }),
    Transaction.find({ user: userId, date: { $gte: startOfLastMonth, $lte: endOfLastMonth } })
  ]);

  let currentIncome = 0, currentExpenses = 0, currentInvestments = 0;
  const currentCategories = {};

  currentTx.forEach(t => {
    if (t.type === 'credit') currentIncome += t.amount;
    else if (t.category === 'Investment') currentInvestments += t.amount;
    else {
      currentExpenses += t.amount;
      currentCategories[t.category] = (currentCategories[t.category] || 0) + t.amount;
    }
  });

  let lastExpenses = 0;
  const lastCategories = {};

  lastTx.forEach(t => {
    if (t.type === 'debit' && t.category !== 'Investment') {
      lastExpenses += t.amount;
      lastCategories[t.category] = (lastCategories[t.category] || 0) + t.amount;
    }
  });

  return {
    now,
    currentTx,
    lastTx,
    currentIncome,
    currentExpenses,
    currentInvestments,
    currentCategories,
    lastExpenses,
    lastCategories
  };
};

// ================================
// JOB 1: Monthly Insights
// ================================
const generateMonthlyInsights = async (userId) => {
  const insights = [];
  const {
    now, currentTx, lastTx,
    currentIncome, currentExpenses, currentInvestments,
    currentCategories, lastExpenses, lastCategories
  } = await getMonthlyData(userId);

  // Delete old insights for this user this month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  await Insight.deleteMany({
    user: userId,
    type: { $in: ['spending-increase', 'spending-decrease', 'savings-rate', 'overspending-alert', 'dominant-category', 'no-income', 'investment-habit'] },
    generatedAt: { $gte: startOfMonth }
  });

  // Insight 1: Overall spending trend
  if (lastExpenses > 0 && lastTx.length >= 3) {
    const changePercent = ((currentExpenses - lastExpenses) / lastExpenses * 100).toFixed(1);
    if (changePercent > 20) {
      insights.push({
        user: userId,
        type: 'spending-increase',
        title: 'Spending Increased',
        description: `Your spending is up ${changePercent}% vs last month (₹${currentExpenses} vs ₹${lastExpenses})`,
        severity: 'warning',
        icon: '⚠️',
        metadata: { changePercent, currentExpenses, lastExpenses }
      });
    } else if (changePercent < -10) {
      insights.push({
        user: userId,
        type: 'spending-decrease',
        title: 'Great Spending Control',
        description: `Spending dropped ${Math.abs(changePercent)}% vs last month. Keep it up!`,
        severity: 'positive',
        icon: '✅',
        metadata: { changePercent, currentExpenses, lastExpenses }
      });
    }
  }

  // Insight 2: Category spikes
  for (const [category, amount] of Object.entries(currentCategories)) {
    const lastAmount = lastCategories[category] || 0;
    if (lastAmount > 500) {
      const spike = ((amount - lastAmount) / lastAmount * 100).toFixed(1);
      if (spike > 50) {
        insights.push({
          user: userId,
          type: 'category-spike',
          title: `${category} Spending Spike`,
          description: `${category} spending up ${spike}% vs last month (₹${amount} vs ₹${lastAmount})`,
          severity: 'warning',
          icon: '📈',
          metadata: { category, spike, amount, lastAmount }
        });
      }
    }
  }

  // Insight 3: Savings rate
  if (currentIncome > 0) {
    const trueSavingsRate = ((currentIncome - currentExpenses) / currentIncome * 100).toFixed(1);
    if (trueSavingsRate >= 30) {
      insights.push({
        user: userId,
        type: 'savings-rate',
        title: 'Excellent Savings Rate',
        description: `Saving ${trueSavingsRate}% of income including ₹${currentInvestments} investments. Experts recommend 20%+`,
        severity: 'positive',
        icon: '🎯',
        metadata: { savingsRate: trueSavingsRate, investments: currentInvestments }
      });
    } else if (trueSavingsRate < 10) {
      insights.push({
        user: userId,
        type: 'savings-rate',
        title: 'Low Savings Rate',
        description: `Only saving ${trueSavingsRate}% of income. Try to reach at least 20%`,
        severity: 'warning',
        icon: '⚠️',
        metadata: { savingsRate: trueSavingsRate }
      });
    }
  }

  // Insight 4: Overspending prediction
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysPassed = now.getDate();
  const dailyRate = currentExpenses / daysPassed;
  const projectedSpend = dailyRate * daysInMonth;

  if (currentIncome > 0 && projectedSpend > currentIncome) {
    insights.push({
      user: userId,
      type: 'overspending-alert',
      title: 'Overspending Alert',
      description: `At current rate you'll spend ₹${Math.round(projectedSpend)} this month, exceeding income of ₹${currentIncome}`,
      severity: 'danger',
      icon: '🚨',
      metadata: { projectedSpend: Math.round(projectedSpend), currentIncome }
    });
  }

  // Insight 5: Dominant category
  if (Object.keys(currentCategories).length > 0 && currentExpenses > 0) {
    const topCategory = Object.entries(currentCategories)
      .sort((a, b) => b[1] - a[1])[0];
    const topPercent = (topCategory[1] / currentExpenses * 100).toFixed(1);
    if (topPercent > 40) {
      insights.push({
        user: userId,
        type: 'dominant-category',
        title: 'Dominant Spending Category',
        description: `${topCategory[0]} is ${topPercent}% of total expenses (₹${topCategory[1]})`,
        severity: 'info',
        icon: '📊',
        metadata: { category: topCategory[0], percent: topPercent, amount: topCategory[1] }
      });
    }
  }

  // Insight 6: No income
  if (currentIncome === 0 && currentExpenses > 0) {
    insights.push({
      user: userId,
      type: 'no-income',
      title: 'Income Not Recorded',
      description: 'You have expenses but no income this month. Add your salary for better insights',
      severity: 'info',
      icon: '💡',
      metadata: {}
    });
  }

  // Insight 7: Investment habit
  if (currentInvestments > 0 && currentIncome > 0) {
    const investPercent = (currentInvestments / currentIncome * 100).toFixed(1);
    if (investPercent >= 20) {
      insights.push({
        user: userId,
        type: 'investment-habit',
        title: 'Great Investment Habit',
        description: `Investing ${investPercent}% of income (₹${currentInvestments}). Wealth building on track!`,
        severity: 'positive',
        icon: '💰',
        metadata: { investPercent, investments: currentInvestments }
      });
    }
  }

  // Save all insights to DB
  if (insights.length > 0) {
    await Insight.insertMany(insights);
    console.log(`Generated ${insights.length} monthly insights for user ${userId}`);
  }
};

// ================================
// JOB 2: Subscription Detection
// ================================
const detectSubscriptions = async (userId) => {
  const now = new Date();
  const thirteenMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth() - 1, 1);

  const transactions = await Transaction.find({
    user: userId,
    type: 'debit',
    date: { $gte: thirteenMonthsAgo }
  });

  const merchantGroups = {};
  transactions.forEach(t => {
    const key = t.merchant.toLowerCase().trim();
    if (!merchantGroups[key]) merchantGroups[key] = [];
    merchantGroups[key].push(t);
  });

  // Delete old subscription insights
  await Insight.deleteMany({
    user: userId,
    type: 'subscription-detected'
  });

  const subscriptionInsights = [];

  for (const [merchant, txList] of Object.entries(merchantGroups)) {
    if (txList.length < 2) continue;

    const amounts = txList.map(t => t.amount);
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const allSimilar = amounts.every(
      a => Math.abs(a - avgAmount) / avgAmount < 0.05
    );
    if (!allSimilar) continue;

    const sortedDates = txList
      .map(t => new Date(t.date))
      .sort((a, b) => a - b);

    const gaps = [];
    for (let i = 1; i < sortedDates.length; i++) {
      const daysDiff = (sortedDates[i] - sortedDates[i - 1]) / (1000 * 60 * 60 * 24);
      gaps.push(daysDiff);
    }

    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const isMonthly = avgGap >= 20 && avgGap <= 40;
    const isYearly = avgGap >= 340 && avgGap <= 390;

    if (isMonthly || isYearly) {
      const lastDate = sortedDates[sortedDates.length - 1];
      const daysSinceLast = (now - lastDate) / (1000 * 60 * 60 * 24);
      const maxDays = isYearly ? 400 : 45;

      if (daysSinceLast <= maxDays) {
        const frequency = isYearly ? 'Yearly' : 'Monthly';
        const annualCost = isYearly
          ? Math.round(avgAmount)
          : Math.round(avgAmount * 12);

        subscriptionInsights.push({
          user: userId,
          type: 'subscription-detected',
          title: `${txList[0].merchant} Subscription`,
          description: `${frequency} subscription of ₹${Math.round(avgAmount)} detected. Annual cost: ₹${annualCost}`,
          severity: 'info',
          icon: '🔄',
          metadata: {
            merchant: txList[0].merchant,
            amount: Math.round(avgAmount),
            frequency,
            annualCost,
            timesCharged: txList.length
          }
        });
      }
    }
  }

  if (subscriptionInsights.length > 0) {
    await Insight.insertMany(subscriptionInsights);
    console.log(`Detected ${subscriptionInsights.length} subscriptions for user ${userId}`);
  }
};

// ================================
// JOB 3: Spending Analysis
// ================================
const runSpendingAnalysis = async (userId) => {
  const { currentExpenses, currentCategories, currentIncome } = await getMonthlyData(userId);

  // Delete old budget warnings
  await Insight.deleteMany({
    user: userId,
    type: 'budget-warning'
  });

  const budgetInsights = [];

  // Check if any category exceeds 30% of income
  if (currentIncome > 0) {
    for (const [category, amount] of Object.entries(currentCategories)) {
      const percent = (amount / currentIncome * 100).toFixed(1);
      if (percent > 30) {
        budgetInsights.push({
          user: userId,
          type: 'budget-warning',
          title: `High ${category} Spending`,
          description: `${category} spending is ${percent}% of your income (₹${amount}). Consider setting a budget.`,
          severity: 'warning',
          icon: '💸',
          metadata: { category, amount, percent, income: currentIncome }
        });
      }
    }
  }

  if (budgetInsights.length > 0) {
    await Insight.insertMany(budgetInsights);
    console.log(`Generated ${budgetInsights.length} budget warnings for user ${userId}`);
  }
};

// ================================
// WORKER — processes jobs from queue
// ================================
const startInsightWorker = () => {
  const worker = new Worker(
    'insight-generation',
    async (job) => {
      const { userId } = job.data;
      console.log(`Processing job: ${job.name} for user ${userId}`);

      switch (job.name) {
        case 'generate-monthly-insights':
          await generateMonthlyInsights(userId);
          break;
        case 'detect-subscriptions':
          await detectSubscriptions(userId);
          break;
        case 'spending-analysis':
          await runSpendingAnalysis(userId);
          break;
        default:
          console.warn(`Unknown job type: ${job.name}`);
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 5 // process 5 jobs simultaneously
    }
  );

  worker.on('completed', (job) => {
    console.log(`✅ Job ${job.name} completed for user ${job.data.userId}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ Job ${job.name} failed:`, err.message);
  });

  console.log('Insight worker started');
  return worker;
};

module.exports = { startInsightWorker };