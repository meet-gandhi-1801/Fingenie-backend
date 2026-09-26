const pdfParse = require('pdf-parse');

const extractTextFromPDF = async (buffer) => {
    try {
        const data = await pdfParse(buffer);
        // data.text contains the extracted text. If it's a scanned PDF, the text might be very short.
        // For page-level processing, pdf-parse doesn't strictly give arrays of pages easily unless we use custom render.
        // We'll treat it as one text block for this MVP or split by `\n\n` if needed.

        // Check if it looks scanned (too few characters compared to pages)
        const isScanned = data.text.trim().length < (data.numpages * 100);

        return {
            success: true,
            text: data.text,
            pages: data.numpages,
            isScanned,
            extractionMethod: 'pdf_text'
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

module.exports = { extractTextFromPDF };
