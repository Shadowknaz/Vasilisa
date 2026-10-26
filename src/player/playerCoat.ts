// The tulup of the heroine: the flared coat skirt, the belted upper torso with its
// sheepskin collar, the knitted scarf and the pack straps that run over the
// shoulders. The skirt hangs from the hips and is a sibling of the torso pivot,
// exactly as in the reference model, so a walking sway of the hem never drags the
// chest with it.
//
// Model frame: metres, feet on y = 0, front along +Z.
import type { PlayerMaterials } from './playerMaterials.js';
import { createPlayerPartCollector } from './playerParts.js';
import * as THREE from 'three';

const COAT = {
    // Sibling pivots of the body root.
    SKIRT_Y: 0.68,
    TORSO_Y: 0.94,
    SKIRT: {
        TOP_RADIUS: 0.23,
        BOTTOM_RADIUS: 0.33,
        HEIGHT: 0.56,
        SEGMENTS: 8,
        // The coat is open down the front: the first-person camera looks down
        // through this slit at the boots. A closed tulup is a solid lampshade from
        // above — the hem alone hides the feet at any look-down angle.
        OPENING: 1,
        HEM: { TOP_RADIUS: 0.335, BOTTOM_RADIUS: 0.345, HEIGHT: 0.09, Y: -0.25 },
        // The sheepskin placket runs along the two open edges, not down the middle.
        FRONT_TRIM: { WIDTH: 0.07, HEIGHT: 0.58, DEPTH: 0.05, X: -0.134, Z: 0.246, TILT: -0.14, YAW: -0.5 },
        FRONT_LAP: { WIDTH: 0.055, HEIGHT: 0.56, DEPTH: 0.04, X: 0.134, Z: 0.246, TILT: -0.14, YAW: 0.5 },
        PATCH: { WIDTH: 0.14, HEIGHT: 0.16, DEPTH: 0.04, X: 0.24, Y: -0.06, Z: 0.14, TILT: -0.1, YAW: 0.9 }
    },
    TORSO: {
        BELT: { TOP_RADIUS: 0.245, BOTTOM_RADIUS: 0.25, HEIGHT: 0.085, SEGMENTS: 8, Y: 0.02 },
        BUCKLE: { WIDTH: 0.06, HEIGHT: 0.07, DEPTH: 0.03, Z: 0.245 },
        BUCKLE_TONGUE: { WIDTH: 0.035, HEIGHT: 0.05, DEPTH: 0.035, Z: 0.248 },
        BODY_ROUND: { TOP_RADIUS: 0.24, BOTTOM_RADIUS: 0.235, HEIGHT: 0.46, SEGMENTS: 8, Y: 0.26 },
        BODY_BOX: { WIDTH: 0.46, HEIGHT: 0.44, DEPTH: 0.31, Y: 0.26, TILT: 0.03 },
        FRONT_TRIM: { WIDTH: 0.085, HEIGHT: 0.45, DEPTH: 0.05, X: -0.02, Y: 0.26, Z: 0.16, TILT: 0.03 },
        TOGGLE: { WIDTH: 0.065, HEIGHT: 0.025, DEPTH: 0.03, X: 0.02, FIRST_Y: 0.14, STEP_Y: 0.12, Z: 0.18, COUNT: 3 },
        POCKET: { WIDTH: 0.04, HEIGHT: 0.16, DEPTH: 0.15, X: 0.25, Y: -0.06, Z: 0.05, TILT: 0.12 },
        COLLAR: { TOP_RADIUS: 0.19, BOTTOM_RADIUS: 0.17, HEIGHT: 0.16, SEGMENTS: 8, Y: 0.49, Z: -0.02, TILT: 0.08 },
        LAPEL: { WIDTH: 0.14, HEIGHT: 0.18, DEPTH: 0.12, X: 0.12, Y: 0.44, Z: 0.11, TILT: 0.2, YAW: 0.3, ROLL: 0.25 },
        SCARF: { TOP_RADIUS: 0.135, BOTTOM_RADIUS: 0.145, HEIGHT: 0.11, SEGMENTS: 8, Y: 0.48, Z: 0.01 },
        STRAP_FRONT: { WIDTH: 0.068, HEIGHT: 0.46, DEPTH: 0.04, X: 0.155, Y: 0.27, Z: 0.16, TILT: 0.05, ROLL: 0.05 },
        STRAP_TOP: { WIDTH: 0.068, HEIGHT: 0.1, DEPTH: 0.34, X: 0.155, Y: 0.5, TILT: 0.08 },
        CHEST_STRAP: { WIDTH: 0.32, HEIGHT: 0.038, DEPTH: 0.035, Y: 0.3, Z: 0.175 },
        CHEST_BUCKLE: { WIDTH: 0.05, HEIGHT: 0.048, DEPTH: 0.04, Y: 0.3, Z: 0.18 }
    }
} as const;

interface PlayerCoat {
    skirt: THREE.Group;
    torso: THREE.Group;
    // The upper coat (chest, collar, straps). It is the group the first-person rig
    // hides; the waist and the skirt stay.
    chest: THREE.Group;
    // Rest height of the torso pivot: the pose animator adds its breathing lift
    // to this value instead of duplicating a model dimension.
    torsoBaseY: number;
}

export function createPlayerCoat(materials: PlayerMaterials): PlayerCoat {
    const skirt = new THREE.Group();
    skirt.name = 'player-skirt';
    skirt.position.y = COAT.SKIRT_Y;

    const hem = createPlayerPartCollector();
    const skirtShape = COAT.SKIRT;
    const arcStart = skirtShape.OPENING / 2;
    const arcLength = Math.PI * 2 - skirtShape.OPENING;
    // Open shells with a front slit: the first-person camera looks down through
    // the hem, and a closed cap at the waist would hide the legs the coat frames.
    hem.openCylinder(
        skirtShape.TOP_RADIUS,
        skirtShape.BOTTOM_RADIUS,
        skirtShape.HEIGHT,
        skirtShape.SEGMENTS,
        materials.tulup,
        0,
        0,
        0,
        arcStart,
        arcLength
    );
    hem.openCylinder(
        skirtShape.HEM.TOP_RADIUS,
        skirtShape.HEM.BOTTOM_RADIUS,
        skirtShape.HEM.HEIGHT,
        skirtShape.SEGMENTS,
        materials.sheepskinDirty,
        0,
        skirtShape.HEM.Y,
        0,
        arcStart,
        arcLength
    );
    hem.box(
        skirtShape.FRONT_TRIM.WIDTH,
        skirtShape.FRONT_TRIM.HEIGHT,
        skirtShape.FRONT_TRIM.DEPTH,
        materials.sheepskin,
        skirtShape.FRONT_TRIM.X,
        0,
        skirtShape.FRONT_TRIM.Z,
        skirtShape.FRONT_TRIM.TILT,
        skirtShape.FRONT_TRIM.YAW
    );
    hem.box(
        skirtShape.FRONT_LAP.WIDTH,
        skirtShape.FRONT_LAP.HEIGHT,
        skirtShape.FRONT_LAP.DEPTH,
        materials.tulupDark,
        skirtShape.FRONT_LAP.X,
        0,
        skirtShape.FRONT_LAP.Z,
        skirtShape.FRONT_LAP.TILT,
        skirtShape.FRONT_LAP.YAW
    );
    hem.box(
        skirtShape.PATCH.WIDTH,
        skirtShape.PATCH.HEIGHT,
        skirtShape.PATCH.DEPTH,
        materials.tulupPatch,
        skirtShape.PATCH.X,
        skirtShape.PATCH.Y,
        skirtShape.PATCH.Z,
        skirtShape.PATCH.TILT,
        skirtShape.PATCH.YAW
    );
    skirt.add(hem.build('player-skirt-shell'));

    const torso = new THREE.Group();
    torso.name = 'player-torso';
    torso.position.y = COAT.TORSO_Y;
    // The torso is split at the belt: the waist is always drawn (it frames the top
    // of the skirt), while the bulky chest can be hidden without losing the body.
    const waist = new THREE.Group();
    waist.name = 'player-waist';
    const chest = new THREE.Group();
    chest.name = 'player-chest';
    torso.add(waist, chest);

    const waistParts = createPlayerPartCollector();
    const chestParts = createPlayerPartCollector();
    const shape = COAT.TORSO;

    // The belt and the round body of the tulup are hollow shells, not capped
    // drums: the first-person sight line to the boots runs down through their
    // interior. Their caps are invisible from outside (the belt hides the waist
    // seam, the collar hides the shoulders), so nothing reads differently from the
    // front, and the legs stay in view when the pilot looks down.
    waistParts.openCylinder(
        shape.BELT.TOP_RADIUS,
        shape.BELT.BOTTOM_RADIUS,
        shape.BELT.HEIGHT,
        shape.BELT.SEGMENTS,
        materials.strap,
        0,
        shape.BELT.Y,
        0
    );
    waistParts.box(shape.BUCKLE.WIDTH, shape.BUCKLE.HEIGHT, shape.BUCKLE.DEPTH, materials.buckle, 0, shape.BELT.Y, shape.BUCKLE.Z);
    waistParts.box(
        shape.BUCKLE_TONGUE.WIDTH,
        shape.BUCKLE_TONGUE.HEIGHT,
        shape.BUCKLE_TONGUE.DEPTH,
        materials.strap,
        0,
        shape.BELT.Y,
        shape.BUCKLE_TONGUE.Z
    );

    chestParts.openCylinder(
        shape.BODY_ROUND.TOP_RADIUS,
        shape.BODY_ROUND.BOTTOM_RADIUS,
        shape.BODY_ROUND.HEIGHT,
        shape.BODY_ROUND.SEGMENTS,
        materials.tulup,
        0,
        shape.BODY_ROUND.Y,
        0
    );
    // The chest is the bulky part of the tulup; together with the open coat skirt
    // it is what the first-person camera sees when the pilot looks down.
    chestParts.box(
        shape.BODY_BOX.WIDTH,
        shape.BODY_BOX.HEIGHT,
        shape.BODY_BOX.DEPTH,
        materials.tulup,
        0,
        shape.BODY_BOX.Y,
        0,
        shape.BODY_BOX.TILT
    );
    chestParts.box(
        shape.FRONT_TRIM.WIDTH,
        shape.FRONT_TRIM.HEIGHT,
        shape.FRONT_TRIM.DEPTH,
        materials.sheepskin,
        shape.FRONT_TRIM.X,
        shape.FRONT_TRIM.Y,
        shape.FRONT_TRIM.Z,
        shape.FRONT_TRIM.TILT
    );
    for (let index = 0; index < shape.TOGGLE.COUNT; index++) {
        chestParts.box(
            shape.TOGGLE.WIDTH,
            shape.TOGGLE.HEIGHT,
            shape.TOGGLE.DEPTH,
            materials.strap,
            shape.TOGGLE.X,
            shape.TOGGLE.FIRST_Y + index * shape.TOGGLE.STEP_Y,
            shape.TOGGLE.Z
        );
    }
    [-1, 1].forEach((side) => {
        chestParts.box(
            shape.POCKET.WIDTH,
            shape.POCKET.HEIGHT,
            shape.POCKET.DEPTH,
            materials.tulupDark,
            side * shape.POCKET.X,
            shape.POCKET.Y,
            shape.POCKET.Z,
            0,
            0,
            -side * shape.POCKET.TILT
        );
    });

    // Upturned sheepskin collar, its two lapels and the scarf tucked underneath.
    chestParts.cylinder(
        shape.COLLAR.TOP_RADIUS,
        shape.COLLAR.BOTTOM_RADIUS,
        shape.COLLAR.HEIGHT,
        shape.COLLAR.SEGMENTS,
        materials.sheepskin,
        0,
        shape.COLLAR.Y,
        shape.COLLAR.Z,
        shape.COLLAR.TILT
    );
    [-1, 1].forEach((side) => {
        chestParts.box(
            shape.LAPEL.WIDTH,
            shape.LAPEL.HEIGHT,
            shape.LAPEL.DEPTH,
            materials.sheepskin,
            side * shape.LAPEL.X,
            shape.LAPEL.Y,
            shape.LAPEL.Z,
            shape.LAPEL.TILT,
            side * shape.LAPEL.YAW,
            -side * shape.LAPEL.ROLL
        );
    });
    chestParts.cylinder(
        shape.SCARF.TOP_RADIUS,
        shape.SCARF.BOTTOM_RADIUS,
        shape.SCARF.HEIGHT,
        shape.SCARF.SEGMENTS,
        materials.scarf,
        0,
        shape.SCARF.Y,
        shape.SCARF.Z
    );

    // Pack straps over the shoulders and the chest strap with its buckle.
    [-1, 1].forEach((side) => {
        chestParts.box(
            shape.STRAP_FRONT.WIDTH,
            shape.STRAP_FRONT.HEIGHT,
            shape.STRAP_FRONT.DEPTH,
            materials.strap,
            side * shape.STRAP_FRONT.X,
            shape.STRAP_FRONT.Y,
            shape.STRAP_FRONT.Z,
            shape.STRAP_FRONT.TILT,
            0,
            -side * shape.STRAP_FRONT.ROLL
        );
        chestParts.box(
            shape.STRAP_TOP.WIDTH,
            shape.STRAP_TOP.HEIGHT,
            shape.STRAP_TOP.DEPTH,
            materials.strap,
            side * shape.STRAP_TOP.X,
            shape.STRAP_TOP.Y,
            0,
            shape.STRAP_TOP.TILT
        );
    });
    chestParts.box(
        shape.CHEST_STRAP.WIDTH,
        shape.CHEST_STRAP.HEIGHT,
        shape.CHEST_STRAP.DEPTH,
        materials.strap,
        0,
        shape.CHEST_STRAP.Y,
        shape.CHEST_STRAP.Z
    );
    chestParts.box(
        shape.CHEST_BUCKLE.WIDTH,
        shape.CHEST_BUCKLE.HEIGHT,
        shape.CHEST_BUCKLE.DEPTH,
        materials.buckle,
        0,
        shape.CHEST_BUCKLE.Y,
        shape.CHEST_BUCKLE.Z
    );

    waist.add(waistParts.build('player-waist-belt'));
    chest.add(chestParts.build('player-tulup'));

    return { skirt, torso, chest, torsoBaseY: COAT.TORSO_Y };
}
