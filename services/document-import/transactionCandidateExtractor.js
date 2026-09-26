const extractTransactionCandidates = (rawText) => {
    const lines = rawText.split('\n').filter(line => line.trim() !== '');
    const candidates = [];

    // Date regex matching common formats: DD/MM/YYYY, YYYY-MM-DD, DD-MMM-YYYY
    const dateRegex = /\b(\d{2}[\/\-]\d{2}[\/\-]\d{4}|\d{4}[\/\-]\d{2}[\/\-]\d{2}|\d{2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4})\b/i;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(dateRegex);
        if (match) {
            // It's a potential transaction line
            // Try to extract amounts (e.g. 1,000.00 or 1000.00)
            const amountRegex = /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)/g;
            let amounts = line.match(amountRegex) || [];
            amounts = amounts.filter(a => a.includes('.')); // Simple heuristic for money, often ends in .xx

            // If we don't find proper amounts, we can pass it anyway but LLM will help
            candidates.push({
                rawText: line,
                dateMatch: match[0],
                amountsMatch: amounts,
                page: 1 // default to 1 since we chunked the whole file together
            });
        }
    }

    // To avoid too naive candidates, maybe group lines if next line doesn't have a date (description continuation)
    return candidates;
};

module.exports = { extractTransactionCandidates };
