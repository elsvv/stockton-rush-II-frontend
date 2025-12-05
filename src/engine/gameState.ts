/**
 * Core game state management and update logic.
 * This module is the heart of the deterministic game engine.
 */

import type {
    GameState,
    PlayerVehicle,
    PlayerId,
    PlayerInputFrame,
    AABB,
    EngineConfig,
    Obstacle,
    Passenger,
    Projectile,
    HPPickup,
} from './types';
import { ProjectileType } from './types';
import { PlayerState, DeathCause, GamePhase } from './types';
import { createRNG } from './rng';
import { generateObstacles, updateObstacles, getVisibleObstacles } from './obstacleGenerator';
import {
    SUB_WIDTH,
    SUB_HEIGHT,
    CAPSULE_WIDTH,
    CAPSULE_HEIGHT,
    SUB_STARTING_HP,
    CAPSULE_HP,
    PASSENGER_COUNT,
    HORIZONTAL_SPEED,
    VERTICAL_SPEED,
    BASE_DESCENT_SPEED,
    DESCENT_SPEED_FACTOR,
    ASCENT_SPEED,
    BASE_WEAR_RATE,
    DEPTH_WEAR_FACTOR,
    COLLISION_WEAR,
    COLLISION_DAMAGE,
    INVINCIBILITY_FRAMES,
    MAX_DEPTH,
    WORLD_LEFT_BOUND,
    getWorldRightBound,
    getPlayer1StartX,
    getPlayer2StartX,
    PLAYER_START_Y,
    OBSTACLE_GENERATION_BUFFER,
    SMALL_ROCKET_COUNT,
    SMALL_ROCKET_DAMAGE,
    MINE_DAMAGE,
    ROCKET_SPEED,
    MINE_LIFETIME,
    ROCKET_WIDTH,
    ROCKET_HEIGHT,
    MINE_SIZE,
    HP_PICKUP_CHANCE,
    HP_PICKUP_SIZE,
    HP_PICKUP_HEAL,
} from './config';

/** Create initial passengers for a submarine */
function createPassengers(): Passenger[] {
    return Array.from({ length: PASSENGER_COUNT }, () => ({
        alive: true,
        offsetX: 0,
        velocityX: 0,
    }));
}

/**
 * Create the initial game state from configuration.
 * This is the starting point for any game session.
 */
export function createInitialState(config: EngineConfig): GameState {
    const rng = createRNG(config.seed);

    const createPlayer = (startX: number): PlayerVehicle => ({
        x: startX,
        y: PLAYER_START_Y,
        velocityX: 0,
        velocityY: 0,
        width: SUB_WIDTH,
        height: SUB_HEIGHT,
        hp: SUB_STARTING_HP,
        wear: 0,
        state: PlayerState.Descending,
        maxDepthReached: PLAYER_START_Y,
        invincibilityFrames: 0,
        passengers: createPassengers(),
        implosionFrame: 0,
        rocketsRemaining: SMALL_ROCKET_COUNT,
        minesRemaining: 1,
    });

    return {
        frame: 0,
        seed: config.seed,
        rngState: rng.getState(),
        phase: GamePhase.Playing,
        introProgress: 1,
        players: {
            player1: createPlayer(getPlayer1StartX()),
            player2: createPlayer(getPlayer2StartX()),
        },
        obstacles: [],
        projectiles: [],
        pickups: [],
        gameOver: false,
        winner: null,
        generatedDepth: 0,
        currentMaxDepth: PLAYER_START_Y,
    };
}

/**
 * Check if two AABBs are colliding.
 */
function checkAABBCollision(a: AABB, b: AABB): boolean {
    return (
        a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
    );
}

/**
 * Calculate descent speed based on current depth.
 */
function calculateDescentSpeed(depth: number): number {
    const normalizedDepth = Math.min(depth / MAX_DEPTH, 1);
    return BASE_DESCENT_SPEED + normalizedDepth * DESCENT_SPEED_FACTOR;
}

/**
 * Calculate wear increase rate based on depth.
 */
function calculateWearRate(depth: number): number {
    const normalizedDepth = Math.min(depth / MAX_DEPTH, 1);
    return BASE_WEAR_RATE + normalizedDepth * DEPTH_WEAR_FACTOR;
}

/** Physics constants for passenger sway */
const PASSENGER_SWAY_DAMPING = 0.92;
const PASSENGER_SWAY_SPRING = 8;
const PASSENGER_SWAY_ACCELERATION = 15;
const MAX_PASSENGER_OFFSET = 8;

/**
 * Update passenger physics (sway when turning).
 */
function updatePassengerPhysics(
    passengers: Passenger[],
    acceleration: number,
    dt: number
): Passenger[] {
    return passengers.map((p) => {
        if (!p.alive) return p;

        // Apply acceleration force (opposite direction of sub movement)
        let newVelocityX = p.velocityX - acceleration * PASSENGER_SWAY_ACCELERATION * dt;

        // Apply spring force back to center
        newVelocityX -= p.offsetX * PASSENGER_SWAY_SPRING * dt;

        // Apply damping
        newVelocityX *= PASSENGER_SWAY_DAMPING;

        // Update position
        let newOffsetX = p.offsetX + newVelocityX * dt * 60;

        // Clamp offset
        newOffsetX = Math.max(-MAX_PASSENGER_OFFSET, Math.min(MAX_PASSENGER_OFFSET, newOffsetX));

        return {
            ...p,
            offsetX: newOffsetX,
            velocityX: newVelocityX,
        };
    });
}

/**
 * Kill a passenger (called when HP decreases).
 */
function killPassenger(passengers: Passenger[]): Passenger[] {
    const newPassengers = [...passengers];
    // Find the last alive passenger and kill them
    for (let i = newPassengers.length - 1; i >= 0; i--) {
        if (newPassengers[i].alive) {
            newPassengers[i] = { ...newPassengers[i], alive: false };
            break;
        }
    }
    return newPassengers;
}

/**
 * Update a single player's state for one frame.
 */
function updatePlayer(
    player: PlayerVehicle,
    input: PlayerInputFrame,
    obstacles: Obstacle[],
    dt: number
): { player: PlayerVehicle; collidedObstacles: string[] } {
    // Dead or escaped players don't update (but continue implosion animation)
    if (player.state === PlayerState.Dead || player.state === PlayerState.Escaped) {
        // Continue implosion animation
        if (player.implosionFrame > 0 && player.implosionFrame < 60) {
            return {
                player: { ...player, implosionFrame: player.implosionFrame + 1 },
                collidedObstacles: [],
            };
        }
        return { player, collidedObstacles: [] };
    }

    let newPlayer = { ...player };
    const collidedObstacles: string[] = [];
    const prevX = player.x;

    // Decrease invincibility frames
    if (newPlayer.invincibilityFrames > 0) {
        newPlayer.invincibilityFrames--;
    }

    // Handle dump ballast action (switch to ascending)
    if (input.action === 'dumpBallast' && player.state === PlayerState.Descending) {
        newPlayer = {
            ...newPlayer,
            state: PlayerState.Ascending,
            width: CAPSULE_WIDTH,
            height: CAPSULE_HEIGHT,
            hp: CAPSULE_HP,
            wear: 0,
            invincibilityFrames: INVINCIBILITY_FRAMES,
            passengers: [], // Capsule has no visible passengers
        };
    }

    // Horizontal movement
    let horizontalMove = 0;
    if (input.left) horizontalMove -= HORIZONTAL_SPEED * dt;
    if (input.right) horizontalMove += HORIZONTAL_SPEED * dt;

    newPlayer.x += horizontalMove;

    // Clamp to world bounds
    newPlayer.x = Math.max(
        WORLD_LEFT_BOUND,
        Math.min(getWorldRightBound() - newPlayer.width, newPlayer.x)
    );

    // Vertical player-controlled movement (up/down within screen)
    let verticalMove = 0;
    if (input.up) verticalMove -= VERTICAL_SPEED * dt;
    if (input.down) verticalMove += VERTICAL_SPEED * dt;

    // Calculate acceleration for passenger physics
    const acceleration = (newPlayer.x - prevX) / dt / HORIZONTAL_SPEED;
    newPlayer.velocityX = (newPlayer.x - prevX) / dt;
    newPlayer.velocityY = verticalMove / dt;

    // Update passenger physics
    if (newPlayer.state === PlayerState.Descending && newPlayer.passengers.length > 0) {
        newPlayer.passengers = updatePassengerPhysics(newPlayer.passengers, acceleration, dt);
    }

    // Vertical movement based on state
    if (newPlayer.state === PlayerState.Descending) {
        // Base descent speed (automatic)
        const baseSpeed = calculateDescentSpeed(newPlayer.y);
        // Add player-controlled vertical movement
        newPlayer.y += baseSpeed * dt + verticalMove;

        // Update max depth
        if (newPlayer.y > newPlayer.maxDepthReached) {
            newPlayer.maxDepthReached = newPlayer.y;
        }

        // Increase wear over time
        const wearRate = calculateWearRate(newPlayer.y);
        newPlayer.wear += wearRate * dt;

        // Check for implosion due to wear
        if (newPlayer.wear >= 100) {
            newPlayer.wear = 100;
            newPlayer.state = PlayerState.Dead;
            newPlayer.deathCause = DeathCause.Imploded;
            newPlayer.implosionFrame = 1; // Start implosion animation
            // Kill all passengers
            newPlayer.passengers = newPlayer.passengers.map((p) => ({ ...p, alive: false }));
            return { player: newPlayer, collidedObstacles };
        }
    } else if (newPlayer.state === PlayerState.Ascending) {
        // Capsule moves upward
        newPlayer.y -= ASCENT_SPEED * dt;

        // Check if reached surface
        if (newPlayer.y <= 0) {
            newPlayer.y = 0;
            newPlayer.state = PlayerState.Escaped;
            return { player: newPlayer, collidedObstacles };
        }
    }

    // Collision detection (only if not invincible)
    if (newPlayer.invincibilityFrames <= 0) {
        const playerBox: AABB = {
            x: newPlayer.x,
            y: newPlayer.y,
            width: newPlayer.width,
            height: newPlayer.height,
        };

        for (const obstacle of obstacles) {
            if (!obstacle.active) continue;

            const obstacleBox: AABB = {
                x: obstacle.x,
                y: obstacle.y,
                width: obstacle.width,
                height: obstacle.height,
            };

            if (checkAABBCollision(playerBox, obstacleBox)) {
                collidedObstacles.push(obstacle.id);

                if (newPlayer.state === PlayerState.Ascending) {
                    // Any collision during ascent = instant death
                    newPlayer.hp = 0;
                    newPlayer.state = PlayerState.Dead;
                    newPlayer.deathCause = DeathCause.CrashedAscent;
                    newPlayer.implosionFrame = 1;
                    return { player: newPlayer, collidedObstacles };
                } else {
                    // Descent collision - apply damage and wear
                    const damage = COLLISION_DAMAGE[obstacle.type];
                    const wear = COLLISION_WEAR[obstacle.type];

                    const prevHp = newPlayer.hp;
                    newPlayer.hp -= damage;
                    newPlayer.wear += wear;
                    newPlayer.invincibilityFrames = INVINCIBILITY_FRAMES;

                    // Kill passengers for each HP lost
                    for (let i = 0; i < prevHp - newPlayer.hp; i++) {
                        newPlayer.passengers = killPassenger(newPlayer.passengers);
                    }

                    // Check for death
                    if (newPlayer.hp <= 0 || newPlayer.wear >= 100) {
                        newPlayer.wear = Math.min(newPlayer.wear, 100);
                        newPlayer.state = PlayerState.Dead;
                        newPlayer.deathCause = DeathCause.Imploded;
                        newPlayer.implosionFrame = 1; // Start implosion animation
                        // Kill all remaining passengers
                        newPlayer.passengers = newPlayer.passengers.map((p) => ({
                            ...p,
                            alive: false,
                        }));
                        return { player: newPlayer, collidedObstacles };
                    }
                }
            }
        }
    }

    return { player: newPlayer, collidedObstacles };
}

/**
 * Determine the winner of the game.
 */
function determineWinner(players: Record<PlayerId, PlayerVehicle>): PlayerId | 'draw' | null {
    const p1 = players.player1;
    const p2 = players.player2;

    const p1Survived = p1.state === PlayerState.Escaped;
    const p2Survived = p2.state === PlayerState.Escaped;

    if (p1Survived && p2Survived) {
        // Both survived - deeper dive wins
        if (p1.maxDepthReached > p2.maxDepthReached) return 'player1';
        if (p2.maxDepthReached > p1.maxDepthReached) return 'player2';
        return 'draw';
    }

    if (p1Survived && !p2Survived) return 'player1';
    if (p2Survived && !p1Survived) return 'player2';

    // Both dead - deeper dive wins
    if (p1.maxDepthReached > p2.maxDepthReached) return 'player1';
    if (p2.maxDepthReached > p1.maxDepthReached) return 'player2';
    return 'draw';
}

/**
 * Check if the game is over.
 */
function isGameOver(players: Record<PlayerId, PlayerVehicle>): boolean {
    const p1Done =
        players.player1.state === PlayerState.Dead || players.player1.state === PlayerState.Escaped;
    const p2Done =
        players.player2.state === PlayerState.Dead || players.player2.state === PlayerState.Escaped;
    return p1Done && p2Done;
}

/**
 * Main game state update function.
 * This is the core of the deterministic simulation.
 *
 * @param state - Current game state
 * @param inputs - Player inputs for this frame
 * @param dt - Delta time (should be fixed for determinism)
 * @returns New game state
 */
export function updateGameState(
    state: GameState,
    inputs: Record<PlayerId, PlayerInputFrame>,
    dt: number
): GameState {
    // Don't update if game is over
    if (state.gameOver) {
        return state;
    }

    // Restore RNG state
    const rng = createRNG(state.seed);
    rng.setState(state.rngState);

    // Calculate the furthest depth any active player has reached
    let maxActiveDepth = 0;
    for (const player of Object.values(state.players)) {
        if (player.state === PlayerState.Descending || player.state === PlayerState.Ascending) {
            maxActiveDepth = Math.max(maxActiveDepth, player.y);
        }
    }

    // Generate new obstacles if needed
    const targetDepth = maxActiveDepth + OBSTACLE_GENERATION_BUFFER;
    let obstacles = state.obstacles;
    let generatedDepth = state.generatedDepth;

    if (targetDepth > generatedDepth) {
        obstacles = generateObstacles(rng, obstacles, generatedDepth, targetDepth);
        generatedDepth = targetDepth;
    }

    // Update obstacle positions (moving obstacles)
    obstacles = updateObstacles(obstacles, dt);

    // Get obstacles in the active range for collision detection
    const minDepth = Math.min(state.players.player1.y, state.players.player2.y);
    const visibleObstacles = getVisibleObstacles(obstacles, minDepth - 100, maxActiveDepth + 200);

    // Update players
    const p1Result = updatePlayer(state.players.player1, inputs.player1, visibleObstacles, dt);
    const p2Result = updatePlayer(state.players.player2, inputs.player2, visibleObstacles, dt);

    // Mark collided obstacles as inactive (so they don't trigger again)
    const allCollidedIds = new Set([...p1Result.collidedObstacles, ...p2Result.collidedObstacles]);
    obstacles = obstacles.map((o) => (allCollidedIds.has(o.id) ? { ...o, active: false } : o));

    // Update current max depth
    const newMaxDepth = Math.max(state.currentMaxDepth, p1Result.player.y, p2Result.player.y);

    // Create new state
    const newPlayers = {
        player1: p1Result.player,
        player2: p2Result.player,
    };

    const gameOver = isGameOver(newPlayers);
    const winner = gameOver ? determineWinner(newPlayers) : null;

    return {
        frame: state.frame + 1,
        seed: state.seed,
        rngState: rng.getState(),
        phase: gameOver ? GamePhase.GameOver : state.phase,
        introProgress: state.introProgress,
        players: newPlayers,
        obstacles,
        projectiles: state.projectiles, // TODO: Update projectiles
        pickups: state.pickups, // TODO: Update pickups
        gameOver,
        winner,
        generatedDepth,
        currentMaxDepth: newMaxDepth,
    };
}

/**
 * Get the result summary for display.
 */
export function getGameResults(state: GameState) {
    return {
        player1: {
            playerId: 'player1' as PlayerId,
            state: state.players.player1.state,
            maxDepth: state.players.player1.maxDepthReached,
            deathCause: state.players.player1.deathCause,
        },
        player2: {
            playerId: 'player2' as PlayerId,
            state: state.players.player2.state,
            maxDepth: state.players.player2.maxDepthReached,
            deathCause: state.players.player2.deathCause,
        },
        winner: state.winner,
        seed: state.seed,
    };
}
