const { validateTransactionsBatch } = require('../../services/document-import/validationLayer');

describe('Validation Layer', () => {
    it('should validate complete correct transactions', () => {
        const input = [{
            date: '2026-09-05',
            amount: 150.50,
            type: 'debit',
            category: 'Food',
            confidence: 0.95
        }];
        const output = validateTransactionsBatch(input);
        expect(output[0].isValid).toBe(true);
        expect(output[0].requiresReview).toBe(false);
        expect(output[0].validationError).toBeNull();
    });

    it('should flag malformed amounts for review', () => {
        const input = [{ date: '2026-09-05', amount: -50, type: 'debit', category: 'Food', confidence: 0.9 }];
        const output = validateTransactionsBatch(input);
        expect(output[0].requiresReview).toBe(true);
        expect(output[0].validationError).toContain('Invalid amount');
    });

    it('should flag unknown categories and mutate them to Other', () => {
        const input = [{ date: '2026-09-05', amount: 50, type: 'credit', category: 'UnknownCat', confidence: 0.9 }];
        const output = validateTransactionsBatch(input);
        expect(output[0].category).toBe('Other');
        expect(output[0].requiresReview).toBe(false); // as long as confidence is > 0.85
    });

    it('should require review for low confidence', () => {
        const input = [{ date: '2026-09-05', amount: 50, type: 'credit', category: 'Food', confidence: 0.5 }];
        const output = validateTransactionsBatch(input);
        expect(output[0].requiresReview).toBe(true);
    });
});
