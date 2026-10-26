// Interior runtime: the only system that knows a pilot can be indoors.
//
// It owns two jobs and nothing else:
//   1. the doorway — walking through the opened porch swaps the flat exterior
//      collision world for the interior one, walking back swaps it again;
//   2. the floor — the feet follow the plates and stair ramps of the interior,
//      and the camera rig reads that height.
//
// There is no interaction layer: a doorway is walked through, a shut flat door is
// a collider like any wall. The exterior world stays exactly what it was — a porch
// that was never opened keeps its solid AABB and can never be entered.
import { INTERIOR } from '../world/interiors/interiorProfile.js';
import { createInteriorCollision, type InteriorCollision } from '../world/interiors/interiorCollision.js';
import { worldToLocal, type InteriorInstance } from '../world/interiors/index.js';
import type { InteriorState } from '../state/interiorState.js';
import type { PilotState } from '../state/pilotState.js';
import type { ViewState } from '../state/viewState.js';
import type { CollisionQuery, CollisionWorld } from './collision.js';

// The stoop of the porch as khrushchyovkaFacade builds it: two treads in front of
// the door. They are the only exterior ground that is not y = 0.
const PORCH = {
    WALK_HALF: 0.90,
    HIGH: 0.10,
    HIGH_FROM: 5.20,
    HIGH_TO: 5.84,
    LOW: 0.05,
    LOW_TO: 6.98
};

// Crossing the panel. The doorway is free in both worlds between these lines, so
// the swap never lands the pilot inside a collider.
const PORTAL = {
    HALF: 0.86,
    ENTER_Z: 5.24,
    EXIT_Z: 5.30,
    INSIDE_Z: 4.20
};

export type InteriorNavigation = CollisionQuery;

export interface InteriorRuntime {
    readonly navigation: InteriorNavigation;
    update(dt: number): void;
    isInside(): boolean;
}

interface RuntimeInput {
    instances: InteriorInstance[];
    state: InteriorState;
    pilotState: PilotState;
    viewState: ViewState;
    exterior: CollisionWorld;
}

function porchHeight(x: number, porchX: number, z: number): number {
    if (Math.abs(x - porchX) > PORCH.WALK_HALF) return 0;
    if (z >= PORCH.HIGH_FROM && z <= PORCH.HIGH_TO) return PORCH.HIGH;
    if (z > PORCH.HIGH_TO && z <= PORCH.LOW_TO) return PORCH.LOW;
    return 0;
}

export function createInteriorRuntime({ instances, state, pilotState, viewState, exterior }: RuntimeInput): InteriorRuntime {
    let active: InteriorInstance | null = null;
    let collision: InteriorCollision | null = null;

    function setFeet(target: number, dt: number): void {
        if (dt <= 0) {
            pilotState.y = target;
            return;
        }
        const step = (target - pilotState.y) * Math.min(1, dt * INTERIOR.HEIGHT_RATE);
        pilotState.y = Math.abs(target - pilotState.y) < 0.002 ? target : pilotState.y + step;
    }

    function exteriorGround(x: number, z: number): number {
        let best = 0;
        instances.forEach((instance) => {
            const point = worldToLocal(instance, x, z);
            best = Math.max(best, porchHeight(point.x, instance.descriptor.porchX, point.z));
        });
        return best;
    }

    function activate(instance: InteriorInstance): void {
        active = instance;
        state.activeId = instance.id;
        // Every leaf in the district is shut for good: the interior is walked on
        // what is open, and a locked door is never asked to move.
        collision = createInteriorCollision(instance.plan, () => false);
    }

    function deactivate(): void {
        active = null;
        collision = null;
        state.activeId = null;
    }

    function update(dt: number): void {
        // Leaving the pilot's eyes (boarding the walker, a mode transition) always
        // drops the interior: the mech can never be walked inside.
        if (viewState.mode !== 'FP') {
            if (active) deactivate();
            if (pilotState.y !== 0) pilotState.y = 0;
            return;
        }

        if (!active) {
            for (let index = 0; index < instances.length; index += 1) {
                const instance = instances[index];
                const point = worldToLocal(instance, pilotState.x, pilotState.z);
                if (point.z <= PORTAL.ENTER_Z && point.z > PORTAL.INSIDE_Z && Math.abs(point.x - instance.descriptor.porchX) <= PORTAL.HALF) {
                    activate(instance);
                    break;
                }
            }
        } else {
            const point = worldToLocal(active, pilotState.x, pilotState.z);
            if (point.z > PORTAL.EXIT_Z) deactivate();
        }

        if (active && collision) {
            const point = worldToLocal(active, pilotState.x, pilotState.z);
            const ground = collision.groundAt(point.x, point.z, pilotState.y);
            if (ground !== null) setFeet(ground, dt);
        } else {
            setFeet(exteriorGround(pilotState.x, pilotState.z), dt);
        }
    }

    return {
        navigation: {
            isFree(x: number, z: number, radius: number): boolean {
                if (!active || !collision) return exterior.isFree(x, z, radius);
                const point = worldToLocal(active, x, z);
                if (!collision.isFree(point.x, point.z, radius, pilotState.y)) return false;
                // No floor under the destination: the landing edge and the stair
                // void are walls made of air.
                return collision.groundAt(point.x, point.z, pilotState.y) !== null;
            }
        },
        update,
        isInside: () => active !== null
    };
}
