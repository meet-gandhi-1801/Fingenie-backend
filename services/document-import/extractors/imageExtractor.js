const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;

const extractTextWithOCR = async (buffer, mimeType) => {
    try {
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is missing');
        }
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = "Extract all text and tables from this document accurately. Preserve structure.";

        const imagePart = {
            inlineData: {
                data: buffer.toString('base64'),
                mimeType
            }
        };

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text();

        return {
            success: true,
            text,
            extractionMethod: 'ocr',
            pages: 1 // For image, it's 1 page. For PDF, we might need a different approach or rely on text extraction.
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

module.exports = { extractTextWithOCR };
