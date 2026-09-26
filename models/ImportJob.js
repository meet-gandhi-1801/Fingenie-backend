const mongoose = require('mongoose');

const ImportJobSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    fileName: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['queued', 'processing', 'review_required', 'completed', 'failed'],
        default: 'queued'
    },
    progress: {
        type: Number,
        default: 0
    },
    totalPages: {
        type: Number,
        default: 1
    },
    processedPages: {
        type: Number,
        default: 0
    },
    transactionsFound: {
        type: Number,
        default: 0
    },
    transactionsImported: {
        type: Number,
        default: 0
    },
    transactionsSkipped: {
        type: Number,
        default: 0
    },
    requiresReview: {
        type: Number,
        default: 0
    },
    transactions: [{
        date: Date,
        amount: Number,
        type: { type: String, enum: ['credit', 'debit'] },
        merchant: String,
        category: String,
        description: String,
        confidence: Number,
        requiresReview: Boolean,
        page: Number,
        originalText: String,
        validationError: String,
        fingerprint: String
    }],
    error: {
        type: String,
        default: null
    },
    completedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('ImportJob', ImportJobSchema);
