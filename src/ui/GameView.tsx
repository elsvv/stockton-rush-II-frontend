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

    const { sampleInputs } = useKeyboardInput();
    const gameStateRef = useRef(gameState);
    const prevStateRef = useRef(gameState);
    const animationFrameRef = useRef<number | undefined>(undefined);
    const lastTimeRef = useRef<number>(0);
    const accumulatedTimeRef = useRef<number>(0);

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

            // Collision sound
            if (currPlayer.hp < prevPlayer.hp && currPlayer.state !== PlayerState.Dead) {
                soundEngine.playImpact(currPlayer.hp === 1 ? 'heavy' : 'light');
            }

            // Ascent sound
            if (
                prevPlayer.state === PlayerState.Descending &&
                currPlayer.state === PlayerState.Ascending
            ) {
                soundEngine.playAscent();
            }

            // Death sound
            if (prevPlayer.state !== PlayerState.Dead && currPlayer.state === PlayerState.Dead) {
                soundEngine.playDeath();
            }

            // Victory sound
            if (
                prevPlayer.state !== PlayerState.Escaped &&
                currPlayer.state === PlayerState.Escaped
            ) {
                soundEngine.playVictory();
            }
        }

        prevStateRef.current = curr;
    }, [gameState, audioInitialized]);

    // Check for game over
    useEffect(() => {
        if (gameState.gameOver) {
            onGameOver(gameState);
        }
    }, [gameState.gameOver, gameState, onGameOver]);

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            soundEngine.stop();
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

            let newState = gameStateRef.current;
            while (accumulatedTimeRef.current >= FIXED_DT) {
                const inputs = sampleInputs(newState.frame);
                newState = updateGameState(newState, inputs, FIXED_DT);
                accumulatedTimeRef.current -= FIXED_DT;
            }

            if (newState !== gameStateRef.current) {
                setGameState(newState);
            }

            if (!newState.gameOver) {
                animationFrameRef.current = requestAnimationFrame(gameLoop);
            }
        },
        [sampleInputs]
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
                cursor: 'crosshair',
            }}
        >
            <GameCanvas gameState={gameState} width={dimensions.width} height={dimensions.height} />
            <HUD gameState={gameState} />

            {/* Controls hint */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 50,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    color: 'rgba(255, 255, 255, 0.4)',
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    textAlign: 'center',
                    pointerEvents: 'none',
                }}
            >
                <div>P1: A/D + W to escape | P2: ←/→ + ↑ to escape</div>
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
