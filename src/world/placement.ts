// Bridge between the frozen layout and the scene builders. A builder never
// invents a placement or a collider size of its own: it looks its descriptor up
// by id and copies the world transforms that the validator already approved
// (TZ §9).
import { findObject, type ObjectDescriptor } from './layout/footprints.js';
import type { Layout } from './layout/createLayout.js';
import type { CollisionWorld } from '../systems/collision.js';

export function layoutObject(layout: Layout, id: string): ObjectDescriptor {
    const object = findObject(layout.objects, id);
    if (!object) throw new Error(`layout object not found: ${id}`);
    return object;
}

export function objectsOfType(layout: Layout, type: string): ObjectDescriptor[] {
    return layout.objects.filter((object) => object.type === type);
}

// Every solid part of the object becomes one compound collision box. Buildings
// therefore register body + porches (4 AABBs each), the yard fence registers its
// five runs, and so on — the same numbers the clearance checks were run against.
export function registerColliders(collision: CollisionWorld, object: ObjectDescriptor): void {
    object.worldFootprints.forEach((rect) => {
        collision.addBox(rect.minX, rect.maxX, rect.minZ, rect.maxZ, object.id);
    });
}
