const { categorizeTransaction } = require('./categorizationService');

// Regex patterns for different Indian banks
const smsPatterns = [

  // HDFC Bank
  // "Rs.450 debited from HDFC Bank A/c XX1234 to Zomato on 11-06-2026"
  {
    bank: 'HDFC',
    pattern: /Rs\.?\s*(\d+(?:\.\d{1,2})?)\s*(debited|credited).*?(?:to|at|for)\s+([A-Za-z0-9\s]+?)(?:\s+on|\s+via|\s+ref|\.)/i,
    amountIndex: 1,
    typeIndex: 2,
    merchantIndex: 3
  },

  // SBI
  // "Your A/c XX1234 is debited with Rs.500 on 11-06-26 transfer to Swiggy"
  {
    bank: 'SBI',
    pattern: /(?:debited|credited)\s+with\s+Rs\.?\s*(\d+(?:\.\d{1,2})?).*?(?:to|at|for)\s+([A-Za-z0-9\s]+?)(?:\s+on|\s+via|\s+ref|\.)/i,
    amountIndex: 1,
    typeIndex: null,
    merchantIndex: 2
  },

  // ICICI Bank
  // "ICICI Bank: Rs 1000.00 debited from A/c XX1234. Info: Uber"
  {
    bank: 'ICICI',
    pattern: /Rs\.?\s*(\d+(?:\.\d{1,2})?)\s*(debited|credited).*?(?:info:|to|at|for)\s*([A-Za-z0-9\s]+?)(?:\.|$)/i,
    amountIndex: 1,
    typeIndex: 2,
    merchantIndex: 3
  },

  // Axis Bank
  // "Rs.299 debited from Axis Bank a/c XX1234 for Netflix"
  {
    bank: 'Axis',
    pattern: /Rs\.?\s*(\d+(?:\.\d{1,2})?)\s*(debited|credited).*?(?:for|to|at)\s+([A-Za-z0-9\s]+?)(?:\s+on|\s+via|\.|$)/i,
    amountIndex: 1,
    typeIndex: 2,
    merchantIndex: 3
  },

  // Kotak Ban
  // "Kotak Bank: INR 500.00 debited. UPI to Zomato"
  {
    bank: 'Kotak',
    pattern: /INR\s*(\d+(?:\.\d{1,2})?)\s*(debited|credited).*?(?:to|at|for)\s+([A-Za-z0-9\s]+?)(?:\s+on|\.|$)/i,
    amountIndex: 1,
    typeIndex: 2,
    merchantIndex: 3
  },

  // Generic UPI pattern
  // "UPI: Rs.250 debited to Swiggy on 11/06/2026"
  {
    bank: 'UPI',
    pattern: /(?:UPI|upi).*?Rs\.?\s*(\d+(?:\.\d{1,2})?)\s*(debited|credited).*?(?:to|at|for)\s+([A-Za-z0-9\s]+?)(?:\s+on|\.|$)/i,
    amountIndex: 1,
    typeIndex: 2,
    merchantIndex: 3
  },

  // Generic fallback pattern
  // Catches most Indian bank SMS formats
  {
    bank: 'Generic',
    pattern: /(?:Rs|INR|rs)\.?\s*(\d+(?:\.\d{1,2})?).*?(debited|credited).*?(?:to|at|for|info:)\s*([A-Za-z0-9\s]{2,20})/i,
    amountIndex: 1,
    typeIndex: 2,
    merchantIndex: 3
  }
];

const parseSMS = (smsText) => {
  const cleanSMS = smsText.trim();
  const lowerSMS = cleanSMS.toLowerCase();

  // Detect bank from SMS content first
  let detectedBank = 'Generic';
  if (lowerSMS.includes('upi')) detectedBank = 'UPI';
  else if (lowerSMS.includes('hdfc')) detectedBank = 'HDFC';
  else if (lowerSMS.includes('sbi') || lowerSMS.includes('state bank')) detectedBank = 'SBI';
  else if (lowerSMS.includes('icici')) detectedBank = 'ICICI';
  else if (lowerSMS.includes('axis')) detectedBank = 'Axis';
  else if (lowerSMS.includes('kotak')) detectedBank = 'Kotak';

  // Now only try patterns for detected bank + generic fallback
  const orderedPatterns = [
    ...smsPatterns.filter(p => p.bank === detectedBank),
    ...smsPatterns.filter(p => p.bank === 'Generic')
  ];

  for (const bankPattern of orderedPatterns) {
    const match = cleanSMS.match(bankPattern.pattern);

    if (match) {
      const amount = parseFloat(match[bankPattern.amountIndex]);

      let type = 'debit';
      if (bankPattern.typeIndex && match[bankPattern.typeIndex]) {
        type = match[bankPattern.typeIndex].toLowerCase().includes('credit')
          ? 'credit'
          : 'debit';
      } else {
        type = lowerSMS.includes('credit') ? 'credit' : 'debit';
      }

      const merchant = match[bankPattern.merchantIndex]
        .trim()
        .replace(/\s+/g, ' ')
        .split(' ')
        .slice(0, 3)
        .join(' ');

      const { category, confidence } = categorizeTransaction(merchant, '');

      return {
        success: true,
        bank: detectedBank,
        data: {
          amount,
          type,
          merchant,
          category,
          confidence,
          source: 'sms',
          rawSMS: cleanSMS
        }
      };
    }
  }

  return {
    success: false,
    message: 'Could not parse SMS. Please add transaction manually.',
    rawSMS: cleanSMS
  };
};

module.exports = { parseSMS };