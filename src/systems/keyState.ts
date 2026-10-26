// Helpers for reading the held-key state.
import type { MovementKeys } from '../state/inputState.js';

export function isMovementPressed(keys: MovementKeys): boolean {
    return keys.w || keys.a || keys.s || keys.d;
}

// Screen-relative input vector (forward, right) normalized to a unit length.
export function readMovementVector(keys: MovementKeys): { forward: number; right: number } {
    const forward = (keys.w ? 1 : 0) - (keys.s ? 1 : 0);
    const right = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
    if (forward === 0 && right === 0) {
        return { forward: 0, right: 0 };
    }
    const length = Math.hypot(forward, right);
    return { forward: forward / length, right: right / length };
}
