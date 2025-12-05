/**
 * Main game view that orchestrates the game loop and rendering.
 * Supports fullscreen mode with audio.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { GameState } from '../engine/types';
import { PlayerState } from '../engine/types';
import { createInitialState, updateGameState } from '../engine/gameState';
import { FIXED_DT, MAX_DEPTH, setCanvasDimensions } from '../engine/config';
import { GameCanvas } from './GameCanvas';
import { HUD } from './HUD';
import { useKeyboardInput } from './useKeyboardInput';
import { soundEngine } from '../audio/SoundEngine';
import { vibrateGamepad, VibrationPatterns } from '../audio/vibrationEngine';

interface GameViewProps {
    seed: number;
    onGameOver: (state: GameState) => void;
}

export function GameView({ seed, onGameOver }: GameViewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({
        width: window.innerWidth,
        height: window.innerHeight,
    });
    const [audioInitialized, setAudioInitialized] = useState(false);

    // Ready state - both players must press DOWN to start
    const [player1Ready, setPlayer1Ready] = useState(false);
    const [player2Ready, setPlayer2Ready] = useState(false);
    const gameStarted = player1Ready && player2Ready;

    // Update canvas dimensions in config
    useEffect(() => {
        setCanvasDimensions(dimensions.width, dimensions.height);
    }, [dimensions]);

    const [gameState, setGameState] = useState<GameState>(() =>
        createInitialState({
            seed,
            maxDepth: MAX_DEPTH,
            canvasWidth: dimensions.width,
            canvasHeight: dimensions.height,
        })
    );

    const { sampleInputs, sampleMovementOnly } = useKeyboardInput();
    const gameStateRef = useRef(gameState);
    const prevStateRef = useRef(gameState);
    const animationFrameRef = useRef<number | undefined>(undefined);
    const lastTimeRef = useRef<number>(0);
    const accumulatedTimeRef = useRef<number>(0);

    // Request fullscreen mode on mount
    useEffect(() => {
        const requestFullscreen = async () => {
            try {
                if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
                    await document.documentElement.requestFullscreen();
                }
            } catch (e) {
                console.log('Fullscreen request failed:', e);
            }
        };

        // Small delay to ensure the component is mounted
        const timer = setTimeout(requestFullscreen, 100);

        return () => {
            clearTimeout(timer);
            // Exit fullscreen when leaving game
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
            }
        };
    }, []);

    // Handle window resize
    useEffect(() => {
        const handleResize = () => {
            setDimensions({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Initialize audio on first interaction
    const initAudio = useCallback(async () => {
        if (!audioInitialized) {
            await soundEngine.init();
            setAudioInitialized(true);
        }
    }, [audioInitialized]);

    // Request fullscreen
    const requestFullscreen = useCallback(async () => {
        try {
            await initAudio();
            if (containerRef.current && !document.fullscreenElement) {
                await containerRef.current.requestFullscreen();
            }
        } catch (e) {
            console.warn('Fullscreen request failed:', e);
        }
    }, [initAudio]);

    // Keep ref in sync with state
    useEffect(() => {
        gameStateRef.current = gameState;
    }, [gameState]);

    // Handle audio events based on game state changes
    useEffect(() => {
        if (!audioInitialized) return;

        const prev = prevStateRef.current;
        const curr = gameState;

        // Update depth for ambient audio
        soundEngine.updateDepth(curr.currentMaxDepth);

        // Check for collisions (HP decreased)
        for (const playerId of ['player1', 'player2'] as const) {
            const prevPlayer = prev.players[playerId];
            const currPlayer = curr.players[playerId];
            const gamepadIndex = playerId === 'player1' ? 0 : 1;

            // Collision sound (metal scrape + impact) + vibration
            if (currPlayer.hp < prevPlayer.hp && currPlayer.state !== PlayerState.Dead) {
                const isHeavy = currPlayer.hp === 1;
                soundEngine.playImpact(isHeavy ? 'heavy' : 'light');
                soundEngine.playMetalScrape(isHeavy ? 'heavy' : 'light');
                vibrateGamepad(
                    gamepadIndex,
                    isHeavy ? VibrationPatterns.collisionHeavy : VibrationPatterns.collision
                );
            }

            // Ascent sound + vibration
            if (
                prevPlayer.state === PlayerState.Descending &&
                currPlayer.state === PlayerState.Ascending
            ) {
                soundEngine.playAscent();
                vibrateGamepad(gamepadIndex, VibrationPatterns.eject);
            }

            // Death sound + vibration
            if (prevPlayer.state !== PlayerState.Dead && currPlayer.state === PlayerState.Dead) {
                soundEngine.playDeath();
                vibrateGamepad(gamepadIndex, VibrationPatterns.death);
            }

            // Victory sound
            if (
                prevPlayer.state !== PlayerState.Escaped &&
                currPlayer.state === PlayerState.Escaped
            ) {
                soundEngine.playVictory();
            }

            // Rocket fire sound + vibration
            if (currPlayer.rocketsRemaining < prevPlayer.rocketsRemaining) {
                soundEngine.playRocketLaunch();
                vibrateGamepad(gamepadIndex, VibrationPatterns.rocketFire);
            }

            // Mine deploy sound + vibration
            if (currPlayer.minesRemaining < prevPlayer.minesRemaining) {
                soundEngine.playMineDeploy();
                vibrateGamepad(gamepadIndex, VibrationPatterns.mineDeploy);
            }
        }

        // Check for projectile hits (new projectiles destroyed = explosion)
        const prevProjectileCount = prev.projectiles.length;
        const currProjectileCount = curr.projectiles.length;

        // If projectiles were removed but not just by timing out, play explosion
        // This is a simplified check - we look for decrease in projectile count
        if (prevProjectileCount > currProjectileCount) {
            const removedCount = prevProjectileCount - currProjectileCount;
            for (let i = 0; i < Math.min(removedCount, 3); i++) {
                setTimeout(() => soundEngine.playExplosion('small'), i * 50);
            }
        }

        prevStateRef.current = curr;
    }, [gameState, audioInitialized]);

    // Track game over state with delay
    const [gameOverDelay, setGameOverDelay] = useState(false);
    const gameOverTimeoutRef = useRef<number | undefined>(undefined);

    // Check for game over with delay
    useEffect(() => {
        if (gameState.gameOver && !gameOverDelay) {
            // Start showing "GAME OVER" overlay
            setGameOverDelay(true);
            
            // Delay before transitioning to results screen
            gameOverTimeoutRef.current = window.setTimeout(() => {
                onGameOver(gameState);
            }, 3000); // 3 second delay
        }
        
        return () => {
            if (gameOverTimeoutRef.current) {
                clearTimeout(gameOverTimeoutRef.current);
            }
        };
    }, [gameState.gameOver, gameState, onGameOver, gameOverDelay]);

    // Reset ambient sounds on unmount (keeps context for next game)
    useEffect(() => {
        return () => {
            soundEngine.reset();
        };
    }, []);

    // Main game loop
    const gameLoop = useCallback(
        (timestamp: number) => {
            if (lastTimeRef.current === 0) {
                lastTimeRef.current = timestamp;
            }

            const deltaTime = (timestamp - lastTimeRef.current) / 1000;
            lastTimeRef.current = timestamp;

            accumulatedTimeRef.current += deltaTime;

            if (accumulatedTimeRef.current > 0.2) {
                accumulatedTimeRef.current = 0.2;
            }

            // Check ready state before game starts
            if (!gameStarted) {
                // Use movement-only sampling to not consume action button states
                const movement = sampleMovementOnly();

                // Check if players pressed DOWN to ready up
                if (movement.player1Down && !player1Ready) {
                    setPlayer1Ready(true);
                    soundEngine.playImpact('light');
                }
                if (movement.player2Down && !player2Ready) {
                    setPlayer2Ready(true);
                    soundEngine.playImpact('light');
                }

                // Keep animation frame going but don't update game
                animationFrameRef.current = requestAnimationFrame(gameLoop);
                return;
            }

            let newState = gameStateRef.current;
            while (accumulatedTimeRef.current >= FIXED_DT) {
                const frameInputs = sampleInputs(newState.frame);
                newState = updateGameState(newState, frameInputs, FIXED_DT);
                accumulatedTimeRef.current -= FIXED_DT;
            }

            if (newState !== gameStateRef.current) {
                setGameState(newState);
            }

            if (!newState.gameOver) {
                animationFrameRef.current = requestAnimationFrame(gameLoop);
            }
        },
        [sampleInputs, sampleMovementOnly, gameStarted, player1Ready, player2Ready]
    );

    // Start/stop game loop
    useEffect(() => {
        animationFrameRef.current = requestAnimationFrame(gameLoop);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [gameLoop]);

    return (
        <div
            ref={containerRef}
            onClick={initAudio}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                backgroundColor: '#0A1628',
                overflow: 'hidden',
                cursor: 'none',
            }}
        >
            <GameCanvas gameState={gameState} width={dimensions.width} height={dimensions.height} />
            <HUD gameState={gameState} />

            {/* Game Over overlay - shows for 3 seconds before results */}
            {gameOverDelay && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                        zIndex: 100,
                        animation: 'fadeIn 0.5s ease-out',
                    }}
                >
                    <h1
                        style={{
                            fontSize: '72px',
                            color: '#FF4444',
                            marginBottom: '20px',
                            textShadow: '0 0 30px rgba(255, 68, 68, 0.8), 0 0 60px rgba(255, 68, 68, 0.5)',
                            animation: 'pulse 1s ease-in-out infinite',
                            fontFamily: 'monospace',
                            letterSpacing: '10px',
                        }}
                    >
                        GAME OVER
                    </h1>
                    
                    {gameState.winner && (
                        <p
                            style={{
                                fontSize: '32px',
                                color: gameState.winner === 'player1' ? '#FFA500' : '#00FF7F',
                                textShadow: '0 0 15px currentColor',
                                fontFamily: 'monospace',
                            }}
                        >
                            🏆 {gameState.winner === 'player1' ? 'PLAYER 1' : 'PLAYER 2'} WINS! 🏆
                        </p>
                    )}
                    
                    <p
                        style={{
                            fontSize: '16px',
                            color: '#888',
                            marginTop: '40px',
                            fontFamily: 'monospace',
                        }}
                    >
                        Loading results...
                    </p>
                </div>
            )}
            <style>
                {`
                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    @keyframes pulse {
                        0%, 100% { transform: scale(1); }
                        50% { transform: scale(1.05); }
                    }
                `}
            </style>

            {/* Ready overlay - shows until both players press DOWN */}
            {!gameStarted && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        zIndex: 100,
                    }}
                >
                    <h1
                        style={{
                            fontSize: '48px',
                            color: '#87CEEB',
                            marginBottom: '20px',
                            textShadow: '0 0 20px rgba(135, 206, 235, 0.5)',
                        }}
                    >
                        🌊 GET READY! 🌊
                    </h1>

                    <p
                        style={{
                            fontSize: '20px',
                            color: '#AAA',
                            marginBottom: '40px',
                        }}
                    >
                        Both players must press DOWN to dive!
                    </p>

                    <div style={{ display: 'flex', gap: '60px' }}>
                        {/* Player 1 Ready Status */}
                        <div
                            style={{
                                padding: '30px 50px',
                                backgroundColor: player1Ready
                                    ? 'rgba(255, 165, 0, 0.3)'
                                    : 'rgba(0, 0, 0, 0.5)',
                                border: `3px solid ${player1Ready ? '#FFA500' : '#444'}`,
                                borderRadius: '16px',
                                textAlign: 'center',
                                transition: 'all 0.3s',
                            }}
                        >
                            <div
                                style={{ fontSize: '24px', color: '#FFA500', marginBottom: '10px' }}
                            >
                                PLAYER 1
                            </div>
                            <div style={{ fontSize: '40px' }}>{player1Ready ? '✅' : '⬇️'}</div>
                            <div style={{ fontSize: '14px', color: '#888', marginTop: '10px' }}>
                                {player1Ready ? 'READY!' : 'Press S or ↓'}
                            </div>
                        </div>

                        {/* Player 2 Ready Status */}
                        <div
                            style={{
                                padding: '30px 50px',
                                backgroundColor: player2Ready
                                    ? 'rgba(0, 255, 127, 0.3)'
                                    : 'rgba(0, 0, 0, 0.5)',
                                border: `3px solid ${player2Ready ? '#00FF7F' : '#444'}`,
                                borderRadius: '16px',
                                textAlign: 'center',
                                transition: 'all 0.3s',
                            }}
                        >
                            <div
                                style={{ fontSize: '24px', color: '#00FF7F', marginBottom: '10px' }}
                            >
                                PLAYER 2
                            </div>
                            <div style={{ fontSize: '40px' }}>{player2Ready ? '✅' : '⬇️'}</div>
                            <div style={{ fontSize: '14px', color: '#888', marginTop: '10px' }}>
                                {player2Ready ? 'READY!' : 'Press S or ↓'}
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: '40px', color: '#666', fontSize: '14px' }}>
                        🎮 Gamepad: Press Down on D-pad or Left Stick
                    </div>
                </div>
            )}

            {/* Controls hint */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 20,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    color: 'rgba(255, 255, 255, 0.5)',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    textAlign: 'center',
                    pointerEvents: 'none',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    padding: '10px 20px',
                    borderRadius: '8px',
                }}
            >
                <div style={{ marginBottom: '4px' }}>
                    <strong>P1:</strong> WASD move | Q eject | E rocket | R mine
                </div>
                <div>
                    <strong>P2:</strong> Arrows move | / eject | . rocket | , mine
                </div>
            </div>

            {/* Fullscreen button */}
            {!document.fullscreenElement && (
                <button
                    onClick={requestFullscreen}
                    style={{
                        position: 'absolute',
                        top: 20,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        padding: '10px 20px',
                        backgroundColor: 'rgba(74, 144, 217, 0.8)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontFamily: 'monospace',
                        fontSize: '14px',
                        pointerEvents: 'auto',
                    }}
                >
                    🔊 Click to Enable Sound & Fullscreen
                </button>
            )}

            {/* Audio indicator */}
            {audioInitialized && (
                <div
                    style={{
                        position: 'absolute',
                        top: 20,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        color: 'rgba(255, 255, 255, 0.3)',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                    }}
                >
                    🔊 Audio Active
                </div>
            )}
        </div>
    );
}
