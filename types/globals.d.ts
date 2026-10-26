/// <reference types="vite/client" />

// Global augmentation for the retained debug handles. These replace the previous
// implicit window globals so `main.ts` and `debugLayout.ts` compile under strict.
// They are debug-only: assigned in the boot path and read by the acceptance run.
import type { BuiltLayout, Layout } from '../src/world/layout/createLayout.js';
import type { Validation } from '../src/world/layout/validateLayout.js';
import type { Stage } from '../src/core/stage.js';
import type { createCollisionWorld } from '../src/systems/collision.js';
import type { SurfaceField } from '../src/world/surfaceField.js';
import type { WeatherSystem } from '../src/systems/weather.js';
import type { InteriorInstance } from '../src/world/interiors/index.js';
import type { InteriorState } from '../src/state/interiorState.js';
import type { PilotState } from '../src/state/pilotState.js';
import type { ViewState } from '../src/state/viewState.js';
import type { PlayerRig } from '../src/player/player.js';

declare global {
    interface Window {
        __DIORAMA_LAYOUT__?: Layout;
        __DIORAMA_VALIDATION__?: Validation;
        __DIORAMA_CLEANUP__?: () => void;
        __DIORAMA_DEBUG__?: {
            built: BuiltLayout;
            stage: Stage;
            collision: ReturnType<typeof createCollisionWorld>;
            surface: SurfaceField;
            weather: WeatherSystem;
            // Interiors of the district: plan, colliders and open door state, so a
            // headless run can probe the stairwell without a screenshot.
            interiors?: InteriorInstance[];
            interiorState?: InteriorState;
            // Pose of the pilot and the camera mode, so an acceptance run can put
            // him at a porch instead of walking 45 m across the yard.
            pilotState?: PilotState;
            viewState?: ViewState;
            // The first-person heroine rig: joints, visibility and the two roots,
            // so a headless run can verify the body without reading pixels.
            player?: PlayerRig;
        };
    }
}

export {};
