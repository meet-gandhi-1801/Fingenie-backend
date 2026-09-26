const ImportJob = require('../models/ImportJob');
const Transaction = require('../models/Transaction');
const { queueDocumentImport } = require('../jobs/importQueue');
const { queueInsightGeneration } = require('../jobs/insightQueue');
const mongoose = require('mongoose');

// POST /api/transactions/import
const uploadImport = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const userId = req.user._id;
        const { mimetype, originalname, buffer } = req.file;

        // Create tracking job
        const importJob = await ImportJob.create({
            userId,
            fileName: originalname,
            status: 'queued',
            progress: 0
        });

        // Add to queue
        await queueDocumentImport(importJob._id.toString(), buffer, mimetype, userId.toString(), originalname);

        res.status(202).json({
            success: true,
            jobId: importJob._id,
            status: 'queued'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/transactions/import/:jobId
const getImportStatus = async (req, res) => {
    try {
        const { jobId } = req.params;

        // validate objectId
        if (!mongoose.Types.ObjectId.isValid(jobId)) {
            return res.status(400).json({ success: false, message: 'Invalid job ID' });
        }

        const job = await ImportJob.findOne({ _id: jobId, userId: req.user._id });
        if (!job) {
            return res.status(404).json({ success: false, message: 'Job not found' });
        }

        res.json({
            success: true,
            job: {
                id: job._id,
                status: job.status,
                progress: job.progress,
                totalPages: job.totalPages,
                processedPages: job.processedPages,
                transactionsFound: job.transactionsFound,
                transactionsImported: job.transactionsImported,
                transactionsSkipped: job.transactionsSkipped,
                requiresReview: job.requiresReview,
                error: job.error,
                transactions: job.transactions // Only returned in review phase
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/transactions/import/:jobId/confirm
const confirmImport = async (req, res) => {
    try {
        const { jobId } = req.params;
        const { transactions } = req.body; // Array of transactions the user accepted/edited

        if (!mongoose.Types.ObjectId.isValid(jobId)) {
            return res.status(400).json({ success: false, message: 'Invalid job ID' });
        }
        const job = await ImportJob.findOne({ _id: jobId, userId: req.user._id });
        if (!job) {
            return res.status(404).json({ success: false, message: 'Job not found' });
        }

        if (!['review_required', 'completed'].includes(job.status)) {
            return res.status(400).json({ success: false, message: 'Job is not ready for confirmation' });
        }

        if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
            return res.status(400).json({ success: false, message: 'No transactions to confirm' });
        }

        const toInsert = transactions.map(t => ({
            user: req.user._id,
            amount: t.amount,
            type: t.type,
            merchant: t.merchant,
            category: t.category,
            description: t.description,
            date: t.date,
            source: 'bank_statement',
            fingerprint: t.fingerprint || null // Some may have been edited, fingerprint generation on frontend/backend is optional for edited ones, but we should handle it
        }));

        // In a prod system you might want to recalculate fingerprints here if fields changed

        let insertedCount = 0;
        try {
            const saved = await Transaction.insertMany(toInsert, { ordered: false });
            insertedCount = saved.length;
        } catch (e) {
            // Handle partial success where some duplicates failed
            if (e.code === 11000) {
                insertedCount = e.insertedDocs ? e.insertedDocs.length : 0;
            } else {
                throw e;
            }
        }

        // Update Job status
        job.status = 'completed';
        job.transactionsImported += insertedCount;
        job.completedAt = new Date();
        job.transactions = []; // clear to save space
        await job.save();

        // Trigger insight generation
        if (insertedCount > 0) {
            await queueInsightGeneration(req.user._id);
        }

        res.json({
            success: true,
            message: `${insertedCount} transactions confirmed and imported`,
            jobId: job._id
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    uploadImport,
    getImportStatus,
    confirmImport
};
