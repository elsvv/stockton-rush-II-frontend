/**
 * Deterministic seeded random number generator.
 * Uses a Linear Congruential Generator (LCG) for reproducibility.
 *
 * Given the same seed and sequence of calls, this will always
 * produce the same sequence of numbers - essential for deterministic
 * game simulation and replay functionality.
 */

// LCG parameters (same as glibc)
const LCG_A = 1103515245;
const LCG_C = 12345;
const LCG_M = 2147483648; // 2^31

/**
 * Seeded RNG class that maintains its own state.
 * Can be serialized/deserialized for save states and replays.
 */
export class SeededRNG {
    private state: number;

    /**
     * Create a new RNG with the given seed.
     * @param seed - Initial seed value
     */
    constructor(seed: number) {
        // Ensure seed is a positive integer
        this.state = Math.abs(Math.floor(seed)) % LCG_M;
        if (this.state === 0) {
            this.state = 1; // Avoid zero state
        }
    }

    /**
     * Get the current internal state (for serialization).
     */
    getState(): number {
        return this.state;
    }

    /**
     * Set the internal state (for deserialization).
     * @param state - State value to restore
     */
    setState(state: number): void {
        this.state = state;
    }

    /**
     * Generate the next random number in [0, 1).
     */
    next(): number {
        this.state = (LCG_A * this.state + LCG_C) % LCG_M;
        return this.state / LCG_M;
    }

    /**
     * Generate a random integer in [min, max] (inclusive).
     * @param min - Minimum value (inclusive)
     * @param max - Maximum value (inclusive)
     */
    nextInt(min: number, max: number): number {
        const range = max - min + 1;
        return min + Math.floor(this.next() * range);
    }

    /**
     * Generate a random float in [min, max].
     * @param min - Minimum value
     * @param max - Maximum value
     */
    nextFloat(min: number, max: number): number {
        return min + this.next() * (max - min);
    }

    /**
     * Generate a random boolean with given probability of true.
     * @param probability - Probability of returning true (0-1)
     */
    nextBool(probability: number = 0.5): boolean {
        return this.next() < probability;
    }

    /**
     * Pick a random element from an array.
     * @param array - Array to pick from
     */
    pick<T>(array: T[]): T {
        if (array.length === 0) {
            throw new Error('Cannot pick from empty array');
        }
        return array[this.nextInt(0, array.length - 1)];
    }

    /**
     * Create a clone of this RNG with the same state.
     * Useful for "what-if" scenarios without affecting the main RNG.
     */
    clone(): SeededRNG {
        const cloned = new SeededRNG(1);
        cloned.state = this.state;
        return cloned;
    }
}

/**
 * Create a new seeded RNG from a given seed.
 * @param seed - Seed value
 */
export function createRNG(seed: number): SeededRNG {
    return new SeededRNG(seed);
}

/**
 * Generate a random seed using Math.random().
 * Used only for initial seed generation in the UI layer.
 */
export function generateRandomSeed(): number {
    return Math.floor(Math.random() * 1000000);
}
