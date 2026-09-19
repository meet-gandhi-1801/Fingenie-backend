const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const AI_PROMPT = `You are a financial SMS parser for Indian bank messages.

Extract transaction details from the SMS and return ONLY a valid JSON object.
No explanation. No markdown. No code blocks. Just raw JSON.

Required JSON structure:
{
  "isTransaction": true or false,
  "amount": number or null,
  "type": "debit" or "credit" or null,
  "merchant": "merchant name" or null,
  "bank": "bank name" or null,
  "date": "YYYY-MM-DD" or null,
  "accountLast4": "1234" or null,
  "referenceNumber": "ref number" or null,
  "category": "Food" or "Shopping" or "Travel" or "Rent" or "Bills" or "Health" or "Entertainment" or "Education" or "Investment" or "Salary" or "Other",
  "confidence": number between 0 and 1,
  "reason": "brief explanation of confidence score"
}

Rules:
- If not a transaction SMS set isTransaction to false and all others null
- merchant = business name, NOT the bank name
- For UPI: extract merchant from UPI ID (zomato@okicici → Zomato)
- amount = plain number, no currency symbols or commas
- date = extract if present, format as YYYY-MM-DD
- confidence = how sure you are (0.9+ if all fields clear, 0.5-0.7 if some ambiguity)
- category must be exactly one of the listed options`;

// Validate AI response shape
const validateAIResponse = (parsed) => {
  const issues = [];

  if (typeof parsed.isTransaction !== 'boolean') {
    issues.push('invalid_isTransaction');
  }
  if (parsed.isTransaction) {
    if (!parsed.amount || typeof parsed.amount !== 'number' || parsed.amount <= 0) {
      issues.push('invalid_amount');
    }
    if (!['credit', 'debit'].includes(parsed.type)) {
      issues.push('invalid_type');
    }
    if (typeof parsed.confidence !== 'number' ||
        parsed.confidence < 0 ||
        parsed.confidence > 1) {
      issues.push('invalid_confidence');
      parsed.confidence = 0.5; // safe default
    }
  }

  return issues;
};

const parseWithAI = async (smsText) => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent(
      `${AI_PROMPT}\n\nSMS: "${smsText}"`
    );

    const rawText = result.response.text().trim();

    // Clean response — remove markdown if AI added it
    const cleanJSON = rawText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // Parse JSON
    let parsed;
    try {
      parsed = JSON.parse(cleanJSON);
    } catch (e) {
      return {
        success: false,
        source: 'ai',
        confidence: 0,
        issues: ['invalid_json_response'],
        data: null,
        rawAIResponse: rawText
      };
    }

    // Validate shape
    const issues = validateAIResponse(parsed);

    if (!parsed.isTransaction) {
      return {
        success: false,
        source: 'ai',
        confidence: 0,
        issues: ['not_a_transaction'],
        data: null
      };
    }

    // Never fully trust AI — cap confidence at 0.85
    const confidence = Math.min(
      parsed.confidence || 0.5,
      0.85
    );

    return {
      success: true,
      source: 'ai',
      bank: parsed.bank || 'Unknown',
      confidence: parseFloat(confidence.toFixed(2)),
      issues,
      data: {
        amount: parsed.amount,
        type: parsed.type,
        merchant: parsed.merchant || 'Unknown',
        category: parsed.category || 'Other',
        date: parsed.date || null,
        accountLast4: parsed.accountLast4 || null,
        referenceNumber: parsed.referenceNumber || null,
        source: 'sms',
        rawSMS: smsText
      }
    };

  } catch (error) {
    return {
      success: false,
      source: 'ai',
      confidence: 0,
      issues: [`ai_error: ${error.message}`],
      data: null
    };
  }
};

module.exports = { parseWithAI };