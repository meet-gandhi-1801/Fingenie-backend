const ALLOWED_CATEGORIES = [
    'Food', 'Shopping', 'Travel', 'Rent', 'Bills', 'Health',
    'Entertainment', 'Education', 'Investment', 'Salary', 'Other'
];

const THRESHOLDS = {
    AUTO_IMPORT: 0.85,
    REVIEW_RECOMMENDED: 0.60
};

const validateTransaction = (tx) => {
    let isValid = true;
    let validationError = null;
    let requiresReview = false;

    // Amount validation
    if (!tx.amount || isNaN(tx.amount) || tx.amount <= 0) {
        isValid = false;
        validationError = 'Invalid amount';
        requiresReview = true;
    }

    // Type validation
    if (!['credit', 'debit'].includes(tx.type)) {
        isValid = false;
        validationError = validationError || 'Invalid type';
        requiresReview = true;
    }

    // Category validation
    if (!ALLOWED_CATEGORIES.includes(tx.category)) {
        tx.category = 'Other'; // auto-fix bad category map
    }

    // Date validation
    if (!tx.date || isNaN(Date.parse(tx.date))) {
        isValid = false;
        validationError = validationError || 'Invalid date';
        requiresReview = true;
    }

    // Confidence check
    if (typeof tx.confidence !== 'number' || tx.confidence < 0 || tx.confidence > 1) {
        tx.confidence = 0.5; // fallback
    }

    if (tx.confidence < THRESHOLDS.AUTO_IMPORT) {
        requiresReview = true;
    }

    return {
        ...tx,
        isValid: true, // Keep it true so it's stored in the ImportJob, we'll mark requiresReview for user.
        validationError,
        requiresReview
    };
};

const validateTransactionsBatch = (transactions) => {
    return transactions.map(validateTransaction);
};

module.exports = {
    validateTransactionsBatch,
    THRESHOLDS,
    ALLOWED_CATEGORIES
};
