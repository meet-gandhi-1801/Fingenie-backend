// Merchant keyword map - Brand specific lookups
const merchantCategoryMap = {
  // Food & Dining
  zomato: 'Food',
  swiggy: 'Food',
  dominos: 'Food',
  mcdonalds: 'Food',
  'burger king': 'Food',
  subway: 'Food',
  kfc: 'Food',
  pizzahut: 'Food',
  starbucks: 'Food',
  'cafe coffee day': 'Food',
  dunkin: 'Food',
  blinkit: 'Food',
  zepto: 'Food',
  instamart: 'Food',

  // Shopping
  amazon: 'Shopping',
  flipkart: 'Shopping',
  myntra: 'Shopping',
  ajio: 'Shopping',
  nykaa: 'Shopping',
  meesho: 'Shopping',
  snapdeal: 'Shopping',
  tatacliq: 'Shopping',

  // Travel
  uber: 'Travel',
  ola: 'Travel',
  rapido: 'Travel',
  irctc: 'Travel',
  makemytrip: 'Travel',
  goibibo: 'Travel',
  redbus: 'Travel',
  airbnb: 'Travel',
  indigo: 'Travel',
  spicejet: 'Travel',

  // Bills & Utilities
  airtel: 'Bills',
  jio: 'Bills',
  bsnl: 'Bills',
  vodafone: 'Bills',
  tata: 'Bills',
  bescom: 'Bills',
  msedcl: 'Bills',
  mahadiscom: 'Bills',
  electricity: 'Bills',
  broadband: 'Bills',

  // Entertainment
  netflix: 'Entertainment',
  spotify: 'Entertainment',
  hotstar: 'Entertainment',
  'disney+': 'Entertainment',
  youtube: 'Entertainment',
  'amazon prime': 'Entertainment',
  sonyliv: 'Entertainment',
  zee5: 'Entertainment',
  bookmyshow: 'Entertainment',

  // Health
  pharmeasy: 'Health',
  netmeds: 'Health',
  'apollo pharmacy': 'Health',
  medplus: 'Health',
  practo: 'Health',
  cult: 'Health',

  // Education
  udemy: 'Education',
  coursera: 'Education',
  unacademy: 'Education',
  byju: 'Education',
  'white hat': 'Education',
  leetcode: 'Education',

  // Investment
  zerodha: 'Investment',
  groww: 'Investment',
  upstox: 'Investment',
  coinswitch: 'Investment',
  wazirx: 'Investment',
  'mutual fund': 'Investment',
  sip: 'Investment',

  // Rent
  rent: 'Rent',
  landlord: 'Rent',
  housing: 'Rent',
  'paying guest': 'Rent',
  pg: 'Rent',
};

// Keyword based fallback
const keywordCategoryMap = {
  food: 'Food',
  restaurant: 'Food',
  cafe: 'Food',
  hotel: 'Food',
  dining: 'Food',
  lunch: 'Food',
  dinner: 'Food',
  breakfast: 'Food',
  grocery: 'Food',

  shop: 'Shopping',
  store: 'Shopping',
  mart: 'Shopping',
  mall: 'Shopping',
  

  cab: 'Travel',
  taxi: 'Travel',
  bus: 'Travel',
  train: 'Travel',
  flight: 'Travel',
  metro: 'Travel',
  petrol: 'Travel',
  fuel: 'Travel',

  rent: 'Rent',
  lease: 'Rent',

  bill: 'Bills',
  recharge: 'Bills',
  utility: 'Bills',
  electric: 'Bills',
  water: 'Bills',
  gas: 'Bills',
  internet: 'Bills',

  movie: 'Entertainment',
  game: 'Entertainment',
  sport: 'Entertainment',
  gym: 'Health',
  medical: 'Health',
  doctor: 'Health',
  hospital: 'Health',
  medicine: 'Health',
  pharmacy: 'Health',

  school: 'Education',
  college: 'Education',
  course: 'Education',
  book: 'Education',
  tuition: 'Education',

  salary: 'Salary',
  income: 'Salary',
  credit: 'Salary',
  investment: 'Investment',
  mutual: 'Investment',
};

// Helper: checks whole word match only
const matchesWholeWord = (text, keyword) => {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  return regex.test(text);
};

const categorizeTransaction = (merchant, description = '') => {
  const merchantText = merchant.toLowerCase().trim();
  const descriptionText = description.toLowerCase().trim();

  // 1. TRUE BRAND LOOKUP (High Confidence)
  // Check if the merchant string contains an exact, established brand name from your list
  // This ensures "Amazon" or "Zomato" always wins, even if the description says something odd.
  for (const [brand, category] of Object.entries(merchantCategoryMap)) {
    if (matchesWholeWord(merchantText, brand)) {
      return { category, confidence: 'high' };
    }
  }

  // 2. EXPLICIT DESCRIPTION KEYWORDS (Medium Confidence)
  // If it's an unknown merchant (like "XYZ Store"), we look at what you actually bought.
  // "medicine purchase" will match "medicine" here and return "Health".
  for (const [keyword, category] of Object.entries(keywordCategoryMap)) {
    if (matchesWholeWord(descriptionText, keyword)) {
      return { category, confidence: 'medium' };
    }
  }

  // 3. GENERIC MERCHANT KEYWORDS (Low Confidence fallback)
  // If the description is blank or unhelpful, we fall back to generic words inside the merchant name.
  // "XYZ Store" with an empty description will fall back to "Shopping" here because of "store".
  for (const [keyword, category] of Object.entries(keywordCategoryMap)) {
    if (matchesWholeWord(merchantText, keyword)) {
      return { category, confidence: 'low' };
    }
  }

  return { category: 'Other', confidence: 'low' };
};

module.exports = { categorizeTransaction };