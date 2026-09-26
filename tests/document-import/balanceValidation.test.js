const { validateBalance } = require('../../services/document-import/balanceValidation');

describe('Balance Validation', () => {
    it('should pass matching balance', () => {
        const metadata = { openingBalance: 1000, closingBalance: 1100 };
        const txs = [
            { type: 'credit', amount: 200 },
            { type: 'debit', amount: 100 }
        ];
        const res = validateBalance(metadata, txs);
        expect(res.passed).toBe(true);
    });

    it('should fail mismatching balance', () => {
        const metadata = { openingBalance: 1000, closingBalance: 1500 }; // Wait, wrong
        const txs = [
            { type: 'credit', amount: 200 },
            { type: 'debit', amount: 100 }
        ];
        // calculated = 1000 + 200 - 100 = 1100. Actual = 1500 -> diff 400
        const res = validateBalance(metadata, txs);
        expect(res.passed).toBe(false);
        expect(res.expectedClosingBalance).toBe(1100);
        expect(res.actualClosingBalance).toBe(1500);
    });

    it('should skip validation if metadata is missing', () => {
        const metadata = { openingBalance: null, closingBalance: null };
        const txs = [{ type: 'credit', amount: 200 }];
        const res = validateBalance(metadata, txs);
        expect(res.passed).toBe(true);
        expect(res.reason).toContain('Missing balance data');
    });
});
