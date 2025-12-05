/**
 * Deterministic obstacle generation based on depth and seed.
 * Obstacles are generated in chunks as players descend,
 * and persist for the ascent phase.
 */

import type { Obstacle } from './types';
import { ObstacleType } from './types';
import type { SeededRNG } from './rng';
import {
    getObstacleDensity,
    CORAL_MIN_DEPTH,
    CORAL_MAX_DEPTH,
    ICE_MIN_DEPTH,
    ICE_MAX_DEPTH,
    TURTLE_MIN_DEPTH,
    TURTLE_MAX_DEPTH,
    OBSTACLE_SIZE,
    TURTLE_SPEED,
    WORLD_LEFT_BOUND,
    getWorldRightBound,
} from './config';

/** Chunk size for obstacle generation (in depth units) */
const CHUNK_SIZE = 100;

/**
 * Generate a unique ID for an obstacle based on its generation parameters.
 * This ensures the same obstacles are generated for the same depth chunk.
 */
function generateObstacleId(chunkIndex: number, obstacleIndex: number): string {
    return `obs_${chunkIndex}_${obstacleIndex}`;
}

/**
 * Determine which obstacle types can spawn at a given depth.
 */
function getAvailableTypes(depth: number): ObstacleType[] {
    const types: ObstacleType[] = [];

    if (depth >= CORAL_MIN_DEPTH && depth <= CORAL_MAX_DEPTH) {
        types.push(ObstacleType.Coral);
    }

    if (depth >= ICE_MIN_DEPTH && depth <= ICE_MAX_DEPTH) {
        types.push(ObstacleType.IceBlock);
    }

    if (depth >= TURTLE_MIN_DEPTH && depth <= TURTLE_MAX_DEPTH) {
        types.push(ObstacleType.SeaTurtle);
    }

    return types;
}

/**
 * Generate obstacles for a specific depth chunk.
 * This is deterministic - same RNG state + chunk = same obstacles.
 *
 * @param rng - Seeded RNG instance
 * @param chunkIndex - Which chunk to generate (chunk 0 = depth 0-100, etc.)
 */
function generateChunk(rng: SeededRNG, chunkIndex: number): Obstacle[] {
    const obstacles: Obstacle[] = [];
    const chunkStartDepth = chunkIndex * CHUNK_SIZE;
    const chunkEndDepth = chunkStartDepth + CHUNK_SIZE;
    const chunkMidDepth = (chunkStartDepth + chunkEndDepth) / 2;

    // Number of obstacles in this chunk (scales with depth for gradual difficulty)
    const baseDensity = getObstacleDensity(chunkMidDepth);
    const numObstacles = Math.floor(baseDensity + rng.next() * 1.5);

    for (let i = 0; i < numObstacles; i++) {
        // Random depth within the chunk
        const depth = rng.nextFloat(chunkStartDepth, chunkEndDepth);

        // Get available obstacle types at this depth
        const availableTypes = getAvailableTypes(depth);
        if (availableTypes.length === 0) {
            continue; // Skip if no valid types for this depth
        }

        // Pick a random type
        const type = rng.pick(availableTypes);
        const sizeConfig = OBSTACLE_SIZE[type];

        // Generate size
        const width = rng.nextFloat(sizeConfig.minW, sizeConfig.maxW);
        const height = rng.nextFloat(sizeConfig.minH, sizeConfig.maxH);

        // Generate horizontal position (within world bounds)
        const x = rng.nextFloat(WORLD_LEFT_BOUND, getWorldRightBound() - width);

        // Generate velocity for moving obstacles (turtles)
        let velocityX = 0;
        let velocityY = 0;
        if (type === ObstacleType.SeaTurtle) {
            // Turtles move horizontally, random direction
            velocityX = rng.nextBool() ? TURTLE_SPEED : -TURTLE_SPEED;
            // Small chance of slight vertical movement
            if (rng.nextBool(0.3)) {
                velocityY = rng.nextFloat(-10, 10);
            }
        }

        obstacles.push({
            id: generateObstacleId(chunkIndex, i),
            type,
            x,
            y: depth,
            width,
            height,
            velocityX,
            velocityY,
            active: true,
        });
    }

    return obstacles;
}

/**
 * Generate obstacles up to the specified depth.
 * Only generates new chunks that haven't been generated yet.
 *
 * @param rng - Seeded RNG instance
 * @param currentObstacles - Existing obstacles array
 * @param fromDepth - Depth already generated up to
 * @param toDepth - Depth to generate up to
 * @returns New array with all obstacles
 */
export function generateObstacles(
    rng: SeededRNG,
    currentObstacles: Obstacle[],
    fromDepth: number,
    toDepth: number
): Obstacle[] {
    const fromChunk = Math.floor(fromDepth / CHUNK_SIZE);
    const toChunk = Math.ceil(toDepth / CHUNK_SIZE);

    let newObstacles = [...currentObstacles];

    for (let chunkIndex = fromChunk; chunkIndex <= toChunk; chunkIndex++) {
        // Check if this chunk already exists
        const chunkPrefix = `obs_${chunkIndex}_`;
        const chunkExists = currentObstacles.some((o) => o.id.startsWith(chunkPrefix));

        if (!chunkExists) {
            const chunkObstacles = generateChunk(rng, chunkIndex);
            newObstacles = [...newObstacles, ...chunkObstacles];
        }
    }

    return newObstacles;
}

/**
 * Update obstacle positions (for moving obstacles like turtles).
 *
 * @param obstacles - Current obstacles
 * @param dt - Delta time in seconds
 * @returns Updated obstacles array
 */
export function updateObstacles(obstacles: Obstacle[], dt: number): Obstacle[] {
    return obstacles.map((obstacle) => {
        if (obstacle.velocityX === 0 && obstacle.velocityY === 0) {
            return obstacle;
        }

        let newX = obstacle.x + obstacle.velocityX * dt;
        let newVelocityX = obstacle.velocityX;

        // Bounce off walls
        if (newX < WORLD_LEFT_BOUND) {
            newX = WORLD_LEFT_BOUND;
            newVelocityX = -newVelocityX;
        } else if (newX + obstacle.width > getWorldRightBound()) {
            newX = getWorldRightBound() - obstacle.width;
            newVelocityX = -newVelocityX;
        }

        return {
            ...obstacle,
            x: newX,
            y: obstacle.y + obstacle.velocityY * dt,
            velocityX: newVelocityX,
        };
    });
}

/**
 * Get obstacles that are within a visible range of depth.
 * Used for efficient collision detection and rendering.
 *
 * @param obstacles - All obstacles
 * @param minDepth - Minimum visible depth
 * @param maxDepth - Maximum visible depth
 * @param buffer - Extra buffer zone
 */
export function getVisibleObstacles(
    obstacles: Obstacle[],
    minDepth: number,
    maxDepth: number,
    buffer: number = 100
): Obstacle[] {
    return obstacles.filter(
        (o) => o.active && o.y + o.height >= minDepth - buffer && o.y <= maxDepth + buffer
    );
}
