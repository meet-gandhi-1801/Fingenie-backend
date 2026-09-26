const crypto = require('crypto');
const Transaction = require('../../models/Transaction');

const generateFingerprint = (userId, date, amount, type, merchant) => {
    // Format date to ignore times if necessary, but keep it stable
    const d = new Date(date).toISOString().split('T')[0];
    const payload = `${userId}|${d}|${amount}|${type}|${merchant}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
};

const filterDuplicates = async (transactions, userId) => {
    const fingerprints = transactions.map(tx => {
        tx.fingerprint = generateFingerprint(userId, tx.date, tx.amount, tx.type, tx.merchant);
        return tx.fingerprint;
    });

    const existing = await Transaction.find({
        fingerprint: { $in: fingerprints },
        user: userId
    }).select('fingerprint');

    const existingSet = new Set(existing.map(e => e.fingerprint));

    const newTransactions = [];
    let skippedCount = 0;

    for (const tx of transactions) {
        if (existingSet.has(tx.fingerprint)) {
            skippedCount++;
        } else {
            newTransactions.push(tx);
            // ensure we don't accidentally insert duplicates in the same batch
            existingSet.add(tx.fingerprint);
        }
    }

    return { newTransactions, skippedCount };
};

module.exports = { generateFingerprint, filterDuplicates };
