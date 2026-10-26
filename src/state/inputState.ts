// Input state: held movement keys, pointer lock and drag tracking.
export interface MovementKeys {
    w: boolean;
    a: boolean;
    s: boolean;
    d: boolean;
    shift: boolean;
}

export interface InputState {
    keys: MovementKeys;
    pointerLocked: boolean;
    isDragging: boolean;
    lastMouseX: number;
    lastMouseY: number;
}

export function createInputState(): InputState {
    return {
        keys: {
            w: false,
            a: false,
            s: false,
            d: false,
            shift: false
        },
        pointerLocked: false,
        isDragging: false,
        lastMouseX: 0,
        lastMouseY: 0
    };
}
