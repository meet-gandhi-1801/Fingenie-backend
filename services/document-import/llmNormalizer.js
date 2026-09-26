const { GoogleGenerativeAI } = require('@google/generative-ai');

const normalizeTransactionsWithLLM = async (candidates, apiKey) => {
    if (!apiKey) throw new Error('GEMINI_API_KEY is missing');
    const genAI = new GoogleGenerativeAI(apiKey);
    // using gemini-1.5-flash as it supports JSON Structured Output well
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Batch into chunks of 30
    const batchSize = 30;
    const batches = [];
    for (let i = 0; i < candidates.length; i += batchSize) {
        batches.push(candidates.slice(i, i + batchSize));
    }

    const allTransactions = [];

    for (const batch of batches) {
        const prompt = `
    You are a financial transaction normalizer.
    Given a list of transaction candidates extracted from a bank statement, convert them into normalized transactions.
    
    Rules:
    - Do not invent transactions.
    - Do not invent amounts. Preserve original amounts.
    - Determine debit vs credit.
    - Normalize merchant names when reasonably certain.
    - Use ONLY these categories: Food, Shopping, Travel, Rent, Bills, Health, Entertainment, Education, Investment, Salary, Other.
    - Default to "Other" if uncertain.
    - Set confidence between 0.0 and 1.0.
    - Output must be exactly in JSON adhering to the provided array structure, without markdown codeblocks! Just the JSON.

    Input Candidates:
    ${JSON.stringify(batch)}

    Output strictly a JSON with this expected schema format:
    {
      "transactions": [
        {
          "date": "YYYY-MM-DD",
          "amount": 100,
          "type": "debit" | "credit",
          "merchant": "Normalized Merchant",
          "category": "Category",
          "description": "Original description or cleaned",
          "confidence": 0.95,
          "originalText": "Raw line..."
        }
      ]
    }
    `;

        try {
            const result = await model.generateContent(prompt);
            let text = await result.response.text();
            // clean up backticks if any
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();

            const parsed = JSON.parse(text);
            if (parsed.transactions && Array.isArray(parsed.transactions)) {
                allTransactions.push(...parsed.transactions);
            }
        } catch (e) {
            console.error('LLM Normalization err:', e);
            // We could skip or put them in review, but if LLM fails, we continue others
        }
    }

    return allTransactions;
};

module.exports = { normalizeTransactionsWithLLM };
