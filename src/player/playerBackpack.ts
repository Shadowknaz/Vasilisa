// Canvas survival pack of the heroine: storm flap, leather closure straps, the
// rolled sleeping mat on top, a rear pouch, two side pockets, a spare knitted
// mitten and the small reflector tag. It hangs behind the torso, so the
// first-person camera only ever catches its shoulder straps (built with the
// coat); the pack is still part of the model for the same reason the head is.
import type { PlayerMaterials } from './playerMaterials.js';
import { createPlayerPartCollector } from './playerParts.js';
import * as THREE from 'three';

const PACK = {
    // The reference mounts the pack on the back of the torso pivot.
    X: 0,
    Y: 0.24,
    Z: -0.25,
    BODY: { WIDTH: 0.42, HEIGHT: 0.5, DEPTH: 0.24, Y: 0.02, Z: -0.03 },
    SHOULDER: { WIDTH: 0.38, HEIGHT: 0.14, DEPTH: 0.21, Y: 0.25, Z: -0.02 },
    FLAP: { WIDTH: 0.44, HEIGHT: 0.13, DEPTH: 0.26, Y: 0.24, Z: -0.03, TILT: 0.08 },
    FLAP_FRONT: { WIDTH: 0.43, HEIGHT: 0.19, DEPTH: 0.04, Y: 0.14, Z: -0.155, TILT: -0.08 },
    CLOSURE: { WIDTH: 0.045, HEIGHT: 0.34, DEPTH: 0.03, X: 0.115, Y: 0.09, Z: -0.16 },
    CLOSURE_BUCKLE: { WIDTH: 0.062, HEIGHT: 0.052, DEPTH: 0.038, X: 0.115, Y: 0.03, Z: -0.165 },
    BEDROLL: { RADIUS: 0.085, LENGTH: 0.46, SEGMENTS: 8, Y: 0.36, Z: -0.03, RING_X: 0.13, RING_LENGTH: 0.04 },
    REAR_POUCH: { WIDTH: 0.32, HEIGHT: 0.24, DEPTH: 0.09, Y: -0.08, Z: -0.17 },
    REAR_FLAP: { WIDTH: 0.33, HEIGHT: 0.06, DEPTH: 0.1, Y: 0.02, Z: -0.175 },
    SIDE_POCKET: { WIDTH: 0.08, HEIGHT: 0.22, DEPTH: 0.15, X: 0.23, Y: -0.06, Z: -0.03 },
    SPARE_MITTEN: { WIDTH: 0.06, HEIGHT: 0.11, DEPTH: 0.085, X: -0.235, Y: 0.08, Z: -0.02, TILT: 0.12, ROLL: 0.22 },
    SPARE_CUFF: { WIDTH: 0.065, HEIGHT: 0.04, DEPTH: 0.09, X: -0.23, Y: 0.03, Z: -0.02, TILT: 0.12, ROLL: 0.22 },
    CHARM: { X: 0.11, Y: 0.01, Z: -0.22, CORD_HEIGHT: 0.05, PLATE_WIDTH: 0.055, PLATE_HEIGHT: 0.065, PLATE_DEPTH: 0.02 }
} as const;

export function createPlayerBackpack(materials: PlayerMaterials): THREE.Group {
    const pack = new THREE.Group();
    pack.name = 'player-backpack';
    pack.position.set(PACK.X, PACK.Y, PACK.Z);

    const parts = createPlayerPartCollector();

    parts.box(PACK.BODY.WIDTH, PACK.BODY.HEIGHT, PACK.BODY.DEPTH, materials.backpackBody, 0, PACK.BODY.Y, PACK.BODY.Z);
    parts.box(
        PACK.SHOULDER.WIDTH,
        PACK.SHOULDER.HEIGHT,
        PACK.SHOULDER.DEPTH,
        materials.backpackBody,
        0,
        PACK.SHOULDER.Y,
        PACK.SHOULDER.Z
    );
    parts.box(
        PACK.FLAP.WIDTH,
        PACK.FLAP.HEIGHT,
        PACK.FLAP.DEPTH,
        materials.backpackFlap,
        0,
        PACK.FLAP.Y,
        PACK.FLAP.Z,
        PACK.FLAP.TILT
    );
    parts.box(
        PACK.FLAP_FRONT.WIDTH,
        PACK.FLAP_FRONT.HEIGHT,
        PACK.FLAP_FRONT.DEPTH,
        materials.backpackFlap,
        0,
        PACK.FLAP_FRONT.Y,
        PACK.FLAP_FRONT.Z,
        PACK.FLAP_FRONT.TILT
    );

    [-1, 1].forEach((side) => {
        parts.box(
            PACK.CLOSURE.WIDTH,
            PACK.CLOSURE.HEIGHT,
            PACK.CLOSURE.DEPTH,
            materials.strap,
            side * PACK.CLOSURE.X,
            PACK.CLOSURE.Y,
            PACK.CLOSURE.Z
        );
        parts.box(
            PACK.CLOSURE_BUCKLE.WIDTH,
            PACK.CLOSURE_BUCKLE.HEIGHT,
            PACK.CLOSURE_BUCKLE.DEPTH,
            materials.buckle,
            side * PACK.CLOSURE_BUCKLE.X,
            PACK.CLOSURE_BUCKLE.Y,
            PACK.CLOSURE_BUCKLE.Z
        );
    });

    // Rolled mat across the top, held by two leather rings.
    parts.cylinder(
        PACK.BEDROLL.RADIUS,
        PACK.BEDROLL.RADIUS,
        PACK.BEDROLL.LENGTH,
        PACK.BEDROLL.SEGMENTS,
        materials.bedroll,
        0,
        PACK.BEDROLL.Y,
        PACK.BEDROLL.Z,
        0,
        0,
        Math.PI / 2
    );
    [-1, 1].forEach((side) => {
        parts.cylinder(
            PACK.BEDROLL.RADIUS + 0.005,
            PACK.BEDROLL.RADIUS + 0.005,
            PACK.BEDROLL.RING_LENGTH,
            PACK.BEDROLL.SEGMENTS,
            materials.strap,
            side * PACK.BEDROLL.RING_X,
            PACK.BEDROLL.Y,
            PACK.BEDROLL.Z,
            0,
            0,
            Math.PI / 2
        );
    });

    parts.box(
        PACK.REAR_POUCH.WIDTH,
        PACK.REAR_POUCH.HEIGHT,
        PACK.REAR_POUCH.DEPTH,
        materials.backpackPocket,
        0,
        PACK.REAR_POUCH.Y,
        PACK.REAR_POUCH.Z
    );
    parts.box(
        PACK.REAR_FLAP.WIDTH,
        PACK.REAR_FLAP.HEIGHT,
        PACK.REAR_FLAP.DEPTH,
        materials.backpackFlap,
        0,
        PACK.REAR_FLAP.Y,
        PACK.REAR_FLAP.Z
    );
    [-1, 1].forEach((side) => {
        parts.box(
            PACK.SIDE_POCKET.WIDTH,
            PACK.SIDE_POCKET.HEIGHT,
            PACK.SIDE_POCKET.DEPTH,
            materials.backpackPocket,
            side * PACK.SIDE_POCKET.X,
            PACK.SIDE_POCKET.Y,
            PACK.SIDE_POCKET.Z
        );
    });

    // The spare mitten tucked into the left pocket: one more small sign that this
    // pack belongs to somebody who has been walking for a long time.
    parts.box(
        PACK.SPARE_MITTEN.WIDTH,
        PACK.SPARE_MITTEN.HEIGHT,
        PACK.SPARE_MITTEN.DEPTH,
        materials.mittens,
        PACK.SPARE_MITTEN.X,
        PACK.SPARE_MITTEN.Y,
        PACK.SPARE_MITTEN.Z,
        PACK.SPARE_MITTEN.TILT,
        0,
        PACK.SPARE_MITTEN.ROLL
    );
    parts.box(
        PACK.SPARE_CUFF.WIDTH,
        PACK.SPARE_CUFF.HEIGHT,
        PACK.SPARE_CUFF.DEPTH,
        materials.mittenCuff,
        PACK.SPARE_CUFF.X,
        PACK.SPARE_CUFF.Y,
        PACK.SPARE_CUFF.Z,
        PACK.SPARE_CUFF.TILT,
        0,
        PACK.SPARE_CUFF.ROLL
    );

    parts.box(0.015, PACK.CHARM.CORD_HEIGHT, 0.015, materials.cord, PACK.CHARM.X, PACK.CHARM.Y - 0.025, PACK.CHARM.Z);
    parts.box(
        PACK.CHARM.PLATE_WIDTH,
        PACK.CHARM.PLATE_HEIGHT,
        PACK.CHARM.PLATE_DEPTH,
        materials.charm,
        PACK.CHARM.X,
        PACK.CHARM.Y - 0.07,
        PACK.CHARM.Z,
        0,
        0.2,
        0.15
    );

    pack.add(parts.build('player-backpack-shell'));
    return pack;
}
