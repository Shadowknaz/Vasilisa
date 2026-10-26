// Keyboard, mouse, touch and pointer-lock input wiring.
import { ISO_VIEW, MOUSE_LOOK } from '../config/controls.js';
import { RENDER_FLAGS, setRenderFlag } from '../core/renderFlags.js';
import { toggleMechExitEnter } from './boarding.js';
import type { InputState, MovementKeys } from '../state/inputState.js';
import type { ViewState } from '../state/viewState.js';
import type { PilotState } from '../state/pilotState.js';
import type { MechState } from '../state/mechState.js';
import type { CollisionWorld } from './collision.js';

interface InputContext {
    displayCanvas: HTMLCanvasElement;
    inputState: InputState;
    viewState: ViewState;
    pilotState: PilotState;
    mechState: MechState;
    collision: CollisionWorld;
    // Action key hook of the interior layer: returns true when the key was spent
    // on a porch door or a flat door, so the mech never tries to board through a
    // wall while the pilot is standing in a stairwell.
    onAction?: () => boolean;
}

const MOVEMENT_KEY_MAP: Record<string, keyof MovementKeys> = {
    KeyW: 'w',
    ArrowUp: 'w',
    KeyS: 's',
    ArrowDown: 's',
    KeyA: 'a',
    ArrowLeft: 'a',
    KeyD: 'd',
    ArrowRight: 'd',
    ShiftLeft: 'shift',
    ShiftRight: 'shift'
};

const ACTION_KEYS = new Set(['KeyE', 'KeyF', 'Enter', 'Space']);
const ISO_LEFT_KEY = 'KeyQ';
const ISO_RIGHT_KEY = 'KeyR';
const OVERVIEW_KEY = 'KeyO';
// Test switch: drops the whole night model (shader, grade, fog, practicals) so the
// frame can be compared against the plain geometry. It is not a gameplay key.
const NIGHT_TOGGLE_KEY = 'KeyN';

export function initInput({ displayCanvas, inputState, viewState, pilotState, mechState, collision, onAction }: InputContext): () => void {
    const boardingContext = { viewState, mechState, pilotState, collision, displayCanvas };

    const onKeyDown = (event: KeyboardEvent): void => {
        const code = event.code;

        const movementKey = MOVEMENT_KEY_MAP[code];
        if (movementKey) inputState.keys[movementKey] = true;

        if (ACTION_KEYS.has(code)) {
            event.preventDefault();
            // The interior gets the key first: a porch door, a flat door or the
            // way out. Only an unclaimed key reaches the boarding rules.
            if (!onAction || !onAction()) toggleMechExitEnter(boardingContext);
        }

        if (code === ISO_LEFT_KEY && viewState.mode === 'MECH') {
            viewState.isoTargetYaw -= ISO_VIEW.ROTATION_STEP;
        }
        if (code === ISO_RIGHT_KEY && viewState.mode === 'MECH') {
            viewState.isoTargetYaw += ISO_VIEW.ROTATION_STEP;
        }
        if (code === OVERVIEW_KEY && viewState.mode === 'MECH') {
            viewState.overview = !viewState.overview;
        }
        // Works in every mode: the night switch is a render diagnostic, not a
        // gameplay action, and it has to be flippable while standing in the cockpit.
        if (code === NIGHT_TOGGLE_KEY) {
            event.preventDefault();
            setRenderFlag('night', !RENDER_FLAGS.night);
        }
    };

    const onKeyUp = (event: KeyboardEvent): void => {
        const movementKey = MOVEMENT_KEY_MAP[event.code];
        if (movementKey) inputState.keys[movementKey] = false;
    };

    // Mouse look in First-Person (supports both PointerLock and direct mouse move / drag)
    const onMouseDown = (event: MouseEvent): void => {
        inputState.isDragging = true;
        inputState.lastMouseX = event.clientX;
        inputState.lastMouseY = event.clientY;

        if (viewState.mode === 'FP' && document.pointerLockElement !== displayCanvas) {
            try {
                displayCanvas.requestPointerLock();
            } catch (error) {
                // Pointer lock is optional (e.g. blocked by the browser).
            }
        }
    };

    const resetInputs = (): void => {
        inputState.keys.w = false;
        inputState.keys.a = false;
        inputState.keys.s = false;
        inputState.keys.d = false;
        inputState.keys.shift = false;
        inputState.isDragging = false;
        inputState.lastMouseX = 0;
        inputState.lastMouseY = 0;
    };

    const onVisibilityChange = (): void => {
        if (document.hidden) resetInputs();
    };

    const onMouseUp = (): void => {
        inputState.isDragging = false;
        inputState.lastMouseX = 0;
        inputState.lastMouseY = 0;
    };

    const onPointerLockChange = (): void => {
        inputState.pointerLocked = document.pointerLockElement === displayCanvas;
    };

    const onMouseMove = (event: MouseEvent): void => {
        let dx = 0;
        let dy = 0;

        if (inputState.pointerLocked) {
            dx = event.movementX || 0;
            dy = event.movementY || 0;
        } else if (inputState.isDragging || viewState.mode === 'FP') {
            if (inputState.lastMouseX !== 0 || inputState.lastMouseY !== 0) {
                dx = event.clientX - inputState.lastMouseX;
                dy = event.clientY - inputState.lastMouseY;
            }
            inputState.lastMouseX = event.clientX;
            inputState.lastMouseY = event.clientY;
        }

        if (viewState.mode === 'FP') {
            const sensitivity = inputState.pointerLocked
                ? MOUSE_LOOK.POINTER_LOCK_SENSITIVITY
                : MOUSE_LOOK.DRAG_SENSITIVITY;
            if (inputState.pointerLocked || inputState.isDragging) {
                pilotState.yaw -= dx * sensitivity;
                pilotState.pitch = Math.max(
                    -MOUSE_LOOK.PITCH_LIMIT,
                    Math.min(MOUSE_LOOK.PITCH_LIMIT, pilotState.pitch - dy * sensitivity)
                );
            }
        } else if (viewState.mode === 'MECH' && inputState.isDragging) {
            viewState.isoTargetYaw -= dx * MOUSE_LOOK.ISO_DRAG_SENSITIVITY;
        }
    };

    // Isometric-only camera zoom. The first-person camera deliberately ignores
    // the wheel so scrolling never changes its FOV or movement feel.
    const onWheel = (event: WheelEvent): void => {
        if (viewState.mode !== 'MECH') return;

        event.preventDefault();
        const pixels = event.deltaMode === WheelEvent.DOM_DELTA_LINE
            ? event.deltaY * 16
            : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
                ? event.deltaY * displayCanvas.clientHeight
                : event.deltaY;
        viewState.isoTargetZoom = Math.max(
            ISO_VIEW.ZOOM_MIN,
            Math.min(ISO_VIEW.ZOOM_MAX, viewState.isoTargetZoom + pixels * ISO_VIEW.ZOOM_SENSITIVITY)
        );
    };

    // Touch support for mobile/tablet inspection
    const onTouchStart = (event: TouchEvent): void => {
        if (event.touches.length === 2) {
            toggleMechExitEnter(boardingContext);
        } else if (event.touches.length === 1) {
            inputState.isDragging = true;
            inputState.lastMouseX = event.touches[0].clientX;
            inputState.lastMouseY = event.touches[0].clientY;
        }
    };

    const onTouchMove = (event: TouchEvent): void => {
        if (event.touches.length === 1 && inputState.isDragging) {
            const dx = event.touches[0].clientX - inputState.lastMouseX;
            const dy = event.touches[0].clientY - inputState.lastMouseY;
            inputState.lastMouseX = event.touches[0].clientX;
            inputState.lastMouseY = event.touches[0].clientY;

            if (viewState.mode === 'FP') {
                pilotState.yaw -= dx * MOUSE_LOOK.TOUCH_SENSITIVITY;
                pilotState.pitch = Math.max(
                    -MOUSE_LOOK.TOUCH_PITCH_LIMIT,
                    Math.min(MOUSE_LOOK.TOUCH_PITCH_LIMIT, pilotState.pitch - dy * MOUSE_LOOK.TOUCH_SENSITIVITY)
                );
            } else {
                viewState.isoTargetYaw -= dx * MOUSE_LOOK.TOUCH_ISO_SENSITIVITY;
            }
        }
    };

    const onTouchEnd = (): void => {
        inputState.isDragging = false;
        inputState.lastMouseX = 0;
        inputState.lastMouseY = 0;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    displayCanvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('blur', resetInputs);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('mouseup', onMouseUp);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    window.addEventListener('mousemove', onMouseMove);
    displayCanvas.addEventListener('wheel', onWheel, { passive: false });
    displayCanvas.addEventListener('touchstart', onTouchStart, { passive: true });
    displayCanvas.addEventListener('touchmove', onTouchMove, { passive: true });
    displayCanvas.addEventListener('touchend', onTouchEnd);
    displayCanvas.addEventListener('touchcancel', onTouchEnd);

    return () => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        displayCanvas.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('blur', resetInputs);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        window.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('pointerlockchange', onPointerLockChange);
        window.removeEventListener('mousemove', onMouseMove);
        displayCanvas.removeEventListener('wheel', onWheel);
        displayCanvas.removeEventListener('touchstart', onTouchStart);
        displayCanvas.removeEventListener('touchmove', onTouchMove);
        displayCanvas.removeEventListener('touchend', onTouchEnd);
        displayCanvas.removeEventListener('touchcancel', onTouchEnd);
    };
}
