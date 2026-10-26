// Boarding / disembarking rules between the pilot and the walker.
import { BOARDING } from '../config/controls.js';
import type { MechState } from '../state/mechState.js';
import type { PilotState } from '../state/pilotState.js';
import type { ViewState } from '../state/viewState.js';
import type { CollisionWorld } from './collision.js';

interface BoardingContext {
    viewState: ViewState;
    mechState: MechState;
    pilotState: PilotState;
    collision: CollisionWorld;
    displayCanvas: HTMLCanvasElement;
}

// The armored door sits on the hull's -X flank, so that side is tried first, then
// front, rear and the far flank. Directions are model-space unit vectors: a yaw
// rotation maps local (x, z) to world (x·cos + z·sin, −x·sin + z·cos).
const EXIT_CANDIDATES = [
    { x: -1, z: 0 },
    { x: 0, z: 1 },
    { x: 0, z: -1 },
    { x: 1, z: 0 }
];

function toWorld(localX: number, localZ: number, mechState: MechState): { x: number; z: number } {
    const cosYaw = Math.cos(mechState.yaw);
    const sinYaw = Math.sin(mechState.yaw);
    return {
        x: mechState.x + localX * cosYaw + localZ * sinYaw,
        z: mechState.z - localX * sinYaw + localZ * cosYaw
    };
}

export function isPilotNearMech(mechState: MechState, pilotState: PilotState): boolean {
    const distToCenter = Math.hypot(pilotState.x - mechState.x, pilotState.z - mechState.z);

    // Also check distance specifically to the flank boarding hatch
    const hatch = toWorld(BOARDING.HATCH_LOCAL.x, BOARDING.HATCH_LOCAL.z, mechState);
    const distToHatch = Math.hypot(pilotState.x - hatch.x, pilotState.z - hatch.z);

    return distToCenter <= BOARDING.RADIUS || distToHatch <= BOARDING.HATCH_REACH;
}

// First side that offers both a landing spot and one free step beyond it.
// Returns null when the walker is boxed in on all four sides.
function findExit(mechState: MechState, collision: CollisionWorld): { x: number; z: number; dirX: number; dirZ: number } | null {
    for (let index = 0; index < EXIT_CANDIDATES.length; index += 1) {
        const candidate = EXIT_CANDIDATES[index];
        const direction = toWorld(candidate.x, candidate.z, mechState);
        const dirX = direction.x - mechState.x;
        const dirZ = direction.z - mechState.z;
        const x = mechState.x + dirX * BOARDING.EXIT_DISTANCE;
        const z = mechState.z + dirZ * BOARDING.EXIT_DISTANCE;
        const awayX = x + dirX * BOARDING.STEP_AWAY_PROBE;
        const awayZ = z + dirZ * BOARDING.STEP_AWAY_PROBE;

        if (!collision.isFree(x, z, BOARDING.EXIT_CLEARANCE)) continue;
        if (!collision.isFree(awayX, awayZ, BOARDING.EXIT_CLEARANCE)) continue;

        return { x, z, dirX, dirZ };
    }

    return null;
}

export function toggleMechExitEnter({ viewState, mechState, pilotState, collision, displayCanvas }: BoardingContext): void {
    if (viewState.mode === 'MECH') {
        const exit = findExit(mechState, collision);
        // No free ground on any side: the pilot stays strapped in. Never teleport.
        if (!exit) return;

        pilotState.x = exit.x;
        pilotState.z = exit.z;
        // The pilot's forward is (-sin yaw, -cos yaw), so this yaw looks straight
        // back at the hatch they just stepped out of; the offset keeps a little of
        // the courtyard in frame.
        pilotState.yaw = Math.atan2(exit.dirX, exit.dirZ) + BOARDING.EXIT_YAW_OFFSET;
        pilotState.pitch = BOARDING.EXIT_PITCH;
        // The heroine has not taken a step yet: the visible body starts planted and
        // picks the stride up from input, not from a leftover cockpit pose.
        pilotState.gait = 0;

        viewState.overview = false;
        viewState.mode = 'TRANSITION_TO_FP';
        viewState.transitionProgress = 0;
    } else if (viewState.mode === 'FP') {
        // Only allow boarding if the Pilot has walked right up to the Mech!
        if (!isPilotNearMech(mechState, pilotState)) {
            return;
        }

        pilotState.gait = 0;
        viewState.mode = 'TRANSITION_TO_MECH';
        viewState.transitionProgress = 0;
        if (document.pointerLockElement === displayCanvas) {
            try {
                document.exitPointerLock();
            } catch (error) {
                // Pointer lock may already be released by the browser.
            }
        }
    }
}
