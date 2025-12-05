/**
 * React hook for handling keyboard input for both players.
 * Maps physical keys to player actions in a hot-seat multiplayer setup.
 */

import { useEffect, useRef, useCallback } from 'react';
import type { PlayerInputFrame, PlayerId, PlayerAction } from '../engine/types';

/** Key mappings for Player 1 */
const P1_KEYS = {
    left: 'KeyA',
    right: 'KeyD',
    action: 'KeyW',
};

/** Key mappings for Player 2 */
const P2_KEYS = {
    left: 'ArrowLeft',
    right: 'ArrowRight',
    action: 'ArrowUp',
};

/** Current state of pressed keys */
interface KeyState {
    player1: {
        left: boolean;
        right: boolean;
        action: boolean;
    };
    player2: {
        left: boolean;
        right: boolean;
        action: boolean;
    };
}

/** Track whether action was just pressed this frame (for single-fire) */
interface ActionPressed {
    player1: boolean;
    player2: boolean;
}

/**
 * Hook that tracks keyboard input for both players.
 * Returns a function to sample the current input state as PlayerInputFrames.
 */
export function useKeyboardInput() {
    const keyState = useRef<KeyState>({
        player1: { left: false, right: false, action: false },
        player2: { left: false, right: false, action: false },
    });

    // Track if action key was pressed since last sample (for single-fire behavior)
    const actionPressed = useRef<ActionPressed>({
        player1: false,
        player2: false,
    });

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Prevent default for game keys
            const code = e.code;

            // Player 1
            if (code === P1_KEYS.left) {
                e.preventDefault();
                keyState.current.player1.left = true;
            }
            if (code === P1_KEYS.right) {
                e.preventDefault();
                keyState.current.player1.right = true;
            }
            if (code === P1_KEYS.action) {
                e.preventDefault();
                keyState.current.player1.action = true;
                actionPressed.current.player1 = true;
            }

            // Player 2
            if (code === P2_KEYS.left) {
                e.preventDefault();
                keyState.current.player2.left = true;
            }
            if (code === P2_KEYS.right) {
                e.preventDefault();
                keyState.current.player2.right = true;
            }
            if (code === P2_KEYS.action) {
                e.preventDefault();
                keyState.current.player2.action = true;
                actionPressed.current.player2 = true;
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            const code = e.code;

            // Player 1
            if (code === P1_KEYS.left) keyState.current.player1.left = false;
            if (code === P1_KEYS.right) keyState.current.player1.right = false;
            if (code === P1_KEYS.action) keyState.current.player1.action = false;

            // Player 2
            if (code === P2_KEYS.left) keyState.current.player2.left = false;
            if (code === P2_KEYS.right) keyState.current.player2.right = false;
            if (code === P2_KEYS.action) keyState.current.player2.action = false;
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
        const p1Action: PlayerAction = actionPressed.current.player1 ? 'dumpBallast' : null;
        const p2Action: PlayerAction = actionPressed.current.player2 ? 'dumpBallast' : null;

        // Reset action pressed flags after sampling
        actionPressed.current.player1 = false;
        actionPressed.current.player2 = false;

        return {
            player1: {
                frame,
                left: keyState.current.player1.left,
                right: keyState.current.player1.right,
                action: p1Action,
            },
            player2: {
                frame,
                left: keyState.current.player2.left,
                right: keyState.current.player2.right,
                action: p2Action,
            },
        };
    }, []);

    return { sampleInputs };
}
