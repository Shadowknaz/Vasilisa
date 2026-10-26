// Colliders and walk surfaces of one interior.
//
// The exterior world of the diorama is a flat set of XZ boxes: the pilot never
// changes height out there. An interior cannot work that way — the same column of
// air holds a landing at 1.1, a flight at 2.3 and the next landing at 4.1 — so the
// boxes of this world carry their vertical span and the body is tested against it.
// Walking is answered separately by `groundAt()`: the highest floor plate (or
// stair ramp) under the feet that is no higher than one step away.
import { INTERIOR } from './interiorProfile.js';
import type { InteriorBox, InteriorRect } from './interiorProfile.js';
import type { StairPlan } from './stairwell.js';

export interface InteriorCollision {
    // Circle vs the vertical span of every solid the body can touch.
    isFree(x: number, z: number, radius: number, feetY: number): boolean;
    // Height of the floor under the feet, or null when there is nothing to stand on.
    groundAt(x: number, z: number, feetY: number): number | null;
    readonly boxes: number;
}

function inside(rect: InteriorRect, x: number, z: number): boolean {
    return x >= rect.minX && x <= rect.maxX && z >= rect.minZ && z <= rect.maxZ;
}

function rampHeight(ramp: StairPlan['ramps'][number], z: number): number {
    const span = ramp.z1 - ramp.z0;
    if (Math.abs(span) < 1e-6) return ramp.y0;
    const t = Math.min(1, Math.max(0, (z - ramp.z0) / span));
    return ramp.y0 + (ramp.y1 - ramp.y0) * t;
}

export function createInteriorCollision(plan: StairPlan, isDoorOpen: (id: string) => boolean): InteriorCollision {
    const solids: InteriorBox[] = plan.solids.filter((solid) => solid.collide).map((solid) => solid.box);
    const doors = plan.doors.map((door) => ({ id: door.id, box: door.collider }));

    function bodyFree(x: number, z: number, radius: number, feetY: number): boolean {
        const low = feetY + INTERIOR.BODY.LOW;
        const high = feetY + INTERIOR.BODY.HIGH;
        const radiusSquared = radius * radius;

        for (let index = 0; index < solids.length; index += 1) {
            const box = solids[index];
            if (box.maxY <= low || box.minY >= high) continue;
            const closestX = Math.min(Math.max(x, box.minX), box.maxX);
            const closestZ = Math.min(Math.max(z, box.minZ), box.maxZ);
            const dx = x - closestX;
            const dz = z - closestZ;
            if (dx * dx + dz * dz < radiusSquared) return false;
        }

        for (let index = 0; index < doors.length; index += 1) {
            const door = doors[index];
            if (isDoorOpen(door.id)) continue;
            const box = door.box;
            if (box.maxY <= low || box.minY >= high) continue;
            const closestX = Math.min(Math.max(x, box.minX), box.maxX);
            const closestZ = Math.min(Math.max(z, box.minZ), box.maxZ);
            const dx = x - closestX;
            const dz = z - closestZ;
            if (dx * dx + dz * dz < radiusSquared) return false;
        }

        return true;
    }

    function groundAt(x: number, z: number, feetY: number): number | null {
        // A millimetre of tolerance: the porch threshold is a 0.66 m step against
        // a 0.70 m step-up, and a strict comparison would stop the climb on the
        // float rounding of the smoothed feet height.
        const limit = feetY + INTERIOR.STEP_UP + 1e-3;
        let best: number | null = null;

        for (let index = 0; index < plan.walkPlates.length; index += 1) {
            const plate = plan.walkPlates[index];
            if (plate.y > limit) continue;
            if (!inside(plate.rect, x, z)) continue;
            if (best === null || plate.y > best) best = plate.y;
        }

        for (let index = 0; index < plan.ramps.length; index += 1) {
            const ramp = plan.ramps[index];
            if (!inside(ramp.rect, x, z)) continue;
            const y = rampHeight(ramp, z);
            if (y > limit) continue;
            if (best === null || y > best) best = y;
        }

        return best;
    }

    return {
        isFree: bodyFree,
        groundAt,
        boxes: solids.length + doors.length
    };
}
