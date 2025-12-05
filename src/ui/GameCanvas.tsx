/**
 * Canvas component for rendering the game state.
 * Handles drawing submarines, capsules, obstacles, and the ocean environment.
 * Supports fullscreen rendering.
 */

import { useRef, useEffect, useCallback } from 'react';
import type { GameState, PlayerVehicle, Obstacle, PlayerId, Passenger } from '../engine/types';
import { PlayerState, ObstacleType } from '../engine/types';
import { COLORS, MAX_DEPTH, TITANIC_DEPTH, PASSENGER_COUNT } from '../engine/config';

interface GameCanvasProps {
    gameState: GameState;
    width: number;
    height: number;
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

    // Ship hull (dark gray)
    ctx.fillStyle = '#2A2A2A';
    ctx.beginPath();
    ctx.moveTo(centerX - 120, surfaceY - 20);
    ctx.lineTo(centerX + 120, surfaceY - 20);
    ctx.lineTo(centerX + 100, surfaceY + 30);
    ctx.lineTo(centerX - 100, surfaceY + 30);
    ctx.closePath();
    ctx.fill();

    // Ship deck
    ctx.fillStyle = '#4A4A4A';
    ctx.fillRect(centerX - 110, surfaceY - 40, 220, 20);

    // Bridge
    ctx.fillStyle = '#3A3A3A';
    ctx.fillRect(centerX - 30, surfaceY - 70, 60, 30);

    // Windows on bridge
    ctx.fillStyle = '#88CCFF';
    ctx.fillRect(centerX - 20, surfaceY - 60, 10, 10);
    ctx.fillRect(centerX + 10, surfaceY - 60, 10, 10);

    // Crane
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(centerX + 60, surfaceY - 40);
    ctx.lineTo(centerX + 60, surfaceY - 90);
    ctx.lineTo(centerX + 100, surfaceY - 70);
    ctx.stroke();

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
    ctx.fillStyle = color;

    // Capsule body (rounded rectangle)
    ctx.beginPath();
    ctx.roundRect(player.x, screenY, player.width, player.height, 8);
    ctx.fill();

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
    canvasHeight: number
) {
    if (!obstacle.active) return;

    const screenY = obstacle.y - cameraY + canvasHeight / 2;

    // Skip if off-screen
    if (screenY + obstacle.height < 0 || screenY > canvasHeight) return;

    ctx.save();

    switch (obstacle.type) {
        case ObstacleType.Coral:
            ctx.fillStyle = COLORS.coral;
            // Draw coral as jagged shape
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
            ctx.strokeStyle = '#8BB8C8';
            ctx.lineWidth = 2;
            // Draw ice as angular polygon
            ctx.beginPath();
            ctx.moveTo(obstacle.x + obstacle.width * 0.1, screenY + obstacle.height);
            ctx.lineTo(obstacle.x, screenY + obstacle.height * 0.3);
            ctx.lineTo(obstacle.x + obstacle.width * 0.4, screenY);
            ctx.lineTo(obstacle.x + obstacle.width * 0.8, screenY + obstacle.height * 0.1);
            ctx.lineTo(obstacle.x + obstacle.width, screenY + obstacle.height * 0.5);
            ctx.lineTo(obstacle.x + obstacle.width * 0.9, screenY + obstacle.height);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            break;

        case ObstacleType.SeaTurtle:
            ctx.fillStyle = COLORS.turtle;
            // Draw turtle as oval body with flippers
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
            // Head
            ctx.beginPath();
            const headX = obstacle.velocityX >= 0 ? obstacle.x + obstacle.width : obstacle.x;
            ctx.arc(headX, screenY + obstacle.height / 2, obstacle.height / 4, 0, Math.PI * 2);
            ctx.fill();
            // Flippers
            ctx.fillStyle = '#1B6B1B';
            ctx.beginPath();
            ctx.ellipse(
                obstacle.x + obstacle.width * 0.2,
                screenY + obstacle.height * 0.8,
                8,
                4,
                -0.5,
                0,
                Math.PI * 2
            );
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(
                obstacle.x + obstacle.width * 0.8,
                screenY + obstacle.height * 0.8,
                8,
                4,
                0.5,
                0,
                Math.PI * 2
            );
            ctx.fill();
            break;
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

            // Draw obstacles
            for (const obstacle of obstacles) {
                drawObstacle(ctx, obstacle, focusDepth, height);
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
                for (const obstacle of obstacles) {
                    drawObstacle(ctx, obstacle, cameraY, height);
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
                for (const obstacle of obstacles) {
                    drawObstacle(ctx, obstacle, cameraY, height);
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
