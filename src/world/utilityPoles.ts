// Concrete utility poles along the eastern service strip with sagging catenary
// wires. Neighbour pairs are explicit in the plan (no ring stretched across the
// courtyard), and the wire anchors sit high enough to clear the Mech with the
// headroom the validator asserts (TZ §7, WIRE_CLEARANCE).
import { COLORS } from '../config/colors.js';
import { darkFrameMat } from '../core/materials.js';
import { POLE_PROFILE, type ObjectTransform } from './layout/footprints.js';
import { objectsOfType, registerColliders } from './placement.js';
import type { Layout } from './layout/createLayout.js';
import type { CollisionWorld } from '../systems/collision.js';
import * as THREE from 'three';

const POLE = {
    SEGMENTS: 6,
    CENTER_RATIO: 0.5,
    ARM_Y_OFFSET: -0.4
};

const WIRE = {
    COLOR: 0x050607,
    SEGMENTS: 12
};

function createCatenaryPoints(from: ObjectTransform, to: ObjectTransform, anchorY: number, sag: number): THREE.Vector3[] {
    const points: THREE.Vector3[] = [];
    for (let step = 0; step <= WIRE.SEGMENTS; step++) {
        const t = step / WIRE.SEGMENTS;
        const x = from.x + (to.x - from.x) * t;
        const z = from.z + (to.z - from.z) * t;
        points.push(new THREE.Vector3(x, anchorY - Math.sin(t * Math.PI) * sag, z));
    }
    return points;
}

export function buildUtilityPoles(group: THREE.Group, collision: CollisionWorld, layout: Layout): void {
    const wireMat = new THREE.LineBasicMaterial({ color: WIRE.COLOR });
    const armMat = new THREE.MeshBasicMaterial({ color: COLORS.METAL_DARK });
    const poles = objectsOfType(layout, 'utility-pole');

    poles.forEach((object) => {
        const { x, z } = object.transform;
        const { height, anchorY } = object.parameters;

        const poleMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(
                POLE_PROFILE.RADIUS_TOP,
                POLE_PROFILE.RADIUS_BOTTOM,
                height,
                POLE.SEGMENTS
            ),
            darkFrameMat
        );
        poleMesh.position.set(x, height * POLE.CENTER_RATIO, z);
        group.add(poleMesh);

        // Lamp arm at the top, pointing into the courtyard
        const arm = new THREE.Mesh(
            new THREE.BoxGeometry(POLE_PROFILE.ARM.WIDTH, POLE_PROFILE.ARM.HEIGHT, POLE_PROFILE.ARM.DEPTH),
            armMat
        );
        arm.position.set(x + POLE_PROFILE.ARM.X_OFFSET, anchorY + POLE.ARM_Y_OFFSET, z);
        group.add(arm);
    });

    poles.forEach((object) => registerColliders(collision, object));

    // Wires follow the explicit spans of the plan: pole index pairs, never a loop.
    const spans: Array<[number, number]> = poles[0] ? poles[0].parameters.spans : [];
    spans.forEach(([fromIndex, toIndex]) => {
        const from = poles[fromIndex];
        const to = poles[toIndex];
        if (!from || !to) return;
        const geometry = new THREE.BufferGeometry().setFromPoints(
            createCatenaryPoints(from.transform, to.transform, from.parameters.anchorY, from.parameters.sag)
        );
        group.add(new THREE.Line(geometry, wireMat));
    });
}
