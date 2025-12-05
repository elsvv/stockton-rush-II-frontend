/**
 * React hook for handling keyboard input for both players.
 * Maps physical keys to player actions in a hot-seat multiplayer setup.
 *
 * Controls:
 * Player 1: WASD movement, Q=eject, E=rocket, R=mine
 * Player 2: Arrow keys movement, /=eject, .=rocket, ,=mine
 */

import { useEffect, useRef, useCallback } from 'react';
import type { PlayerInputFrame, PlayerId, PlayerAction } from '../engine/types';

/** Key mappings for Player 1 (WASD + QER) */
const P1_KEYS = {
    up: 'KeyW',
    down: 'KeyS',
    left: 'KeyA',
    right: 'KeyD',
    eject: 'KeyQ',
    rocket: 'KeyE',
    mine: 'KeyR',
};

/** Key mappings for Player 2 (Arrows + /, ., ,) */
const P2_KEYS = {
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight',
    eject: 'Slash', // /
    rocket: 'Period', // .
    mine: 'Comma', // ,
};

/** Current state of pressed keys */
interface KeyState {
    player1: {
        up: boolean;
        down: boolean;
        left: boolean;
        right: boolean;
    };
    player2: {
        up: boolean;
        down: boolean;
        left: boolean;
        right: boolean;
    };
}

/** Track which action was just pressed this frame (for single-fire) */
interface ActionPressed {
    player1: PlayerAction;
    player2: PlayerAction;
}

/**
 * Hook that tracks keyboard input for both players.
 * Returns a function to sample the current input state as PlayerInputFrames.
 */
export function useKeyboardInput() {
    const keyState = useRef<KeyState>({
        player1: { up: false, down: false, left: false, right: false },
        player2: { up: false, down: false, left: false, right: false },
    });

    // Track which action key was pressed since last sample (for single-fire behavior)
    const actionPressed = useRef<ActionPressed>({
        player1: null,
        player2: null,
    });

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const code = e.code;

            // Player 1 movement
            if (code === P1_KEYS.up) {
                e.preventDefault();
                keyState.current.player1.up = true;
            }
            if (code === P1_KEYS.down) {
                e.preventDefault();
                keyState.current.player1.down = true;
            }
            if (code === P1_KEYS.left) {
                e.preventDefault();
                keyState.current.player1.left = true;
            }
            if (code === P1_KEYS.right) {
                e.preventDefault();
                keyState.current.player1.right = true;
            }

            // Player 1 actions (only set if not already set this frame)
            if (code === P1_KEYS.eject && !actionPressed.current.player1) {
                e.preventDefault();
                actionPressed.current.player1 = 'dumpBallast';
            }
            if (code === P1_KEYS.rocket && !actionPressed.current.player1) {
                e.preventDefault();
                actionPressed.current.player1 = 'fireRocket';
            }
            if (code === P1_KEYS.mine && !actionPressed.current.player1) {
                e.preventDefault();
                actionPressed.current.player1 = 'deployMine';
            }

            // Player 2 movement
            if (code === P2_KEYS.up) {
                e.preventDefault();
                keyState.current.player2.up = true;
            }
            if (code === P2_KEYS.down) {
                e.preventDefault();
                keyState.current.player2.down = true;
            }
            if (code === P2_KEYS.left) {
                e.preventDefault();
                keyState.current.player2.left = true;
            }
            if (code === P2_KEYS.right) {
                e.preventDefault();
                keyState.current.player2.right = true;
            }

            // Player 2 actions
            if (code === P2_KEYS.eject && !actionPressed.current.player2) {
                e.preventDefault();
                actionPressed.current.player2 = 'dumpBallast';
            }
            if (code === P2_KEYS.rocket && !actionPressed.current.player2) {
                e.preventDefault();
                actionPressed.current.player2 = 'fireRocket';
            }
            if (code === P2_KEYS.mine && !actionPressed.current.player2) {
                e.preventDefault();
                actionPressed.current.player2 = 'deployMine';
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            const code = e.code;

            // Player 1
            if (code === P1_KEYS.up) keyState.current.player1.up = false;
            if (code === P1_KEYS.down) keyState.current.player1.down = false;
            if (code === P1_KEYS.left) keyState.current.player1.left = false;
            if (code === P1_KEYS.right) keyState.current.player1.right = false;

            // Player 2
            if (code === P2_KEYS.up) keyState.current.player2.up = false;
            if (code === P2_KEYS.down) keyState.current.player2.down = false;
            if (code === P2_KEYS.left) keyState.current.player2.left = false;
            if (code === P2_KEYS.right) keyState.current.player2.right = false;
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    /**
     * Sample the current input state for both players.
     * This should be called once per game frame.
     * The action is consumed after sampling (single-fire).
     */
    const sampleInputs = useCallback((frame: number): Record<PlayerId, PlayerInputFrame> => {
        const p1Action = actionPressed.current.player1;
        const p2Action = actionPressed.current.player2;

        // Reset action pressed flags after sampling
        actionPressed.current.player1 = null;
        actionPressed.current.player2 = null;

        return {
            player1: {
                frame,
                up: keyState.current.player1.up,
                down: keyState.current.player1.down,
                left: keyState.current.player1.left,
                right: keyState.current.player1.right,
                action: p1Action,
            },
            player2: {
                frame,
                up: keyState.current.player2.up,
                down: keyState.current.player2.down,
                left: keyState.current.player2.left,
                right: keyState.current.player2.right,
                action: p2Action,
            },
        };
    }, []);

    return { sampleInputs };
}
