/**
 * Canvas component for rendering the game state.
 * Handles drawing submarines, capsules, obstacles, and the ocean environment.
 * Supports fullscreen rendering.
 */

import { useRef, useEffect, useCallback } from 'react';
import type {
    GameState,
    PlayerVehicle,
    Obstacle,
    PlayerId,
    Passenger,
    Projectile,
    Pickup,
} from '../engine/types';
import { PlayerState, ObstacleType, ProjectileType, PickupType } from '../engine/types';
import { COLORS, MAX_DEPTH, TITANIC_DEPTH, PASSENGER_COUNT } from '../engine/config';

interface GameCanvasProps {
    gameState: GameState;
    width: number;
    height: number;
}

/** Sprite cache for loaded images */
const spriteCache: Map<string, HTMLImageElement> = new Map();
const spriteLoadPromises: Map<string, Promise<HTMLImageElement>> = new Map();

/** Load a sprite image (cached) */
function loadSprite(src: string): HTMLImageElement | null {
    if (spriteCache.has(src)) {
        return spriteCache.get(src)!;
    }

    if (!spriteLoadPromises.has(src)) {
        const img = new Image();
        const promise = new Promise<HTMLImageElement>((resolve, reject) => {
            img.onload = () => {
                spriteCache.set(src, img);
                resolve(img);
            };
            img.onerror = reject;
        });
        img.src = src;
        spriteLoadPromises.set(src, promise);
    }

    return null;
}

/** Get sprite for obstacle based on type and id */
function getObstacleSprite(obstacle: Obstacle): string {
    // Use obstacle ID to determine which sprite variant to use (deterministic)
    const hash = obstacle.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

    switch (obstacle.type) {
        case ObstacleType.Coral:
            const flowerNum = (hash % 3) + 1; // 1, 2, or 3
            return `/flower${flowerNum}.png`;
        case ObstacleType.IceBlock:
            const iceNum = (hash % 2) + 1; // 1 or 2
            return `/ice${iceNum}.png`;
        case ObstacleType.SeaTurtle:
            const turtNum = (hash % 3) + 1; // 1, 2, or 3
            return `/turt${turtNum}.png`;
        default:
            return `/flower1.png`;
    }
}

/** Preload all game sprites */
function preloadSprites(): void {
    const sprites = [
        '/eject.png',
        '/flower1.png',
        '/flower2.png',
        '/flower3.png',
        '/hpitem.png',
        '/ice1.png',
        '/ice2.png',
        '/ship.png',
        '/turt1.png',
        '/turt2.png',
        '/turt3.png',
    ];
    sprites.forEach((src) => loadSprite(src));
}

/** Get water color based on depth (gradient from light blue to very dark) */
function getWaterColor(depth: number): string {
    const normalizedDepth = Math.min(depth / MAX_DEPTH, 1);

    // Use exponential curve for more dramatic darkening
    const darkeningFactor = Math.pow(normalizedDepth, 0.6);

    // Surface: light blue (135, 206, 235)
    // Deep: very dark navy (5, 10, 20)
    const r = Math.floor(135 * (1 - darkeningFactor) + 5 * darkeningFactor);
    const g = Math.floor(206 * (1 - darkeningFactor) + 10 * darkeningFactor);
    const b = Math.floor(235 * (1 - darkeningFactor) + 25 * darkeningFactor);

    return `rgb(${r}, ${g}, ${b})`;
}

/** Get darkness overlay opacity based on depth */
function getDarknessOverlay(depth: number): number {
    const normalizedDepth = Math.min(depth / MAX_DEPTH, 1);
    // Exponential darkening - gets very dark at max depth
    return Math.pow(normalizedDepth, 0.5) * 0.7;
}

/** Get base obstacle visibility based on depth (100% at surface → 10% at max depth) */
function getDepthVisibility(depth: number): number {
    const normalizedDepth = Math.min(depth / MAX_DEPTH, 1);
    // Linear interpolation from 1.0 (100%) to 0.1 (10%)
    return 1.0 - normalizedDepth * 0.9;
}

/** Flashlight configuration */
const FLASHLIGHT_CONFIG = {
    coneAngle: Math.PI / 4, // 45 degree cone
    range: 250, // How far the light reaches
    coneWidth: 180, // Width at max range
};

/** Check if a point is within a submarine's flashlight cone */
function isInFlashlight(
    obstacleX: number,
    obstacleY: number,
    obstacleWidth: number,
    obstacleHeight: number,
    subX: number,
    subY: number,
    subWidth: number,
    subHeight: number
): boolean {
    // Flashlight origin is at bottom center of submarine
    const lightX = subX + subWidth / 2;
    const lightY = subY + subHeight;

    // Check multiple points on the obstacle
    const checkPoints = [
        { x: obstacleX + obstacleWidth / 2, y: obstacleY + obstacleHeight / 2 }, // Center
        { x: obstacleX, y: obstacleY }, // Top-left
        { x: obstacleX + obstacleWidth, y: obstacleY }, // Top-right
    ];

    for (const point of checkPoints) {
        // Only illuminate obstacles BELOW the submarine
        if (point.y < lightY) continue;

        const dy = point.y - lightY;
        const dx = Math.abs(point.x - lightX);

        // Check if within range
        if (dy > FLASHLIGHT_CONFIG.range) continue;

        // Calculate cone width at this distance (expands with distance)
        const coneWidthAtDistance = (dy / FLASHLIGHT_CONFIG.range) * FLASHLIGHT_CONFIG.coneWidth;

        // Check if point is within cone
        if (dx <= coneWidthAtDistance / 2 + obstacleWidth / 2) {
            return true;
        }
    }

    return false;
}

/** Calculate final visibility for an obstacle considering depth and flashlights */
function getObstacleVisibility(
    obstacle: Obstacle,
    players: Record<PlayerId, PlayerVehicle>
): number {
    const baseVisibility = getDepthVisibility(obstacle.y);

    // Check if obstacle is lit by any submarine's flashlight
    for (const player of Object.values(players)) {
        if (player.state === PlayerState.Dead || player.state === PlayerState.Escaped) continue;
        if (player.state === PlayerState.Ascending) continue; // Capsule has no flashlight

        if (
            isInFlashlight(
                obstacle.x,
                obstacle.y,
                obstacle.width,
                obstacle.height,
                player.x,
                player.y,
                player.width,
                player.height
            )
        ) {
            return 1.0; // 100% visible in flashlight
        }
    }

    return baseVisibility;
}

/** Determine camera mode and viewports based on player states */
function getCameraMode(players: Record<PlayerId, PlayerVehicle>): {
    mode: 'single' | 'split';
    descendingPlayer: PlayerId | null;
    ascendingPlayer: PlayerId | null;
} {
    const p1 = players.player1;
    const p2 = players.player2;

    const p1Ascending = p1.state === PlayerState.Ascending;
    const p2Ascending = p2.state === PlayerState.Ascending;
    const p1Descending = p1.state === PlayerState.Descending;
    const p2Descending = p2.state === PlayerState.Descending;

    // If one is ascending and one is descending, use split screen
    if ((p1Ascending || p2Ascending) && (p1Descending || p2Descending)) {
        return {
            mode: 'split',
            descendingPlayer: p1Descending ? 'player1' : 'player2',
            ascendingPlayer: p1Ascending ? 'player1' : 'player2',
        };
    }

    // Otherwise single view
    return {
        mode: 'single',
        descendingPlayer: p1Descending ? 'player1' : p2Descending ? 'player2' : null,
        ascendingPlayer: p1Ascending ? 'player1' : p2Ascending ? 'player2' : null,
    };
}

/** Draw a cargo ship at the surface */
function drawCargoShip(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    cameraY: number,
    canvasHeight: number
) {
    const surfaceY = 0 - cameraY + canvasHeight / 2;

    // Only draw if visible
    if (surfaceY < -200 || surfaceY > canvasHeight + 100) return;

    ctx.save();

    // Try to use sprite
    const sprite = loadSprite('/ship.png');
    const shipWidth = 300;
    const shipHeight = 150;

    if (sprite) {
        ctx.drawImage(
            sprite,
            centerX - shipWidth / 2,
            surfaceY - shipHeight + 30, // Position so bottom is at water line
            shipWidth,
            shipHeight
        );
    } else {
        // Fallback to simple shape
        ctx.fillStyle = '#2A2A2A';
        ctx.beginPath();
        ctx.moveTo(centerX - 120, surfaceY - 20);
        ctx.lineTo(centerX + 120, surfaceY - 20);
        ctx.lineTo(centerX + 100, surfaceY + 30);
        ctx.lineTo(centerX - 100, surfaceY + 30);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#4A4A4A';
        ctx.fillRect(centerX - 110, surfaceY - 40, 220, 20);

        ctx.fillStyle = '#3A3A3A';
        ctx.fillRect(centerX - 30, surfaceY - 70, 60, 30);
    }

    // Surface water line
    ctx.fillStyle = 'rgba(135, 206, 235, 0.5)';
    ctx.fillRect(0, surfaceY, ctx.canvas.width, 10);

    ctx.restore();
}

/** Draw a passenger inside a porthole */
function drawPassenger(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    passenger: Passenger,
    color: string
) {
    if (!passenger.alive) return;

    const offsetX = passenger.offsetX;

    ctx.save();

    // Head
    ctx.fillStyle = '#FFD5B4'; // Skin tone
    ctx.beginPath();
    ctx.arc(x + offsetX, y - 2, 4, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x + offsetX, y + 5, 3, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

/** Draw a submarine with portholes and passengers */
function drawSubmarine(
    ctx: CanvasRenderingContext2D,
    player: PlayerVehicle,
    color: string,
    cameraY: number,
    canvasHeight: number,
    isPlayer1: boolean
) {
    const screenY = player.y - cameraY + canvasHeight / 2;
    const centerX = player.x + player.width / 2;
    const centerY = screenY + player.height / 2;

    ctx.save();

    // Check for implosion
    if (player.implosionFrame > 0) {
        drawImplosion(ctx, player, centerX, centerY, color);
        ctx.restore();
        return;
    }

    // Main body (elongated ellipse - submarine shape)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, player.width / 2, player.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Darker bottom half for depth
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY + 3, player.width / 2 - 2, player.height / 2 - 2, 0, 0, Math.PI);
    ctx.fill();

    // Conning tower (top fin)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY - player.height / 2 + 2, 10, 8, 0, Math.PI, 0);
    ctx.fill();

    // Propeller at back
    ctx.fillStyle = '#444';
    const propX = player.x - 8;
    ctx.beginPath();
    ctx.ellipse(propX, centerY, 5, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Propeller blades
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(propX, centerY - 12);
    ctx.lineTo(propX, centerY + 12);
    ctx.stroke();

    // Draw portholes with passengers
    const portholeSpacing = player.width / (PASSENGER_COUNT + 1);
    const portholeY = centerY;

    for (let i = 0; i < PASSENGER_COUNT; i++) {
        const portholeX = player.x + portholeSpacing * (i + 1);

        // Porthole frame (darker)
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(portholeX, portholeY, 8, 0, Math.PI * 2);
        ctx.fill();

        // Porthole glass (blue tint)
        ctx.fillStyle = player.passengers[i]?.alive ? '#4488AA' : '#223344';
        ctx.beginPath();
        ctx.arc(portholeX, portholeY, 6, 0, Math.PI * 2);
        ctx.fill();

        // Draw passenger if alive
        if (player.passengers[i]) {
            drawPassenger(
                ctx,
                portholeX,
                portholeY,
                player.passengers[i],
                isPlayer1 ? '#FF6600' : '#00CC66'
            );
        }
    }

    // Front viewport (larger)
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(player.x + player.width - 12, centerY, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6699BB';
    ctx.beginPath();
    ctx.arc(player.x + player.width - 12, centerY, 7, 0, Math.PI * 2);
    ctx.fill();

    // Light beam from front
    ctx.fillStyle = 'rgba(255, 255, 200, 0.1)';
    ctx.beginPath();
    ctx.moveTo(player.x + player.width - 5, centerY - 5);
    ctx.lineTo(player.x + player.width + 50, centerY - 30);
    ctx.lineTo(player.x + player.width + 50, centerY + 30);
    ctx.lineTo(player.x + player.width - 5, centerY + 5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

/** Draw implosion animation */
function drawImplosion(
    ctx: CanvasRenderingContext2D,
    player: PlayerVehicle,
    centerX: number,
    centerY: number,
    color: string
) {
    const progress = Math.min(player.implosionFrame / 30, 1);
    const crushAmount = progress * 0.7;

    // Crushed submarine
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(
        centerX,
        centerY,
        (player.width / 2) * (1 - crushAmount),
        (player.height / 2) * (1 + crushAmount * 0.5),
        0,
        0,
        Math.PI * 2
    );
    ctx.fill();

    // Blood/debris cloud
    if (progress > 0.2) {
        const cloudProgress = (progress - 0.2) / 0.8;
        const cloudRadius = 30 + cloudProgress * 50;

        // Red blood cloud
        const gradient = ctx.createRadialGradient(
            centerX,
            centerY,
            0,
            centerX,
            centerY,
            cloudRadius
        );
        gradient.addColorStop(0, `rgba(139, 0, 0, ${0.8 * (1 - cloudProgress)})`);
        gradient.addColorStop(0.5, `rgba(180, 20, 20, ${0.5 * (1 - cloudProgress)})`);
        gradient.addColorStop(1, 'rgba(100, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, cloudRadius, 0, Math.PI * 2);
        ctx.fill();

        // Debris particles
        ctx.fillStyle = '#333';
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 + progress * 2;
            const dist = cloudProgress * 40;
            const px = centerX + Math.cos(angle) * dist;
            const py = centerY + Math.sin(angle) * dist;
            ctx.fillRect(px - 2, py - 2, 4, 4);
        }
    }
}

/** Draw an escape capsule */
function drawCapsule(
    ctx: CanvasRenderingContext2D,
    player: PlayerVehicle,
    color: string,
    cameraY: number,
    canvasHeight: number
) {
    const screenY = player.y - cameraY + canvasHeight / 2;

    ctx.save();

    // Try to use sprite
    const sprite = loadSprite('/eject.png');

    if (sprite) {
        // Draw capsule sprite (scale to fit player dimensions)
        const capsuleWidth = player.width * 1.5;
        const capsuleHeight = player.height * 1.5;
        ctx.drawImage(
            sprite,
            player.x - (capsuleWidth - player.width) / 2,
            screenY - (capsuleHeight - player.height) / 2,
            capsuleWidth,
            capsuleHeight
        );
    } else {
        // Fallback
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(player.x, screenY, player.width, player.height, 8);
        ctx.fill();
    }

    // Bubbles rising up (visual only)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(player.x + player.width / 2, screenY + player.height + 10, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(player.x + player.width / 2 - 8, screenY + player.height + 20, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

/** Draw an obstacle */
function drawObstacle(
    ctx: CanvasRenderingContext2D,
    obstacle: Obstacle,
    cameraY: number,
    canvasHeight: number,
    visibility: number = 1.0
) {
    if (!obstacle.active) return;

    const screenY = obstacle.y - cameraY + canvasHeight / 2;

    // Skip if off-screen
    if (screenY + obstacle.height < 0 || screenY > canvasHeight) return;

    ctx.save();

    // Apply visibility (lower opacity for harder to see obstacles)
    ctx.globalAlpha = visibility;

    // Try to use sprite
    const spriteSrc = getObstacleSprite(obstacle);
    const sprite = loadSprite(spriteSrc);

    if (sprite) {
        // Flip sprite based on velocity direction for turtles
        const flipX = obstacle.type === ObstacleType.SeaTurtle && obstacle.velocityX < 0;

        if (flipX) {
            ctx.translate(obstacle.x + obstacle.width, screenY);
            ctx.scale(-1, 1);
            ctx.drawImage(sprite, 0, 0, obstacle.width, obstacle.height);
        } else {
            ctx.drawImage(sprite, obstacle.x, screenY, obstacle.width, obstacle.height);
        }
    } else {
        // Fallback to simple shapes while sprites load
        switch (obstacle.type) {
            case ObstacleType.Coral:
                ctx.fillStyle = COLORS.coral;
                ctx.beginPath();
                ctx.moveTo(obstacle.x, screenY + obstacle.height);
                ctx.lineTo(obstacle.x + obstacle.width * 0.3, screenY);
                ctx.lineTo(obstacle.x + obstacle.width * 0.5, screenY + obstacle.height * 0.3);
                ctx.lineTo(obstacle.x + obstacle.width * 0.7, screenY);
                ctx.lineTo(obstacle.x + obstacle.width, screenY + obstacle.height);
                ctx.closePath();
                ctx.fill();
                break;

            case ObstacleType.IceBlock:
                ctx.fillStyle = COLORS.ice;
                ctx.fillRect(obstacle.x, screenY, obstacle.width, obstacle.height);
                break;

            case ObstacleType.SeaTurtle:
                ctx.fillStyle = COLORS.turtle;
                ctx.beginPath();
                ctx.ellipse(
                    obstacle.x + obstacle.width / 2,
                    screenY + obstacle.height / 2,
                    obstacle.width / 2,
                    obstacle.height / 2.5,
                    0,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
                break;
        }
    }

    ctx.restore();
}

/** Draw the Titanic wreck in the background */
function drawTitanic(
    ctx: CanvasRenderingContext2D,
    cameraY: number,
    canvasWidth: number,
    canvasHeight: number
) {
    const screenY = TITANIC_DEPTH - cameraY + canvasHeight / 2;

    // Only draw if visible
    if (screenY > canvasHeight + 200 || screenY < -400) return;

    ctx.save();
    ctx.fillStyle = COLORS.titanic;
    ctx.globalAlpha = 0.6;

    // Simplified Titanic silhouette
    const baseX = canvasWidth / 2 - 150;

    // Hull
    ctx.beginPath();
    ctx.moveTo(baseX, screenY);
    ctx.lineTo(baseX + 300, screenY);
    ctx.lineTo(baseX + 280, screenY + 80);
    ctx.lineTo(baseX + 20, screenY + 80);
    ctx.closePath();
    ctx.fill();

    // Broken section
    ctx.beginPath();
    ctx.moveTo(baseX + 120, screenY);
    ctx.lineTo(baseX + 140, screenY - 40);
    ctx.lineTo(baseX + 160, screenY);
    ctx.closePath();
    ctx.fill();

    // Smokestacks
    ctx.fillRect(baseX + 80, screenY - 50, 20, 50);
    ctx.fillRect(baseX + 200, screenY - 40, 20, 40);

    ctx.restore();
}

/** Draw a projectile (rocket or mine) */
function drawProjectile(
    ctx: CanvasRenderingContext2D,
    projectile: Projectile,
    cameraY: number,
    canvasHeight: number,
    frame: number
) {
    if (!projectile.active) return;

    const screenY = projectile.y - cameraY + canvasHeight / 2;

    ctx.save();

    if (projectile.type === ProjectileType.Rocket) {
        // Rocket body
        const isMovingRight = projectile.velocityX > 0;

        // Rocket trail
        ctx.fillStyle = 'rgba(255, 200, 100, 0.6)';
        const trailX = isMovingRight ? projectile.x - 15 : projectile.x + projectile.width;
        ctx.beginPath();
        ctx.ellipse(
            trailX,
            screenY + projectile.height / 2,
            12 + Math.sin(frame * 0.5) * 3,
            5,
            0,
            0,
            Math.PI * 2
        );
        ctx.fill();

        // Rocket body - red with metallic look
        const gradient = ctx.createLinearGradient(
            projectile.x,
            screenY,
            projectile.x,
            screenY + projectile.height
        );
        gradient.addColorStop(0, '#FF4444');
        gradient.addColorStop(0.5, '#CC2222');
        gradient.addColorStop(1, '#AA0000');
        ctx.fillStyle = gradient;

        ctx.beginPath();
        if (isMovingRight) {
            ctx.moveTo(projectile.x, screenY + projectile.height / 2);
            ctx.lineTo(projectile.x + projectile.width - 5, screenY);
            ctx.lineTo(projectile.x + projectile.width, screenY + projectile.height / 2);
            ctx.lineTo(projectile.x + projectile.width - 5, screenY + projectile.height);
        } else {
            ctx.moveTo(projectile.x + projectile.width, screenY + projectile.height / 2);
            ctx.lineTo(projectile.x + 5, screenY);
            ctx.lineTo(projectile.x, screenY + projectile.height / 2);
            ctx.lineTo(projectile.x + 5, screenY + projectile.height);
        }
        ctx.closePath();
        ctx.fill();

        // Rocket fins
        ctx.fillStyle = '#880000';
        if (isMovingRight) {
            ctx.fillRect(projectile.x, screenY - 2, 4, projectile.height + 4);
        } else {
            ctx.fillRect(
                projectile.x + projectile.width - 4,
                screenY - 2,
                4,
                projectile.height + 4
            );
        }
    } else if (projectile.type === ProjectileType.Mine) {
        // Mine - pulsing sphere with spikes
        const pulse = 1 + Math.sin(frame * 0.3) * 0.1;
        const size = (projectile.width / 2) * pulse;

        // Mine body
        const gradient = ctx.createRadialGradient(
            projectile.x + projectile.width / 2,
            screenY + projectile.height / 2,
            0,
            projectile.x + projectile.width / 2,
            screenY + projectile.height / 2,
            size
        );
        gradient.addColorStop(0, '#444');
        gradient.addColorStop(0.7, '#222');
        gradient.addColorStop(1, '#000');
        ctx.fillStyle = gradient;

        ctx.beginPath();
        ctx.arc(
            projectile.x + projectile.width / 2,
            screenY + projectile.height / 2,
            size,
            0,
            Math.PI * 2
        );
        ctx.fill();

        // Spikes
        ctx.fillStyle = '#666';
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const spikeX = projectile.x + projectile.width / 2 + Math.cos(angle) * size;
            const spikeY = screenY + projectile.height / 2 + Math.sin(angle) * size;
            ctx.beginPath();
            ctx.arc(spikeX, spikeY, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Blinking red light
        if (frame % 30 < 15) {
            ctx.fillStyle = '#FF0000';
            ctx.beginPath();
            ctx.arc(
                projectile.x + projectile.width / 2,
                screenY + projectile.height / 2,
                4,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
    }

    ctx.restore();
}

/** Draw a pickup (health, ammo) */
function drawPickup(
    ctx: CanvasRenderingContext2D,
    pickup: Pickup,
    cameraY: number,
    canvasHeight: number,
    frame: number
) {
    if (!pickup.active) return;

    const screenY = pickup.y - cameraY + canvasHeight / 2;

    // Skip if off-screen
    if (screenY + pickup.size < 0 || screenY > canvasHeight) return;

    ctx.save();

    // Floating animation
    const floatOffset = Math.sin(frame * 0.1 + pickup.x) * 3;
    const drawY = screenY + floatOffset;

    // Glow effect
    const glowSize = pickup.size * 1.5;
    const glow = ctx.createRadialGradient(
        pickup.x + pickup.size / 2,
        drawY + pickup.size / 2,
        0,
        pickup.x + pickup.size / 2,
        drawY + pickup.size / 2,
        glowSize
    );

    if (pickup.type === PickupType.Health) {
        // Health pickup - use sprite or draw heart
        const sprite = loadSprite('/hpitem.png');

        glow.addColorStop(0, 'rgba(255, 100, 100, 0.4)');
        glow.addColorStop(1, 'rgba(255, 100, 100, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(pickup.x + pickup.size / 2, drawY + pickup.size / 2, glowSize, 0, Math.PI * 2);
        ctx.fill();

        if (sprite) {
            ctx.drawImage(sprite, pickup.x, drawY, pickup.size, pickup.size);
        } else {
            // Fallback heart emoji
            ctx.font = `${pickup.size}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('❤️', pickup.x + pickup.size / 2, drawY + pickup.size / 2);
        }
    } else if (pickup.type === PickupType.Rocket) {
        // Rocket ammo pickup
        glow.addColorStop(0, 'rgba(255, 150, 50, 0.4)');
        glow.addColorStop(1, 'rgba(255, 150, 50, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(pickup.x + pickup.size / 2, drawY + pickup.size / 2, glowSize, 0, Math.PI * 2);
        ctx.fill();

        // Draw rocket emoji
        ctx.font = `${pickup.size * 0.8}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🚀', pickup.x + pickup.size / 2, drawY + pickup.size / 2);
    } else if (pickup.type === PickupType.Mine) {
        // Mine ammo pickup
        glow.addColorStop(0, 'rgba(255, 50, 50, 0.4)');
        glow.addColorStop(1, 'rgba(255, 50, 50, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(pickup.x + pickup.size / 2, drawY + pickup.size / 2, glowSize, 0, Math.PI * 2);
        ctx.fill();

        // Draw mine/bomb emoji
        ctx.font = `${pickup.size * 0.8}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💣', pickup.x + pickup.size / 2, drawY + pickup.size / 2);
    }

    ctx.restore();
}

/** Draw submarine flashlight cone */
function drawFlashlight(
    ctx: CanvasRenderingContext2D,
    player: PlayerVehicle,
    cameraY: number,
    canvasHeight: number,
    depth: number
) {
    // Only draw flashlight for descending submarines (not dead/escaped/ascending)
    if (player.state !== PlayerState.Descending) return;

    const screenY = player.y - cameraY + canvasHeight / 2;
    const lightX = player.x + player.width / 2;
    const lightY = screenY + player.height;

    // Flashlight visibility increases with depth (more visible in darkness)
    const normalizedDepth = Math.min(depth / MAX_DEPTH, 1);
    const flashlightOpacity = 0.05 + normalizedDepth * 0.15; // 5% at surface, 20% at max depth

    ctx.save();

    // Create cone gradient
    const gradient = ctx.createRadialGradient(
        lightX,
        lightY,
        0,
        lightX,
        lightY + FLASHLIGHT_CONFIG.range,
        FLASHLIGHT_CONFIG.coneWidth / 2
    );
    gradient.addColorStop(0, `rgba(255, 255, 200, ${flashlightOpacity * 2})`);
    gradient.addColorStop(0.3, `rgba(255, 255, 180, ${flashlightOpacity})`);
    gradient.addColorStop(1, 'rgba(255, 255, 150, 0)');

    // Draw cone shape
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(lightX, lightY);
    ctx.lineTo(lightX - FLASHLIGHT_CONFIG.coneWidth / 2, lightY + FLASHLIGHT_CONFIG.range);
    ctx.lineTo(lightX + FLASHLIGHT_CONFIG.coneWidth / 2, lightY + FLASHLIGHT_CONFIG.range);
    ctx.closePath();
    ctx.fill();

    // Draw light source (small bright spot)
    const spotGradient = ctx.createRadialGradient(lightX, lightY + 5, 0, lightX, lightY + 5, 15);
    spotGradient.addColorStop(0, 'rgba(255, 255, 220, 0.8)');
    spotGradient.addColorStop(1, 'rgba(255, 255, 200, 0)');
    ctx.fillStyle = spotGradient;
    ctx.beginPath();
    ctx.arc(lightX, lightY + 5, 15, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

/** Draw a player (submarine or capsule) based on their state */
function drawPlayer(
    ctx: CanvasRenderingContext2D,
    player: PlayerVehicle,
    playerId: PlayerId,
    cameraY: number,
    canvasHeight: number
) {
    const isPlayer1 = playerId === 'player1';
    const color = isPlayer1 ? COLORS.sub1 : COLORS.sub2;

    // Draw implosion animation for dead players
    if (player.state === PlayerState.Dead && player.implosionFrame > 0) {
        drawSubmarine(ctx, player, color, cameraY, canvasHeight, isPlayer1);
        return;
    }

    if (player.state === PlayerState.Dead || player.state === PlayerState.Escaped) {
        return;
    }

    if (player.state === PlayerState.Descending) {
        drawSubmarine(ctx, player, color, cameraY, canvasHeight, isPlayer1);
    } else if (player.state === PlayerState.Ascending) {
        const capsuleColor = isPlayer1 ? COLORS.capsule1 : COLORS.capsule2;
        drawCapsule(ctx, player, capsuleColor, cameraY, canvasHeight);
    }

    // Invincibility flash effect
    if (player.invincibilityFrames > 0 && player.invincibilityFrames % 10 < 5) {
        const screenY = player.y - cameraY + canvasHeight / 2;
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.ellipse(
            player.x + player.width / 2,
            screenY + player.height / 2,
            player.width / 2 + 5,
            player.height / 2 + 5,
            0,
            0,
            Math.PI * 2
        );
        ctx.fill();
        ctx.restore();
    }
}

export function GameCanvas({ gameState, width, height }: GameCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Preload sprites on mount
    useEffect(() => {
        preloadSprites();
    }, []);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { players, obstacles } = gameState;
        const cameraMode = getCameraMode(players);

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        if (cameraMode.mode === 'single') {
            // Single view mode
            let focusDepth = 0;
            let activeCount = 0;

            for (const player of Object.values(players)) {
                if (
                    player.state === PlayerState.Descending ||
                    player.state === PlayerState.Ascending
                ) {
                    focusDepth += player.y;
                    activeCount++;
                }
            }

            if (activeCount > 0) {
                focusDepth /= activeCount;
            } else {
                focusDepth = Math.max(
                    players.player1.maxDepthReached,
                    players.player2.maxDepthReached
                );
            }

            // Draw background with water color
            ctx.fillStyle = getWaterColor(focusDepth);
            ctx.fillRect(0, 0, width, height);

            // Draw cargo ship at surface
            drawCargoShip(ctx, width / 2, focusDepth, height);

            // Draw Titanic
            drawTitanic(ctx, focusDepth, width, height);

            // Draw flashlight cones (before obstacles so they appear behind)
            drawFlashlight(ctx, players.player1, focusDepth, height, focusDepth);
            drawFlashlight(ctx, players.player2, focusDepth, height, focusDepth);

            // Draw obstacles with visibility based on depth and flashlights
            for (const obstacle of obstacles) {
                const visibility = getObstacleVisibility(obstacle, players);
                drawObstacle(ctx, obstacle, focusDepth, height, visibility);
            }

            // Draw projectiles
            for (const projectile of gameState.projectiles) {
                drawProjectile(ctx, projectile, focusDepth, height, gameState.frame);
            }

            // Draw pickups
            for (const pickup of gameState.pickups) {
                drawPickup(ctx, pickup, focusDepth, height, gameState.frame);
            }

            // Draw players
            drawPlayer(ctx, players.player1, 'player1', focusDepth, height);
            drawPlayer(ctx, players.player2, 'player2', focusDepth, height);

            // Apply darkness overlay based on depth
            const darknessOpacity = getDarknessOverlay(focusDepth);
            if (darknessOpacity > 0) {
                ctx.fillStyle = `rgba(0, 0, 0, ${darknessOpacity})`;
                ctx.fillRect(0, 0, width, height);
            }
        } else {
            // Split screen mode
            const halfHeight = height / 2;

            // Top half: ascending player
            if (cameraMode.ascendingPlayer) {
                const ascPlayer = players[cameraMode.ascendingPlayer];

                ctx.save();
                ctx.beginPath();
                ctx.rect(0, 0, width, halfHeight);
                ctx.clip();

                const cameraY = ascPlayer.y;

                ctx.fillStyle = getWaterColor(ascPlayer.y);
                ctx.fillRect(0, 0, width, halfHeight);

                ctx.translate(0, -halfHeight / 2);

                drawTitanic(ctx, cameraY, width, height);

                // Flashlights (ascending capsule has no flashlight, but we draw for consistency)
                drawFlashlight(ctx, players.player1, cameraY, height, cameraY);
                drawFlashlight(ctx, players.player2, cameraY, height, cameraY);

                for (const obstacle of obstacles) {
                    const visibility = getObstacleVisibility(obstacle, players);
                    drawObstacle(ctx, obstacle, cameraY, height, visibility);
                }
                for (const projectile of gameState.projectiles) {
                    drawProjectile(ctx, projectile, cameraY, height, gameState.frame);
                }
                for (const pickup of gameState.pickups) {
                    drawPickup(ctx, pickup, cameraY, height, gameState.frame);
                }
                drawPlayer(ctx, ascPlayer, cameraMode.ascendingPlayer, cameraY, height);

                // Darkness overlay for ascending view
                const darknessOpacity = getDarknessOverlay(ascPlayer.y);
                if (darknessOpacity > 0) {
                    ctx.translate(0, halfHeight / 2);
                    ctx.fillStyle = `rgba(0, 0, 0, ${darknessOpacity})`;
                    ctx.fillRect(0, 0, width, halfHeight);
                }

                ctx.restore();

                ctx.fillStyle = COLORS.hud;
                ctx.font = 'bold 16px monospace';
                ctx.fillText('↑ ASCENDING', 10, 25);
            }

            // Divider line
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, halfHeight);
            ctx.lineTo(width, halfHeight);
            ctx.stroke();

            // Bottom half: descending player
            if (cameraMode.descendingPlayer) {
                const descPlayer = players[cameraMode.descendingPlayer];

                ctx.save();
                ctx.beginPath();
                ctx.rect(0, halfHeight, width, halfHeight);
                ctx.clip();

                const cameraY = descPlayer.y;

                ctx.translate(0, halfHeight);

                ctx.fillStyle = getWaterColor(descPlayer.y);
                ctx.fillRect(0, 0, width, halfHeight);

                ctx.translate(0, -halfHeight / 2);

                drawTitanic(ctx, cameraY, width, height);

                // Flashlights
                drawFlashlight(ctx, players.player1, cameraY, height, cameraY);
                drawFlashlight(ctx, players.player2, cameraY, height, cameraY);

                for (const obstacle of obstacles) {
                    const visibility = getObstacleVisibility(obstacle, players);
                    drawObstacle(ctx, obstacle, cameraY, height, visibility);
                }
                for (const projectile of gameState.projectiles) {
                    drawProjectile(ctx, projectile, cameraY, height, gameState.frame);
                }
                for (const pickup of gameState.pickups) {
                    drawPickup(ctx, pickup, cameraY, height, gameState.frame);
                }
                drawPlayer(ctx, descPlayer, cameraMode.descendingPlayer, cameraY, height);

                // Darkness overlay for descending view
                const darknessOpacity = getDarknessOverlay(descPlayer.y);
                if (darknessOpacity > 0) {
                    ctx.translate(0, halfHeight / 2);
                    ctx.fillStyle = `rgba(0, 0, 0, ${darknessOpacity})`;
                    ctx.fillRect(0, 0, width, halfHeight);
                }

                ctx.restore();

                ctx.fillStyle = COLORS.hud;
                ctx.font = 'bold 16px monospace';
                ctx.fillText('↓ DESCENDING', 10, halfHeight + 25);
            }
        }

        // Draw depth markers on the side
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = 'bold 14px monospace';
        const markerDepth = Math.floor(gameState.currentMaxDepth / 100) * 100;
        for (let d = markerDepth - 200; d <= markerDepth + 400; d += 100) {
            if (d >= 0) {
                const screenY = d - gameState.currentMaxDepth + height / 2;
                if (screenY > 0 && screenY < height) {
                    ctx.fillText(`${d}m`, width - 60, screenY);
                }
            }
        }
    }, [gameState, width, height]);

    // Redraw when game state changes
    useEffect(() => {
        draw();
    }, [draw]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            style={{
                display: 'block',
                width: '100%',
                height: '100%',
            }}
        />
    );
}
