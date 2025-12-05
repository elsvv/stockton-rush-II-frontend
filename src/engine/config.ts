/**
 * Game configuration constants.
 * All tunable values for game balance and physics.
 */

import { ObstacleType } from './types';

/** Fixed time step for simulation (60 FPS) */
export const FIXED_DT = 1 / 60;

/** Default canvas dimensions (will be overridden by actual window size) */
export const DEFAULT_CANVAS_WIDTH = 1920;
export const DEFAULT_CANVAS_HEIGHT = 1080;

/** Dynamic canvas dimensions - set at runtime */
export let CANVAS_WIDTH = DEFAULT_CANVAS_WIDTH;
export let CANVAS_HEIGHT = DEFAULT_CANVAS_HEIGHT;

/** Update canvas dimensions (called on resize) */
export function setCanvasDimensions(width: number, height: number): void {
    CANVAS_WIDTH = width;
    CANVAS_HEIGHT = height;
}

/** Maximum depth before the "bottom" (Titanic wreck area) */
export const MAX_DEPTH = 10000;

/** Titanic wreck starts appearing at this depth */
export const TITANIC_DEPTH = MAX_DEPTH - 500;

/** Player submarine dimensions (larger for detailed view with portholes) */
export const SUB_WIDTH = 80;
export const SUB_HEIGHT = 40;

/** Escape capsule dimensions (smaller than sub) */
export const CAPSULE_WIDTH = 25;
export const CAPSULE_HEIGHT = 20;

/** Starting HP for submarines (one per passenger) */
export const SUB_STARTING_HP = 4;

/** Number of passengers in submarine */
export const PASSENGER_COUNT = 4;

/** Capsule HP (any hit = death) */
export const CAPSULE_HP = 1;

/** Horizontal movement speed (pixels per second) */
export const HORIZONTAL_SPEED = 200;

/** Base vertical descent speed (pixels per second) */
export const BASE_DESCENT_SPEED = 80;

/** Additional speed gained per unit of normalized depth (0-1) */
export const DESCENT_SPEED_FACTOR = 120;

/** Ascent speed for escape capsule (much faster than descent) */
export const ASCENT_SPEED = 350;

/** Base wear increase per second (reduced for easier start) */
export const BASE_WEAR_RATE = 0.3;

/** Additional wear rate multiplied by normalized depth */
export const DEPTH_WEAR_FACTOR = 1.5;

/** Wear increase on collision by obstacle type */
export const COLLISION_WEAR: Record<ObstacleType, number> = {
    [ObstacleType.Coral]: 5,
    [ObstacleType.IceBlock]: 12,
    [ObstacleType.SeaTurtle]: 4,
};

/** HP damage on collision by obstacle type */
export const COLLISION_DAMAGE: Record<ObstacleType, number> = {
    [ObstacleType.Coral]: 1,
    [ObstacleType.IceBlock]: 1,
    [ObstacleType.SeaTurtle]: 1,
};

/** Frames of invincibility after being hit */
export const INVINCIBILITY_FRAMES = 90; // 1.5 seconds (more forgiving)

/** Base obstacle spawn rate (obstacles per 100 depth units) - scales with depth */
export const OBSTACLE_DENSITY_MIN = 1.5; // At surface
export const OBSTACLE_DENSITY_MAX = 4.5; // At max depth

/** Calculate obstacle density based on depth (gradual difficulty) */
export function getObstacleDensity(depth: number): number {
    const normalizedDepth = Math.min(depth / MAX_DEPTH, 1);
    // Slow ramp up: starts easy, gets harder
    const curve = Math.pow(normalizedDepth, 0.7);
    return OBSTACLE_DENSITY_MIN + curve * (OBSTACLE_DENSITY_MAX - OBSTACLE_DENSITY_MIN);
}

/** Depth zones for obstacle types (extended for more variety) */
export const CORAL_MIN_DEPTH = 0;
export const CORAL_MAX_DEPTH = 6000; // Extended coral range
export const ICE_MIN_DEPTH = 2000; // Ice appears a bit earlier
export const ICE_MAX_DEPTH = MAX_DEPTH;
export const TURTLE_MIN_DEPTH = 800; // Turtles appear earlier for variety
export const TURTLE_MAX_DEPTH = 8000;

/** Obstacle size ranges */
export const OBSTACLE_SIZE = {
    [ObstacleType.Coral]: { minW: 30, maxW: 60, minH: 25, maxH: 50 },
    [ObstacleType.IceBlock]: { minW: 40, maxW: 80, minH: 30, maxH: 60 },
    [ObstacleType.SeaTurtle]: { minW: 35, maxW: 55, minH: 25, maxH: 40 },
};

/** Turtle movement speed */
export const TURTLE_SPEED = 30;

/** How far ahead to generate obstacles */
export const OBSTACLE_GENERATION_BUFFER = 800;

/** Player starting positions (use functions for dynamic width) */
export function getPlayer1StartX(): number {
    return CANVAS_WIDTH * 0.35;
}
export function getPlayer2StartX(): number {
    return CANVAS_WIDTH * 0.65;
}
export const PLAYER_START_Y = 50;

/** World bounds for horizontal movement (dynamic based on canvas width) */
export const WORLD_LEFT_BOUND = 20;
export function getWorldRightBound(): number {
    return CANVAS_WIDTH - 20;
}

/** Colors for visual rendering */
export const COLORS = {
    surface: '#87CEEB', // Light sky blue at surface
    midDepth: '#1E4D6B', // Darker blue at mid depth
    deepOcean: '#0A1628', // Almost black at great depth
    sub1: '#FFA500', // Orange for player 1 sub
    sub2: '#00FF7F', // Green for player 2 sub
    capsule1: '#FFD700', // Gold for player 1 capsule
    capsule2: '#7FFF00', // Chartreuse for player 2 capsule
    coral: '#FF6B6B', // Coral red/pink
    ice: '#ADD8E6', // Light blue for ice
    turtle: '#228B22', // Forest green for turtles
    titanic: '#4A4A4A', // Dark gray for the wreck
    hud: '#FFFFFF', // White for HUD text
    danger: '#FF0000', // Red for danger indicators
};
