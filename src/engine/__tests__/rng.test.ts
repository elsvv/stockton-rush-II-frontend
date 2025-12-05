/**
 * Tests for the deterministic RNG.
 */

import { describe, it, expect } from 'vitest';
import { createRNG } from '../rng';

describe('SeededRNG', () => {
    it('produces the same sequence for the same seed', () => {
        const rng1 = createRNG(12345);
        const rng2 = createRNG(12345);

        const seq1 = Array.from({ length: 100 }, () => rng1.next());
        const seq2 = Array.from({ length: 100 }, () => rng2.next());

        expect(seq1).toEqual(seq2);
    });

    it('produces different sequences for different seeds', () => {
        const rng1 = createRNG(12345);
        const rng2 = createRNG(54321);

        const seq1 = Array.from({ length: 10 }, () => rng1.next());
        const seq2 = Array.from({ length: 10 }, () => rng2.next());

        expect(seq1).not.toEqual(seq2);
    });

    it('generates values in [0, 1)', () => {
        const rng = createRNG(99999);

        for (let i = 0; i < 1000; i++) {
            const value = rng.next();
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThan(1);
        }
    });

    it('nextInt generates values in the specified range', () => {
        const rng = createRNG(11111);

        for (let i = 0; i < 100; i++) {
            const value = rng.nextInt(5, 10);
            expect(value).toBeGreaterThanOrEqual(5);
            expect(value).toBeLessThanOrEqual(10);
            expect(Number.isInteger(value)).toBe(true);
        }
    });

    it('nextFloat generates values in the specified range', () => {
        const rng = createRNG(22222);

        for (let i = 0; i < 100; i++) {
            const value = rng.nextFloat(-5.5, 10.5);
            expect(value).toBeGreaterThanOrEqual(-5.5);
            expect(value).toBeLessThanOrEqual(10.5);
        }
    });

    it('can save and restore state', () => {
        const rng = createRNG(33333);

        // Generate some values
        for (let i = 0; i < 50; i++) {
            rng.next();
        }

        // Save state
        const savedState = rng.getState();

        // Generate more values
        const valuesAfterSave = Array.from({ length: 10 }, () => rng.next());

        // Create new RNG and restore state
        const rng2 = createRNG(1);
        rng2.setState(savedState);

        // Should produce same values
        const valuesFromRestored = Array.from({ length: 10 }, () => rng2.next());

        expect(valuesAfterSave).toEqual(valuesFromRestored);
    });

    it('clone produces independent RNG with same state', () => {
        const rng = createRNG(44444);
        for (let i = 0; i < 20; i++) rng.next();

        const cloned = rng.clone();

        // Both should produce same next value
        const val1 = rng.next();
        const val2 = cloned.next();
        expect(val1).toBe(val2);

        // But they should be independent
        rng.next();
        rng.next();
        rng.next();

        // Cloned should not be affected
        expect(cloned.next()).not.toBe(rng.next());
    });

    it('pick selects from array deterministically', () => {
        const rng1 = createRNG(55555);
        const rng2 = createRNG(55555);

        const items = ['a', 'b', 'c', 'd', 'e'];

        const picks1 = Array.from({ length: 20 }, () => rng1.pick(items));
        const picks2 = Array.from({ length: 20 }, () => rng2.pick(items));

        expect(picks1).toEqual(picks2);
    });
});
