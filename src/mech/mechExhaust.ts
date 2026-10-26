// Tall vertical Soviet tractor exhaust stack on the rear spine: cast base, pipe,
// perforated shroud with enamel clamping rings and the rain-flap cap the effects
// system clatters. Returns the flap pivot only — the smoke itself belongs to the
// shared dust system, never to the rig.
import type { MechMaterials } from './mechMaterials.js';
import { cyl } from './mechGeometry.js';
import * as THREE from 'three';

const EXHAUST = {
    ORIGIN: { X: -0.46, Y: 0.62, Z: -0.68 },
    BASE: { TOP_RADIUS: 0.12, BOTTOM_RADIUS: 0.13, HEIGHT: 0.6, SEGMENTS: 6, Y: 0.22 },
    PIPE: { TOP_RADIUS: 0.06, BOTTOM_RADIUS: 0.07, HEIGHT: 1.05, SEGMENTS: 6, Y: 0.92 },
    SHROUD: { RADIUS: 0.085, HEIGHT: 0.34, SEGMENTS: 6, Y: 0.68 },
    RING: { RADIUS: 0.095, HEIGHT: 0.04, SEGMENTS: 6, Y: [0.52, 0.84] },
    FLAP: { PIVOT_Y: 1.46, RADIUS: 0.08, HEIGHT: 0.025, SEGMENTS: 6, Y: 0.02, TILT: -0.25 }
} as const;

export function createExhaust(materials: MechMaterials): THREE.Group {
    const stack = new THREE.Group();
    stack.position.set(EXHAUST.ORIGIN.X, EXHAUST.ORIGIN.Y, EXHAUST.ORIGIN.Z);

    stack.add(cyl(EXHAUST.BASE.TOP_RADIUS, EXHAUST.BASE.BOTTOM_RADIUS, EXHAUST.BASE.HEIGHT, EXHAUST.BASE.SEGMENTS, materials.steel, 0, EXHAUST.BASE.Y, 0));
    stack.add(cyl(EXHAUST.PIPE.TOP_RADIUS, EXHAUST.PIPE.BOTTOM_RADIUS, EXHAUST.PIPE.HEIGHT, EXHAUST.PIPE.SEGMENTS, materials.castIron, 0, EXHAUST.PIPE.Y, 0));
    stack.add(cyl(EXHAUST.SHROUD.RADIUS, EXHAUST.SHROUD.RADIUS, EXHAUST.SHROUD.HEIGHT, EXHAUST.SHROUD.SEGMENTS, materials.patch, 0, EXHAUST.SHROUD.Y, 0));
    EXHAUST.RING.Y.forEach((y) => {
        stack.add(cyl(EXHAUST.RING.RADIUS, EXHAUST.RING.RADIUS, EXHAUST.RING.HEIGHT, EXHAUST.RING.SEGMENTS, materials.enamel, 0, y, 0));
    });

    const flapPivot = new THREE.Group();
    flapPivot.position.y = EXHAUST.FLAP.PIVOT_Y;
    flapPivot.add(cyl(EXHAUST.FLAP.RADIUS, EXHAUST.FLAP.RADIUS, EXHAUST.FLAP.HEIGHT, EXHAUST.FLAP.SEGMENTS, materials.piston, 0, EXHAUST.FLAP.Y, 0, 0, 0, EXHAUST.FLAP.TILT));
    stack.add(flapPivot);

    return flapPivot;
}
