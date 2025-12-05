/**
 * Tests for deterministic obstacle generation.
 */

import { describe, it, expect } from 'vitest';
import { generateObstacles, updateObstacles } from '../obstacleGenerator';
import { createRNG } from '../rng';
import { ObstacleType } from '../types';

describe('Obstacle Generation', () => {
    it('generates obstacles deterministically for same RNG state', () => {
        const rng1 = createRNG(12345);
        const rng2 = createRNG(12345);

        const obstacles1 = generateObstacles(rng1, [], 0, 500);
        const obstacles2 = generateObstacles(rng2, [], 0, 500);

        expect(obstacles1.length).toBe(obstacles2.length);

        for (let i = 0; i < obstacles1.length; i++) {
            expect(obstacles1[i].x).toBe(obstacles2[i].x);
            expect(obstacles1[i].y).toBe(obstacles2[i].y);
            expect(obstacles1[i].type).toBe(obstacles2[i].type);
            expect(obstacles1[i].width).toBe(obstacles2[i].width);
            expect(obstacles1[i].height).toBe(obstacles2[i].height);
        }
    });

    it('generates different obstacles for different seeds', () => {
        const rng1 = createRNG(11111);
        const rng2 = createRNG(22222);

        const obstacles1 = generateObstacles(rng1, [], 0, 500);
        const obstacles2 = generateObstacles(rng2, [], 0, 500);

        // Convert to string for comparison
        const str1 = JSON.stringify(obstacles1);
        const str2 = JSON.stringify(obstacles2);

        expect(str1).not.toBe(str2);
    });

    it('does not regenerate existing chunks', () => {
        const rng = createRNG(33333);

        // Generate first batch
        const obstacles1 = generateObstacles(rng, [], 0, 200);
        const count1 = obstacles1.length;

        // Generate more, should only add new ones
        const obstacles2 = generateObstacles(rng, obstacles1, 200, 400);

        // All original obstacles should still be there
        for (const o of obstacles1) {
            expect(obstacles2.find((o2) => o2.id === o.id)).toBeDefined();
        }

        // Should have more obstacles now
        expect(obstacles2.length).toBeGreaterThan(count1);
    });

    it('generates obstacles at appropriate depths', () => {
        const rng = createRNG(44444);

        // Generate obstacles for shallow depth
        const shallowObstacles = generateObstacles(rng, [], 0, 500);

        // Should have some coral at shallow depths
        const corals = shallowObstacles.filter((o) => o.type === ObstacleType.Coral);
        expect(corals.length).toBeGreaterThan(0);
    });

    it('generates unique IDs for obstacles', () => {
        const rng = createRNG(55555);

        const obstacles = generateObstacles(rng, [], 0, 1000);
        const ids = obstacles.map((o) => o.id);
        const uniqueIds = new Set(ids);

        expect(uniqueIds.size).toBe(ids.length);
    });
});

describe('Obstacle Updates', () => {
    it('moves obstacles with velocity', () => {
        const rng = createRNG(66666);
        let obstacles = generateObstacles(rng, [], 0, 500);

        // Find a turtle (they have velocity)
        const turtleIndex = obstacles.findIndex((o) => o.type === ObstacleType.SeaTurtle);

        if (turtleIndex !== -1) {
            const turtle = obstacles[turtleIndex];
            const initialX = turtle.x;
            const velocity = turtle.velocityX;

            // Update obstacles
            obstacles = updateObstacles(obstacles, 1.0); // 1 second

            const updatedTurtle = obstacles[turtleIndex];

            if (velocity !== 0) {
                expect(updatedTurtle.x).not.toBe(initialX);
            }
        }
    });

    it('stationary obstacles do not move', () => {
        const rng = createRNG(77777);
        let obstacles = generateObstacles(rng, [], 0, 500);

        // Find coral (they don't move)
        const coralIndex = obstacles.findIndex((o) => o.type === ObstacleType.Coral);

        if (coralIndex !== -1) {
            const coral = obstacles[coralIndex];
            const initialX = coral.x;
            const initialY = coral.y;

            // Update obstacles
            obstacles = updateObstacles(obstacles, 1.0);

            const updatedCoral = obstacles[coralIndex];
            expect(updatedCoral.x).toBe(initialX);
            expect(updatedCoral.y).toBe(initialY);
        }
    });
});
