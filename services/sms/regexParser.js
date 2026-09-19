const { categorizeTransaction } = require('../categorizationService');

const bankPatterns = [
  {
    bank: 'HDFC',
    pattern: /Rs\.?\s*(\d+(?:\.\d{1,2})?)\s*(debited|credited).*?(?:to|at|for)\s+([A-Za-z0-9\s]+?)(?:\s+on|\s+via|\s+ref|\.)/i,
    amountIndex: 1,
    typeIndex: 2,
    merchantIndex: 3,
    confidence: 0.95
  },
  {
    bank: 'SBI',
    pattern: /(?:debited|credited)\s+with\s+Rs\.?\s*(\d+(?:\.\d{1,2})?).*?(?:to|at|for)\s+([A-Za-z0-9\s]+?)(?:\s+on|\s+via|\s+ref|\.)/i,
    amountIndex: 1,
    typeIndex: null,
    merchantIndex: 2,
    confidence: 0.92
  },
  {
    bank: 'ICICI',
    pattern: /Rs\.?\s*(\d+(?:\.\d{1,2})?)\s*(debited|credited).*?(?:info:|to|at|for)\s*([A-Za-z0-9\s]+?)(?:\.|$)/i,
    amountIndex: 1,
    typeIndex: 2,
    merchantIndex: 3,
    confidence: 0.92
  },
  {
    bank: 'Axis',
    pattern: /Rs\.?\s*(\d+(?:\.\d{1,2})?)\s*(debited|credited).*?(?:for|to|at)\s+([A-Za-z0-9\s]+?)(?:\s+on|\s+via|\.|$)/i,
    amountIndex: 1,
    typeIndex: 2,
    merchantIndex: 3,
    confidence: 0.90
  },
  {
    bank: 'Kotak',
    pattern: /INR\s*(\d+(?:\.\d{1,2})?)\s*(debited|credited).*?(?:to|at|for)\s+([A-Za-z0-9\s]+?)(?:\s+on|\.|$)/i,
    amountIndex: 1,
    typeIndex: 2,
    merchantIndex: 3,
    confidence: 0.90
  },
  {
    bank: 'UPI',
    pattern: /(?:UPI|upi).*?Rs\.?\s*(\d+(?:\.\d{1,2})?)\s*(debited|credited).*?(?:to|at|for)\s+([A-Za-z0-9\s]+?)(?:\s+on|\.|$)/i,
    amountIndex: 1,
    typeIndex: 2,
    merchantIndex: 3,
    confidence: 0.88
  },
  {
    bank: 'Generic',
    pattern: /(?:Rs|INR|rs)\.?\s*(\d+(?:\.\d{1,2})?).*?(debited|credited).*?(?:to|at|for|info:)\s*([A-Za-z0-9\s]{2,20})/i,
    amountIndex: 1,
    typeIndex: 2,
    merchantIndex: 3,
    confidence: 0.65
  }
];

// Detect bank from SMS content
const detectBank = (smsText) => {
  const lower = smsText.toLowerCase();
  if (lower.includes('upi')) return 'UPI';
  if (lower.includes('hdfc')) return 'HDFC';
  if (lower.includes('sbi') || lower.includes('state bank')) return 'SBI';
  if (lower.includes('icici')) return 'ICICI';
  if (lower.includes('axis')) return 'Axis';
  if (lower.includes('kotak')) return 'Kotak';
  return 'Generic';
};

// Validate extracted fields
const validateFields = (data) => {
  const issues = [];
  if (!data.amount || isNaN(data.amount) || data.amount <= 0) {
    issues.push('invalid_amount');
  }
  if (!data.type || !['credit', 'debit'].includes(data.type)) {
    issues.push('invalid_type');
  }
  if (!data.merchant || data.merchant.length < 2) {
    issues.push('missing_merchant');
  }
  return issues;
};

const parseWithRegex = (smsText) => {
  const cleanSMS = smsText.trim();
  const detectedBank = detectBank(cleanSMS);

  // Order patterns: detected bank first, then Generic
  const orderedPatterns = [
    ...bankPatterns.filter(p => p.bank === detectedBank),
    ...bankPatterns.filter(p => p.bank === 'Generic')
  ];

  for (const bankPattern of orderedPatterns) {
    const match = cleanSMS.match(bankPattern.pattern);

    if (match) {
      const amount = parseFloat(match[bankPattern.amountIndex]);

      let type = 'debit';
      if (bankPattern.typeIndex && match[bankPattern.typeIndex]) {
        type = match[bankPattern.typeIndex].toLowerCase().includes('credit')
          ? 'credit' : 'debit';
      } else {
        type = cleanSMS.toLowerCase().includes('credit') ? 'credit' : 'debit';
      }

      const merchant = match[bankPattern.merchantIndex]
        .trim()
        .replace(/\s+/g, ' ')
        .split(' ')
        .slice(0, 3)
        .join(' ');

      const { category } = categorizeTransaction(merchant, '');

      const data = { amount, type, merchant, category, bank: detectedBank };

      // Validate fields
      const issues = validateFields(data);

      // Reduce confidence if issues found
      let confidence = bankPattern.confidence;
      if (issues.length > 0) confidence -= issues.length * 0.2;
      if (detectedBank === 'Generic') confidence -= 0.1;

      return {
        success: true,
        source: 'regex',
        bank: detectedBank,
        confidence: Math.max(0, parseFloat(confidence.toFixed(2))),
        issues,
        data: {
          amount,
          type,
          merchant,
          category,
          date: null,
          source: 'sms',
          rawSMS: cleanSMS
        }
      };
    }
  }

  return {
    success: false,
    source: 'regex',
    confidence: 0,
    issues: ['no_pattern_matched'],
    data: null
  };
};

module.exports = { parseWithRegex };