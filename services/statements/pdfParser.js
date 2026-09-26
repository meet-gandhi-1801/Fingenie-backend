const { extractTextFromPDF } = require('../document-import/extractors/pdfTextExtractor');
const { extractTextWithOCR } = require('../document-import/extractors/imageExtractor');
const { extractTransactionCandidates } = require('../document-import/transactionCandidateExtractor');
const { normalizeTransactionsWithLLM } = require('../document-import/llmNormalizer');
const { validateTransactionsBatch } = require('../document-import/validationLayer');

const parsePDF = async (buffer) => {
    try {
        let rawText = '';
        const pdfRes = await extractTextFromPDF(buffer);
        if (pdfRes.success) {
            if (pdfRes.isScanned) {
                const ocrRes = await extractTextWithOCR(buffer, 'application/pdf');
                if (ocrRes.success) {
                    rawText = ocrRes.text;
                } else {
                    return { success: false, message: 'OCR failed' };
                }
            } else {
                rawText = pdfRes.text;
            }
        } else {
            return { success: false, message: 'PDF Extraction failed' };
        }

        const candidates = extractTransactionCandidates(rawText);
        if (candidates.length === 0) {
            return { success: false, message: 'No transactions found in this document', transactions: [] };
        }

        const apiKey = process.env.GEMINI_API_KEY;
        const normalized = await normalizeTransactionsWithLLM(candidates, apiKey);
        const validated = validateTransactionsBatch(normalized);

        return {
            success: true,
            totalFound: validated.length,
            validCount: validated.length,
            transactions: validated
        };
    } catch (error) {
        console.error('parsePDF error:', error);
        return { success: false, message: error.message };
    }
};

module.exports = { parsePDF };
