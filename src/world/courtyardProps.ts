// Rusted barrel clusters: two in the transformer yard, one north of the kiosk.
// Placement, tilt and collider all come from the layout descriptor (TZ §9.7).
import { COLORS } from '../config/colors.js';
import { BARREL_PROFILE, type ObjectDescriptor } from './layout/footprints.js';
import { objectsOfType, registerColliders } from './placement.js';
import type { Layout } from './layout/createLayout.js';
import type { CollisionWorld } from '../systems/collision.js';
import * as THREE from 'three';

function createBarrel(group: THREE.Group, material: THREE.Material, object: ObjectDescriptor): void {
    const { x, y, z } = object.transform;
    const tilted = object.parameters.tilted;

    const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(
            BARREL_PROFILE.RADIUS,
            BARREL_PROFILE.RADIUS,
            BARREL_PROFILE.HEIGHT,
            BARREL_PROFILE.SEGMENTS
        ),
        material
    );

    if (tilted) {
        barrel.rotation.z = Math.PI / 2;
        barrel.rotation.y = BARREL_PROFILE.TILT_ROT_Y;
        barrel.position.set(x, y + BARREL_PROFILE.TILTED_Y, z);
    } else {
        barrel.position.set(x, y + BARREL_PROFILE.STANDING_Y, z);
    }
    group.add(barrel);
}

export function buildCourtyardProps(group: THREE.Group, collision: CollisionWorld, layout: Layout): void {
    const material = new THREE.MeshBasicMaterial({ color: COLORS.BARREL });
    const barrels = objectsOfType(layout, 'barrel');

    barrels.forEach((object) => createBarrel(group, material, object));
    barrels.forEach((object) => registerColliders(collision, object));
}
