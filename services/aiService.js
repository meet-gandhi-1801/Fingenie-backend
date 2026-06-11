const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const getFinancialAdvice = async (userMessage, financialContext) => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const systemPrompt = `You are FinGenie, a smart and friendly AI personal finance assistant for Indian users.

You have access to the user's real financial data provided below.
Always base your answers on this data — never make up numbers.
Be conversational, helpful, and specific.
Use Indian currency format (₹).
Keep responses concise but insightful — under 150 words.
If asked something outside finance, politely redirect to financial topics.

USER FINANCIAL DATA:
${financialContext}

Rules:
- Always refer to specific numbers from the data
- Point out patterns you notice
- Give actionable advice
- Be encouraging, not judgmental
- If data is insufficient, ask the user to add more transactions`;

    const fullPrompt = `${systemPrompt}

User question: ${userMessage}`;

    const result = await model.generateContent(fullPrompt);
    return {
      success: true,
      message: result.response.text()
    };

  } catch (error) {
    return {
      success: false,
      message: `AI error: ${error.message}`
    };
  }
};

module.exports = { getFinancialAdvice };