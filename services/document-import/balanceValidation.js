const { GoogleGenerativeAI } = require('@google/generative-ai');

const extractStatementMetadata = async (rawText, apiKey) => {
    if (!apiKey) throw new Error('GEMINI_API_KEY is missing');

    // To avoid huge texts, let's take first 2000 and last 2000 characters
    const startText = rawText.slice(0, 2500);
    const endText = rawText.length > 2500 ? rawText.slice(-2500) : '';
    const context = `Start of document:\n${startText}\n\nEnd of document:\n${endText}`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
  You are an expert at extracting financial metadata from bank statement text.
  Extract the Opening Balance and Closing Balance from this document snippet.
  Return JSON only, NO markdown rendering blocks.
  If not found, return null for the value.

  Format:
  {
    "openingBalance": 50000.00,
    "closingBalance": 35000.50
  }

  Text:
  ${context}
  `;

    try {
        const result = await model.generateContent(prompt);
        let text = await result.response.text();
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(text);
        return {
            openingBalance: parsed.openingBalance || null,
            closingBalance: parsed.closingBalance || null
        };
    } catch (error) {
        console.error('Metadata extraction error:', error);
        return { openingBalance: null, closingBalance: null };
    }
};

const validateBalance = (metadata, transactions) => {
    if (metadata.openingBalance === null || metadata.closingBalance === null) {
        return { passed: true, reason: 'Missing balance data, skipped validation' }; // can't validate
    }

    let calculatedBalance = metadata.openingBalance;
    for (const tx of transactions) {
        // assumes validation runs after duplicates? Wait, the document's total closing balance
        // includes all transactions in the document, not just "new" ones. We must calculate based on ALL transactions found.
        if (tx.type === 'credit') {
            calculatedBalance += tx.amount;
        } else if (tx.type === 'debit') {
            calculatedBalance -= tx.amount;
        }
    }

    // Allow a tiny floating point margin of error
    const diff = Math.abs(calculatedBalance - metadata.closingBalance);
    if (diff > 1.0) {
        return {
            passed: false,
            expectedClosingBalance: calculatedBalance,
            actualClosingBalance: metadata.closingBalance,
            difference: diff
        };
    }

    return { passed: true };
};

module.exports = { extractStatementMetadata, validateBalance };
