/**
 * Game over screen showing results and allowing restart.
 * Fullscreen with animated background matching MainMenu style.
 */

import { useEffect, useRef } from 'react';
import type { GameState, PlayerId } from '../engine/types';
import { PlayerState, DeathCause } from '../engine/types';
import { getGameResults } from '../engine/gameState';
import { generateRandomSeed } from '../engine/rng';
import { soundEngine } from '../audio/SoundEngine';

interface GameOverScreenProps {
    gameState: GameState;
    onRestart: (seed: number) => void;
    onMainMenu: () => void;
}

function getOutcomeText(state: PlayerState, deathCause?: DeathCause): string {
    if (state === PlayerState.Escaped) {
        return '🎉 ESCAPED!';
    }
    if (state === PlayerState.Dead) {
        if (deathCause === DeathCause.Imploded) {
            return '💥 IMPLODED';
        }
        if (deathCause === DeathCause.CrashedAscent) {
            return '💀 CRASHED';
        }
        return '☠️ DIED';
    }
    return '???';
}

function getOutcomeColor(state: PlayerState): string {
    if (state === PlayerState.Escaped) return '#44FF44';
    if (state === PlayerState.Dead) return '#FF4444';
    return '#FFFFFF';
}

export function GameOverScreen({ gameState, onRestart, onMainMenu }: GameOverScreenProps) {
    const results = getGameResults(gameState);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>(0);

    // Play game over sound on mount
    useEffect(() => {
        soundEngine.init();
        // Play a dramatic sound
        setTimeout(() => {
            if (results.winner === 'draw') {
                soundEngine.playImpact('heavy');
            } else {
                soundEngine.playVictory();
            }
        }, 300);
    }, [results.winner]);

    // Gamepad X button to replay
    useEffect(() => {
        let prevButtonStates: boolean[] = [];

        const checkGamepads = () => {
            const gamepads = navigator.getGamepads();

            // Check for X button (button 2) press on any gamepad to replay
            for (const gp of gamepads) {
                if (!gp) continue;

                const xPressed = gp.buttons[2]?.pressed || false;
                const wasPressed = prevButtonStates[gp.index] || false;

                // Replay on button press (not hold)
                if (xPressed && !wasPressed) {
                    onRestart(generateRandomSeed());
                    return;
                }

                prevButtonStates[gp.index] = xPressed;
            }
        };

        const interval = setInterval(checkGamepads, 100);

        return () => clearInterval(interval);
    }, [onRestart]);

    // Animated background (darker, more somber)
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let frame = 0;
        const particles: Array<{
            x: number;
            y: number;
            size: number;
            speed: number;
            opacity: number;
        }> = [];

        // Create particles (debris floating up)
        for (let i = 0; i < 20; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: 1 + Math.random() * 3,
                speed: 0.2 + Math.random() * 0.4,
                opacity: 0.1 + Math.random() * 0.2,
            });
        }

        const animate = () => {
            frame++;

            // Dark gradient background
            const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, '#051018');
            gradient.addColorStop(0.5, '#0A1628');
            gradient.addColorStop(1, '#050810');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw floating particles
            for (const particle of particles) {
                ctx.fillStyle = `rgba(100, 150, 180, ${particle.opacity})`;
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                ctx.fill();

                particle.y -= particle.speed;
                particle.x += Math.sin(frame * 0.01 + particle.y * 0.02) * 0.2;

                if (particle.y < -10) {
                    particle.y = canvas.height + 10;
                    particle.x = Math.random() * canvas.width;
                }
            }

            animationRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => cancelAnimationFrame(animationRef.current);
    }, []);

    // Resize canvas
    useEffect(() => {
        const handleResize = () => {
            if (canvasRef.current) {
                canvasRef.current.width = window.innerWidth;
                canvasRef.current.height = window.innerHeight;
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const getWinnerText = (): { text: string; color: string; emoji: string } => {
        if (results.winner === 'player1') {
            return { text: 'PLAYER 1 WINS!', color: '#FFA500', emoji: '🏆' };
        }
        if (results.winner === 'player2') {
            return { text: 'PLAYER 2 WINS!', color: '#00FF7F', emoji: '🏆' };
        }
        return { text: "IT'S A DRAW!", color: '#888888', emoji: '🤝' };
    };

    const winner = getWinnerText();

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                overflow: 'hidden',
            }}
        >
            {/* Animated background canvas */}
            <canvas
                ref={canvasRef}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: 0,
                }}
            />

            {/* Content */}
            <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                <h1
                    style={{
                        fontSize: '56px',
                        marginBottom: '10px',
                        color: '#87CEEB',
                        textShadow: '0 0 30px rgba(135, 206, 235, 0.3)',
                    }}
                >
                    🌊 GAME OVER 🌊
                </h1>

                <h2
                    style={{
                        fontSize: '42px',
                        marginBottom: '40px',
                        color: winner.color,
                        textShadow: `0 0 30px ${winner.color}60`,
                    }}
                >
                    {winner.emoji} {winner.text} {winner.emoji}
                </h2>

                <div
                    style={{
                        display: 'flex',
                        gap: '40px',
                        marginBottom: '40px',
                        justifyContent: 'center',
                    }}
                >
                    {/* Player 1 Results */}
                    <PlayerResultCard
                        playerId="player1"
                        result={results.player1}
                        isWinner={results.winner === 'player1'}
                    />

                    {/* Player 2 Results */}
                    <PlayerResultCard
                        playerId="player2"
                        result={results.player2}
                        isWinner={results.winner === 'player2'}
                    />
                </div>

                <div
                    style={{
                        display: 'flex',
                        gap: '15px',
                        justifyContent: 'center',
                        flexWrap: 'wrap',
                    }}
                >
                    <button
                        onClick={() => onRestart(gameState.seed)}
                        style={{
                            padding: '16px 32px',
                            fontSize: '18px',
                            fontWeight: 'bold',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: '#4A90D9',
                            color: '#FFFFFF',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = '#5AA0E9';
                            e.currentTarget.style.transform = 'scale(1.02)';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = '#4A90D9';
                            e.currentTarget.style.transform = 'scale(1)';
                        }}
                    >
                        🔄 REPLAY (Same Seed)
                    </button>

                    <button
                        onClick={() => onRestart(generateRandomSeed())}
                        style={{
                            padding: '16px 32px',
                            fontSize: '18px',
                            fontWeight: 'bold',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: '#2E8B57',
                            color: '#FFFFFF',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = '#3E9B67';
                            e.currentTarget.style.transform = 'scale(1.02)';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = '#2E8B57';
                            e.currentTarget.style.transform = 'scale(1)';
                        }}
                    >
                        🎲 NEW GAME
                    </button>

                    <button
                        onClick={onMainMenu}
                        style={{
                            padding: '16px 32px',
                            fontSize: '18px',
                            fontWeight: 'bold',
                            borderRadius: '8px',
                            border: '2px solid #4A90D9',
                            backgroundColor: 'transparent',
                            color: '#4A90D9',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(74, 144, 217, 0.2)';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                    >
                        🏠 MAIN MENU
                    </button>
                </div>

                <div
                    style={{
                        marginTop: '30px',
                        color: '#556',
                        fontSize: '14px',
                    }}
                >
                    Seed: {gameState.seed}
                </div>
            </div>
        </div>
    );
}

function PlayerResultCard({
    playerId,
    result,
    isWinner,
}: {
    playerId: PlayerId;
    result: {
        state: PlayerState;
        maxDepth: number;
        deathCause?: DeathCause;
    };
    isWinner: boolean;
}) {
    const isPlayer1 = playerId === 'player1';
    const playerColor = isPlayer1 ? '#FFA500' : '#00FF7F';

    return (
        <div
            style={{
                padding: '25px 35px',
                backgroundColor: isWinner ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.3)',
                borderRadius: '12px',
                border: isWinner ? `2px solid ${playerColor}` : '2px solid #2A4A6A',
                minWidth: '200px',
                textAlign: 'center',
            }}
        >
            <h3
                style={{
                    margin: '0 0 15px 0',
                    fontSize: '24px',
                    color: playerColor,
                }}
            >
                {isPlayer1 ? 'PLAYER 1' : 'PLAYER 2'}
                {isWinner && ' 👑'}
            </h3>

            <div
                style={{
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: getOutcomeColor(result.state),
                    marginBottom: '15px',
                }}
            >
                {getOutcomeText(result.state, result.deathCause)}
            </div>

            <div
                style={{
                    fontSize: '16px',
                    color: '#AAA',
                }}
            >
                Max Depth:{' '}
                <span style={{ color: '#87CEEB', fontWeight: 'bold' }}>
                    {Math.floor(result.maxDepth)}m
                </span>
            </div>
        </div>
    );
}
