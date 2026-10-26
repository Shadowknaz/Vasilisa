// Tulup sleeves, sheepskin cuffs and the patterned mittens of the heroine.
//
// Unlike the legs, the arms are not parented to the world body: the pose animator
// pins this assembly to the camera, the way every first-person viewmodel does,
// so the mittens stay in the bottom of the frame when the pilot looks up or down.
// The shoulder positions are still the model's own (1.36 m), which is what makes
// the sleeves line up with the torso when the camera is level.
//
// Model frame: metres, front along +Z. The shoulder pitch is applied at runtime.
import type { PlayerMaterials } from './playerMaterials.js';
import { createPlayerPartCollector } from './playerParts.js';
import * as THREE from 'three';

const ARM = {
    SHOULDER: { X: 0.26, Y: 1.36, Z: 0.01 },
    UPPER_LENGTH: 0.3,
    SLEEVE: { TOP_RADIUS: 0.088, BOTTOM_RADIUS: 0.078, HEIGHT: 0.3, SEGMENTS: 7, Y: -0.15 },
    ELBOW_PATCH: { WIDTH: 0.04, HEIGHT: 0.11, DEPTH: 0.09, X: 0.095, Y: -0.17, Z: -0.01, TILT: 0.12, ROLL: 0.26 },
    FOREARM: { TOP_RADIUS: 0.078, BOTTOM_RADIUS: 0.082, HEIGHT: 0.24, SEGMENTS: 7, Y: -0.12 },
    CUFF: { TOP_RADIUS: 0.092, BOTTOM_RADIUS: 0.095, HEIGHT: 0.08, SEGMENTS: 8, Y: -0.22 },
    MITTEN: {
        Y: -0.25,
        CUFF_TOP_RADIUS: 0.054,
        CUFF_BOTTOM_RADIUS: 0.058,
        CUFF_HEIGHT: 0.07,
        CUFF_Y: -0.03,
        BODY: { WIDTH: 0.105, HEIGHT: 0.13, DEPTH: 0.115, Y: -0.115, Z: 0.005 },
        LOWER: { WIDTH: 0.092, HEIGHT: 0.045, DEPTH: 0.098, Y: -0.185, Z: 0.005 },
        THUMB: { WIDTH: 0.048, HEIGHT: 0.085, DEPTH: 0.052, X: 0.055, Y: -0.1, Z: 0.04, TILT: -0.38, ROLL: 0.48 },
        CORD: { WIDTH: 0.018, HEIGHT: 0.09, DEPTH: 0.018, X: 0.035, Y: 0.015, Z: -0.02, ROLL: 0.2 }
    }
} as const;

interface PlayerArms {
    group: THREE.Group;
    // [left, right] in model space.
    shoulders: [THREE.Group, THREE.Group];
    elbows: [THREE.Group, THREE.Group];
    mittens: [THREE.Group, THREE.Group];
}

function buildArm(side: -1 | 1, materials: PlayerMaterials): {
    shoulder: THREE.Group;
    elbow: THREE.Group;
    mitten: THREE.Group;
} {
    const shoulder = new THREE.Group();
    shoulder.name = side < 0 ? 'player-shoulder-left' : 'player-shoulder-right';
    shoulder.position.set(side * ARM.SHOULDER.X, ARM.SHOULDER.Y, ARM.SHOULDER.Z);

    const sleeve = createPlayerPartCollector();
    sleeve.cylinder(
        ARM.SLEEVE.TOP_RADIUS,
        ARM.SLEEVE.BOTTOM_RADIUS,
        ARM.SLEEVE.HEIGHT,
        ARM.SLEEVE.SEGMENTS,
        materials.tulup,
        0,
        ARM.SLEEVE.Y,
        0
    );
    sleeve.box(
        ARM.ELBOW_PATCH.WIDTH,
        ARM.ELBOW_PATCH.HEIGHT,
        ARM.ELBOW_PATCH.DEPTH,
        materials.tulupPatch,
        side * ARM.ELBOW_PATCH.X,
        ARM.ELBOW_PATCH.Y,
        ARM.ELBOW_PATCH.Z,
        ARM.ELBOW_PATCH.TILT,
        0,
        side * ARM.ELBOW_PATCH.ROLL
    );
    shoulder.add(sleeve.build(side < 0 ? 'player-sleeve-left' : 'player-sleeve-right'));

    const elbow = new THREE.Group();
    elbow.name = side < 0 ? 'player-elbow-left' : 'player-elbow-right';
    elbow.position.set(0, -ARM.UPPER_LENGTH, 0);
    shoulder.add(elbow);

    const forearm = createPlayerPartCollector();
    forearm.cylinder(
        ARM.FOREARM.TOP_RADIUS,
        ARM.FOREARM.BOTTOM_RADIUS,
        ARM.FOREARM.HEIGHT,
        ARM.FOREARM.SEGMENTS,
        materials.tulup,
        0,
        ARM.FOREARM.Y,
        0
    );
    forearm.cylinder(
        ARM.CUFF.TOP_RADIUS,
        ARM.CUFF.BOTTOM_RADIUS,
        ARM.CUFF.HEIGHT,
        ARM.CUFF.SEGMENTS,
        materials.sheepskin,
        0,
        ARM.CUFF.Y,
        0
    );
    elbow.add(forearm.build(side < 0 ? 'player-forearm-left' : 'player-forearm-right'));

    const mitten = new THREE.Group();
    mitten.name = side < 0 ? 'player-mitten-left' : 'player-mitten-right';
    mitten.position.set(0, ARM.MITTEN.Y, 0);
    elbow.add(mitten);

    const knit = createPlayerPartCollector();
    knit.cylinder(
        ARM.MITTEN.CUFF_TOP_RADIUS,
        ARM.MITTEN.CUFF_BOTTOM_RADIUS,
        ARM.MITTEN.CUFF_HEIGHT,
        ARM.SLEEVE.SEGMENTS,
        materials.mittenCuff,
        0,
        ARM.MITTEN.CUFF_Y,
        0
    );
    knit.box(
        ARM.MITTEN.BODY.WIDTH,
        ARM.MITTEN.BODY.HEIGHT,
        ARM.MITTEN.BODY.DEPTH,
        materials.mittens,
        0,
        ARM.MITTEN.BODY.Y,
        ARM.MITTEN.BODY.Z
    );
    knit.box(
        ARM.MITTEN.LOWER.WIDTH,
        ARM.MITTEN.LOWER.HEIGHT,
        ARM.MITTEN.LOWER.DEPTH,
        materials.mittens,
        0,
        ARM.MITTEN.LOWER.Y,
        ARM.MITTEN.LOWER.Z
    );
    knit.box(
        ARM.MITTEN.THUMB.WIDTH,
        ARM.MITTEN.THUMB.HEIGHT,
        ARM.MITTEN.THUMB.DEPTH,
        materials.mittens,
        -side * ARM.MITTEN.THUMB.X,
        ARM.MITTEN.THUMB.Y,
        ARM.MITTEN.THUMB.Z,
        ARM.MITTEN.THUMB.TILT,
        0,
        -side * ARM.MITTEN.THUMB.ROLL
    );
    knit.box(
        ARM.MITTEN.CORD.WIDTH,
        ARM.MITTEN.CORD.HEIGHT,
        ARM.MITTEN.CORD.DEPTH,
        materials.cord,
        side * ARM.MITTEN.CORD.X,
        ARM.MITTEN.CORD.Y,
        ARM.MITTEN.CORD.Z,
        0,
        0,
        -side * ARM.MITTEN.CORD.ROLL
    );
    mitten.add(knit.build(side < 0 ? 'player-mitten-left-knit' : 'player-mitten-right-knit'));

    return { shoulder, elbow, mitten };
}

export function createPlayerArms(materials: PlayerMaterials): PlayerArms {
    const group = new THREE.Group();
    group.name = 'player-arms';

    const left = buildArm(-1, materials);
    const right = buildArm(1, materials);
    group.add(left.shoulder, right.shoulder);

    return {
        group,
        shoulders: [left.shoulder, right.shoulder],
        elbows: [left.elbow, right.elbow],
        mittens: [left.mitten, right.mitten]
    };
}
