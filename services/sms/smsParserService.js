const { parseWithRegex } = require('./regexParser');
const { parseWithAI } = require('./aiParser');

// Thresholds
const CONFIDENCE_THRESHOLD = 0.75;
const REQUIRED_FIELDS = ['amount', 'type', 'merchant'];

// Check if result needs AI fallback
const needsAIFallback = (regexResult) => {
  if (!regexResult.success) return true;
  if (regexResult.confidence < CONFIDENCE_THRESHOLD) return true;
  const missingFields = REQUIRED_FIELDS.filter(
    field => !regexResult.data[field]
  );
  if (missingFields.length > 0) return true;
  if (regexResult.issues && regexResult.issues.length > 0) return true;
  return false;
};

// Adjust confidence based on data quality
const adjustConfidence = (result) => {
  let confidence = result.confidence;

  if (!result.data) return confidence;

  // Penalize missing merchant
  if (!result.data.merchant || result.data.merchant === 'Unknown') {
    confidence -= 0.25;
  }

  // Penalize missing date
  if (!result.data.date) {
    confidence -= 0.05;
  }

  // Penalize unknown bank
  if (!result.bank || result.bank === 'Unknown') {
    confidence -= 0.10;
  }

  // Penalize Other category
  if (result.data.category === 'Other') {
    confidence -= 0.05;
  }

  return parseFloat(Math.max(0, confidence).toFixed(2));
};

// Merge regex and AI results
const mergeResults = (regexResult, aiResult) => {
  if (!aiResult.success) return regexResult;
  if (!regexResult.success) return aiResult;

  return {
    ...aiResult,
    source: 'hybrid',
    confidence: parseFloat(
      ((regexResult.confidence + aiResult.confidence) / 2).toFixed(2)
    ),
    data: {
      ...aiResult.data,
      amount: regexResult.data.amount || aiResult.data.amount,
      merchant: aiResult.data.merchant || regexResult.data.merchant,
      date: aiResult.data.date || regexResult.data.date,
    }
  };
};

const parseSMS = async (smsText) => {
  // Step 1: Try regex first
  const regexResult = parseWithRegex(smsText);

  // Step 2: Check if regex is good enough
  if (!needsAIFallback(regexResult)) {
    return {
      ...regexResult,
      usedAI: false,
      finalConfidence: regexResult.confidence,
      confidenceLabel:
        regexResult.confidence >= 0.85 ? 'High' :
        regexResult.confidence >= 0.65 ? 'Medium' : 'Low'
    };
  }

  // Step 3: Fallback to AI
  console.log(`SMS Parser: Regex confidence ${regexResult.confidence} — falling back to AI`);
  const aiResult = await parseWithAI(smsText);

  // Step 4: Adjust AI confidence based on data quality
  if (aiResult.success) {
    aiResult.confidence = adjustConfidence(aiResult);
  }

  // Step 5: Merge results
  const finalResult = mergeResults(regexResult, aiResult);

  return {
    ...finalResult,
    usedAI: true,
    finalConfidence: finalResult.confidence,
    confidenceLabel:
      finalResult.confidence >= 0.85 ? 'High' :
      finalResult.confidence >= 0.65 ? 'Medium' : 'Low'
  };
};

module.exports = { parseSMS };