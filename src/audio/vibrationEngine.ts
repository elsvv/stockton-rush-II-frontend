/**
 * Gamepad Vibration Engine using Gamepad Haptic Actuator API.
 * Provides rumble feedback for game events.
 * Works with DualSense/DualShock controllers in Chrome/Edge.
 */

export interface VibrationPattern {
    duration: number;
    weakMagnitude: number; // 0-1, high-frequency motor
    strongMagnitude: number; // 0-1, low-frequency motor
}

/** Predefined vibration patterns */
export const VibrationPatterns = {
    collision: { duration: 100, weakMagnitude: 0.3, strongMagnitude: 0.6 },
    collisionHeavy: { duration: 200, weakMagnitude: 0.5, strongMagnitude: 0.9 },
    rocketFire: { duration: 50, weakMagnitude: 0.8, strongMagnitude: 0.2 },
    mineDeploy: { duration: 80, weakMagnitude: 0.4, strongMagnitude: 0.4 },
    damage: { duration: 200, weakMagnitude: 0.5, strongMagnitude: 0.8 },
    death: { duration: 500, weakMagnitude: 1.0, strongMagnitude: 1.0 },
    eject: { duration: 150, weakMagnitude: 0.6, strongMagnitude: 0.3 },
    pickup: { duration: 50, weakMagnitude: 0.3, strongMagnitude: 0.1 },
} as const;

/**
 * Vibrate a specific gamepad.
 * @param gamepadIndex - Index of the gamepad (0 for P1, 1 for P2)
 * @param pattern - Vibration pattern to play
 */
export function vibrateGamepad(
    gamepadIndex: number,
    pattern: VibrationPattern
): void {
    try {
        const gamepads = navigator.getGamepads();
        const gamepad = gamepads[gamepadIndex];

        if (!gamepad) return;

        // Check for vibrationActuator (Chrome/Edge)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const actuator = (gamepad as any).vibrationActuator;

        if (actuator && typeof actuator.playEffect === 'function') {
            actuator.playEffect('dual-rumble', {
                startDelay: 0,
                duration: pattern.duration,
                weakMagnitude: pattern.weakMagnitude,
                strongMagnitude: pattern.strongMagnitude,
            });
        }
    } catch {
        // Vibration not supported, silently ignore
    }
}

/**
 * Vibrate gamepad for Player 1.
 */
export function vibrateP1(pattern: VibrationPattern): void {
    vibrateGamepad(0, pattern);
}

/**
 * Vibrate gamepad for Player 2.
 */
export function vibrateP2(pattern: VibrationPattern): void {
    vibrateGamepad(1, pattern);
}

/**
 * Vibrate both gamepads.
 */
export function vibrateBoth(pattern: VibrationPattern): void {
    vibrateP1(pattern);
    vibrateP2(pattern);
}

/**
 * Check if vibration is supported on any connected gamepad.
 */
export function isVibrationSupported(): boolean {
    try {
        const gamepads = navigator.getGamepads();
        for (const gamepad of gamepads) {
            if (gamepad) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if ((gamepad as any).vibrationActuator) {
                    return true;
                }
            }
        }
    } catch {
        // API not available
    }
    return false;
}
