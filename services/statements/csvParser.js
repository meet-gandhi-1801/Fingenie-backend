const csv = require('csv-parser');
const { Readable } = require('stream');
const { categorizeTransaction } = require('../categorizationService');

// Common column name variations across banks
const COLUMN_ALIASES = {
  date: ['date', 'transaction date', 'txn date', 'value date', 'posting date'],
  description: ['description', 'narration', 'particulars', 'details', 'remarks', 'transaction details'],
  debit: ['debit', 'withdrawal', 'withdrawal amt', 'debit amount', 'dr'],
  credit: ['credit', 'deposit', 'deposit amt', 'credit amount', 'cr'],
  amount: ['amount', 'transaction amount', 'amt'],
  type: ['type', 'transaction type', 'dr/cr', 'cr/dr']
};

const findColumn = (headers, aliasKey) => {
  const aliases = COLUMN_ALIASES[aliasKey];
  return headers.find(h =>
    aliases.some(alias => h.toLowerCase().trim().includes(alias))
  );
};

const parseAmount = (str) => {
  if (!str) return 0;
  // Remove currency symbols, commas, spaces
  const cleaned = str.toString().replace(/[₹,\s]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

const parseDate = (str) => {
  if (!str) return new Date();

  // Try common Indian bank date formats
  const formats = [
    /(\d{2})[/-](\d{2})[/-](\d{4})/, // DD/MM/YYYY or DD-MM-YYYY
    /(\d{4})[/-](\d{2})[/-](\d{2})/, // YYYY-MM-DD
  ];

  for (const format of formats) {
    const match = str.match(format);
    if (match) {
      if (match[3] && match[3].length === 4) {
        // DD/MM/YYYY format
        return new Date(`${match[3]}-${match[2]}-${match[1]}`);
      } else if (match[1].length === 4) {
        // YYYY-MM-DD format
        return new Date(str);
      }
    }
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

const parseCSV = (buffer) => {
  return new Promise((resolve, reject) => {
    const rows = [];
    const stream = Readable.from(buffer.toString());

    stream
      .pipe(csv())
      .on('headers', (headers) => {
        rows.headers = headers;
      })
      .on('data', (row) => rows.push(row))
      .on('end', () => {
        try {
          if (rows.length === 0) {
            return resolve({ success: false, message: 'CSV file is empty', transactions: [] });
          }

          const headers = Object.keys(rows[0]);
          const dateCol = findColumn(headers, 'date');
          const descCol = findColumn(headers, 'description');
          const debitCol = findColumn(headers, 'debit');
          const creditCol = findColumn(headers, 'credit');
          const amountCol = findColumn(headers, 'amount');
          const typeCol = findColumn(headers, 'type');

          if (!dateCol || (!debitCol && !creditCol && !amountCol)) {
            return resolve({
              success: false,
              message: 'Could not detect required columns (date, amount). This CSV format may not be supported yet.',
              transactions: [],
              detectedHeaders: headers
            });
          }

          const transactions = rows.map((row, index) => {
            let amount = 0;
            let type = 'debit';

            if (debitCol && creditCol) {
              // Separate debit/credit columns
              const debitVal = parseAmount(row[debitCol]);
              const creditVal = parseAmount(row[creditCol]);
              if (creditVal > 0) {
                amount = creditVal;
                type = 'credit';
              } else {
                amount = debitVal;
                type = 'debit';
              }
            } else if (amountCol) {
              amount = Math.abs(parseAmount(row[amountCol]));
              if (typeCol) {
                const typeVal = (row[typeCol] || '').toLowerCase();
                type = typeVal.includes('cr') ? 'credit' : 'debit';
              } else {
                // Negative amount = debit, positive = credit (common convention)
                const rawAmount = parseAmount(row[amountCol]);
                type = rawAmount < 0 ? 'debit' : 'credit';
              }
            }

            const description = row[descCol] || 'Unknown';
            const { category } = categorizeTransaction(description, '');

            return {
              rowIndex: index,
              date: parseDate(row[dateCol]),
              merchant: description.slice(0, 50),
              description: description,
              amount,
              type,
              category,
              source: 'statement',
              valid: amount > 0
            };
          }).filter(t => t.valid);

          resolve({
            success: true,
            transactions,
            totalFound: rows.length,
            validCount: transactions.length
          });

        } catch (err) {
          reject(err);
        }
      })
      .on('error', (err) => reject(err));
  });
};

module.exports = { parseCSV };