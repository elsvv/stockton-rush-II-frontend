/**
 * Core types and enums for the Titan Escape game engine.
 * This file contains all shared types used across the engine.
 */

/** Unique identifier for players */
export type PlayerId = 'player1' | 'player2';

/** Current state of a player in the game */
export const PlayerState = {
    Intro: 'intro', // On the cargo ship, boarding
    Descending: 'descending',
    Ascending: 'ascending',
    Dead: 'dead',
    Escaped: 'escaped',
} as const;
export type PlayerState = (typeof PlayerState)[keyof typeof PlayerState];

/** Game phase */
export const GamePhase = {
    Intro: 'intro', // Cargo ship scene, submarines deploying
    Playing: 'playing', // Main gameplay
    GameOver: 'gameover', // Both players done
} as const;
export type GamePhase = (typeof GamePhase)[keyof typeof GamePhase];

/** Types of obstacles in the game */
export const ObstacleType = {
    Coral: 'coral',
    IceBlock: 'iceBlock',
    SeaTurtle: 'seaTurtle',
} as const;
export type ObstacleType = (typeof ObstacleType)[keyof typeof ObstacleType];

/** Cause of death for a player */
export const DeathCause = {
    Imploded: 'imploded', // Wear reached 100% or HP reached 0 during descent
    CrashedAscent: 'crashedAscent', // Collision during ascent
} as const;
export type DeathCause = (typeof DeathCause)[keyof typeof DeathCause];

/** Action that can be taken by a player */
export type PlayerAction = 'dumpBallast' | null;

/**
 * Input state for a single frame for one player.
 * Used for recording and replaying game sessions.
 */
export interface PlayerInputFrame {
    frame: number;
    left: boolean;
    right: boolean;
    action: PlayerAction;
}

/**
 * Represents an obstacle in the game world.
 * Obstacles are generated deterministically based on depth and seed.
 */
export interface Obstacle {
    id: string;
    type: ObstacleType;
    x: number; // Horizontal position (0-1 normalized, or pixel coords)
    y: number; // Depth position
    width: number;
    height: number;
    velocityX: number; // For moving obstacles like turtles
    velocityY: number;
    active: boolean; // Whether the obstacle can still cause collision
}

/**
 * Passenger in a submarine, with physics for visual sway.
 */
export interface Passenger {
    alive: boolean;
    offsetX: number; // Horizontal offset from center (for sway physics)
    velocityX: number; // Velocity for physics simulation
}

/**
 * State of a single player's vehicle (submarine or capsule).
 */
export interface PlayerVehicle {
    x: number; // Horizontal position
    y: number; // Depth (positive = deeper)
    velocityX: number; // For physics calculations
    width: number;
    height: number;
    hp: number;
    wear: number; // 0-100
    state: PlayerState;
    maxDepthReached: number;
    deathCause?: DeathCause;
    invincibilityFrames: number; // Brief invincibility after hit
    passengers: Passenger[]; // 4 passengers with physics
    implosionFrame: number; // Frame counter for implosion animation (0 = not imploding)
}

/**
 * Complete state of the game at any point in time.
 * Designed to be serializable and deterministically reproducible.
 */
export interface GameState {
    frame: number;
    seed: number;
    rngState: number; // Current state of the RNG
    phase: GamePhase; // Current game phase
    introProgress: number; // 0-1, progress through intro animation
    players: Record<PlayerId, PlayerVehicle>;
    obstacles: Obstacle[];
    gameOver: boolean;
    winner: PlayerId | 'draw' | null;
    /** Depth at which we've generated obstacles up to */
    generatedDepth: number;
    /** Highest depth any player has reached (for camera) */
    currentMaxDepth: number;
}

/**
 * Configuration for initializing the game engine.
 */
export interface EngineConfig {
    seed: number;
    maxDepth: number;
    canvasWidth: number;
    canvasHeight: number;
}

/**
 * Bounding box for collision detection.
 */
export interface AABB {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Result of a game session for display purposes.
 */
export interface PlayerResult {
    playerId: PlayerId;
    state: PlayerState;
    maxDepth: number;
    deathCause?: DeathCause;
}
