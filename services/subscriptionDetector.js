const Transaction = require('../models/Transaction');

const detectSubscriptions = async (userId) => {
  const now = new Date();

  // Look at last 3 months of transactions
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

  const transactions = await Transaction.find({
    user: userId,
    type: 'debit',
    date: { $gte: threeMonthsAgo }
  });

  // Group by merchant
  const merchantGroups = {};
  transactions.forEach(t => {
    const key = t.merchant.toLowerCase().trim();
    if (!merchantGroups[key]) {
      merchantGroups[key] = [];
    }
    merchantGroups[key].push(t);
  });

  const subscriptions = [];

  for (const [merchant, txList] of Object.entries(merchantGroups)) {
    // Need at least 2 transactions to detect subscription
    if (txList.length < 2) continue;

    // Check if amounts are similar (within 5% variation)
    const amounts = txList.map(t => t.amount);
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const allSimilar = amounts.every(a => Math.abs(a - avgAmount) / avgAmount < 0.05);

    if (!allSimilar) continue;

    // Check if transactions are roughly monthly (25-35 days apart)
    const sortedDates = txList
      .map(t => new Date(t.date))
      .sort((a, b) => a - b);

    const gaps = [];
    for (let i = 1; i < sortedDates.length; i++) {
      const daysDiff = (sortedDates[i] - sortedDates[i-1]) / (1000 * 60 * 60 * 24);
      gaps.push(daysDiff);
    }

    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const isMonthly = avgGap >= 25 && avgGap <= 35;
    const isWeekly = avgGap >= 5 && avgGap <= 9;

    if (isMonthly || isWeekly) {
      // Find the most recent transaction
      const lastTransaction = sortedDates[sortedDates.length - 1];
      const daysSinceLast = (now - lastTransaction) / (1000 * 60 * 60 * 24);

      // Only show if still active (paid within last 35 days)
      if (daysSinceLast <= 35) {
        subscriptions.push({
          merchant: txList[0].merchant,
          amount: avgAmount,
          frequency: isMonthly ? 'Monthly' : 'Weekly',
          category: txList[0].category,
          lastCharged: lastTransaction,
          timesCharged: txList.length,
          annualCost: isMonthly
            ? Math.round(avgAmount * 12)
            : Math.round(avgAmount * 52)
        });
      }
    }
  }

  // Sort by amount descending
  return subscriptions.sort((a, b) => b.amount - a.amount);
};

module.exports = { detectSubscriptions };