const { Worker } = require('bullmq');
const Redis = require('ioredis');
const ImportJob = require('../models/ImportJob');
const { extractTextFromPDF } = require('../services/document-import/extractors/pdfTextExtractor');
const { extractTextWithOCR } = require('../services/document-import/extractors/imageExtractor');
const { extractTransactionCandidates } = require('../services/document-import/transactionCandidateExtractor');
const { normalizeTransactionsWithLLM } = require('../services/document-import/llmNormalizer');
const { validateTransactionsBatch } = require('../services/document-import/validationLayer');
const { filterDuplicates } = require('../services/document-import/duplicateDetection');

const connection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

const workerProcess = async (job) => {
    const { jobId, fileData, mimeType, userId, originalname } = job.data;

    const buffer = Buffer.from(fileData, 'base64');

    // Find Job
    const importJob = await ImportJob.findById(jobId);
    if (!importJob) throw new Error('Job not found');

    try {
        importJob.status = 'processing';
        await importJob.save();

        let rawText = '';
        let pagesProcessed = 1;

        // 1. Extraction Layer
        if (mimeType === 'application/pdf' || originalname.endsWith('.pdf')) {
            const pdfRes = await extractTextFromPDF(buffer);
            if (pdfRes.success) {
                if (pdfRes.isScanned) {
                    // fallback to OCR
                    const ocrRes = await extractTextWithOCR(buffer, mimeType);
                    if (ocrRes.success) {
                        rawText = ocrRes.text;
                    } else {
                        throw new Error('OCR fallback failed: ' + ocrRes.error);
                    }
                } else {
                    rawText = pdfRes.text;
                    pagesProcessed = pdfRes.pages || 1;
                }
            } else {
                throw new Error('PDF extraction failed: ' + pdfRes.error);
            }
        } else if (['image/png', 'image/jpeg', 'image/jpg'].includes(mimeType)) {
            const ocrRes = await extractTextWithOCR(buffer, mimeType);
            if (ocrRes.success) {
                rawText = ocrRes.text;
            } else {
                throw new Error('Image OCR failed: ' + ocrRes.error);
            }
        } else {
            throw new Error('Unsupported mimeType: ' + mimeType);
        }

        importJob.totalPages = pagesProcessed;
        importJob.processedPages = pagesProcessed;
        importJob.progress = 30; // extraction done
        await importJob.save();

        // 2. Candidate Extraction
        const candidates = extractTransactionCandidates(rawText);
        importJob.progress = 50;
        await importJob.save();

        if (candidates.length === 0) {
            importJob.status = 'completed';
            importJob.completedAt = new Date();
            await importJob.save();
            return;
        }

        // 3. LLM Normalization
        const apiKey = process.env.GEMINI_API_KEY;
        const normalized = await normalizeTransactionsWithLLM(candidates, apiKey);
        importJob.transactionsFound = normalized.length;

        // 4. Validation
        let validated = validateTransactionsBatch(normalized);

        // 5. Duplicate Detection
        const { newTransactions, skippedCount } = await filterDuplicates(validated, userId);

        // 6. Balance Validation
        const { extractStatementMetadata, validateBalance } = require('../services/document-import/balanceValidation');
        const metadata = await extractStatementMetadata(rawText, apiKey);
        importJob.progress = 85;

        let allTxnsForBalance = validated; // need all extracted transactions to calculate total statement delta over the period
        const balanceCheck = validateBalance(metadata, allTxnsForBalance);

        if (!balanceCheck.passed) {
            // Flag entire job and set requiresReview for all new transactions explicitly
            newTransactions.forEach(tx => {
                tx.requiresReview = true;
                tx.validationError = tx.validationError ? tx.validationError + ' | ' : '';
                tx.validationError += 'Statement balance check failed';
            });
            importJob.error = `Balance mismatch. Expected: ${balanceCheck.expectedClosingBalance}, found: ${balanceCheck.actualClosingBalance}`;
        }

        importJob.transactionsSkipped = skippedCount;
        importJob.progress = 90;

        const requiresReviewCount = newTransactions.filter(tx => tx.requiresReview).length;
        importJob.requiresReview = requiresReviewCount;

        importJob.transactions = newTransactions; // store them allowing user review

        // Even with review_required, consider it paused for user action. 
        if (requiresReviewCount > 0 || !balanceCheck.passed) {
            importJob.status = 'review_required';
        } else {
            importJob.status = 'completed';
            importJob.completedAt = new Date();
        }

        await importJob.save();
    } catch (error) {
        importJob.status = 'failed';
        importJob.error = error.message;
        importJob.completedAt = new Date();
        await importJob.save();
        throw error;
    }
};

const importWorker = new Worker('document-import', workerProcess, { connection });

importWorker.on('failed', (job, err) => {
    console.log(`Document import job ${job.id} failed with err ${err.message}`);
});

importWorker.on('completed', (job) => {
    console.log(`Document import job ${job.id} completed!`);
});

module.exports = importWorker;
