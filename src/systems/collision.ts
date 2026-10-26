// Compound axis-aligned collision world in the XZ plane. Every solid part of every
// placed object arrives here as a world AABB taken from the validated layout, so
// the walkable area is exactly the complement of the plan plus the thin margin at
// the slab edge (TZ §10). No physics engine: the players are circles and the test
// is a closed-form circle/AABB overlap.
import { DIORAMA } from '../config/world.js';

interface CollisionBox {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    tag: string | null;
}

export function createCollisionWorld({ half = DIORAMA.SIZE / 2, walkMargin = DIORAMA.WALK_MARGIN }: { half?: number; walkMargin?: number } = {}) {
    const boxes: CollisionBox[] = [];
    // Radius edge of the walkable area: |x| + r must stay inside half - walkMargin.
    const limit = half - walkMargin;

    function addBox(minX: number, maxX: number, minZ: number, maxZ: number, tag: string | null = null): void {
        boxes.push({
            minX: Math.min(minX, maxX),
            maxX: Math.max(minX, maxX),
            minZ: Math.min(minZ, maxZ),
            maxZ: Math.max(minZ, maxZ),
            tag
        });
    }

    // Circle vs AABB against the closest point of the box. A box-vs-box test would
    // make the Mech collide with corners it visibly clears; the spec is radius
    // based, so the box is only ever a silhouette, never an inflated hull.
    function isFree(x: number, z: number, radius: number): boolean {
        if (Math.abs(x) + radius > limit || Math.abs(z) + radius > limit) return false;

        for (let index = 0; index < boxes.length; index++) {
            const box = boxes[index];
            const closestX = Math.min(Math.max(x, box.minX), box.maxX);
            const closestZ = Math.min(Math.max(z, box.minZ), box.maxZ);
            const dx = x - closestX;
            const dz = z - closestZ;
            if (dx * dx + dz * dz < radius * radius) return false;
        }
        return true;
    }

    function snapshot(): CollisionBox[] {
        return boxes.slice();
    }

    return { addBox, isFree, snapshot, limit, count: () => boxes.length };
}

export type CollisionWorld = ReturnType<typeof createCollisionWorld>;

// What a walker needs from a collision world: the pilot asks this, and the answer
// comes either from the courtyard or from the interior he is standing in.
export interface CollisionQuery {
    isFree(x: number, z: number, radius: number): boolean;
}
