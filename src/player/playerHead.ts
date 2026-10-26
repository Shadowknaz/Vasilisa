// Head of the heroine: the round child's face, frost-flushed cheeks, two braids
// under a knitted hat, and the battered protective helmet with its switched-off
// headlamp. Ported from the reference model at reference proportions.
//
// The first-person camera sits on this head's eye line, so the rig hides the whole
// group while the pilot is walking: its helmet top is 0.2 m above the eye. The
// model is kept complete for any future third-person or showcase camera.
import type { PlayerMaterials } from './playerMaterials.js';
import { createPlayerPartCollector } from './playerParts.js';
import * as THREE from 'three';

const HEAD = {
    // Neck-and-face block, in head-pivot space.
    NECK: { TOP_RADIUS: 0.062, BOTTOM_RADIUS: 0.072, HEIGHT: 0.11, SEGMENTS: 8, Y: 0.045, Z: -0.01 },
    SKULL: { RADIUS: 0.132, WIDTH_SEGMENTS: 10, HEIGHT_SEGMENTS: 8, Y: 0.205, Z: -0.005, SX: 1.02, SY: 1, SZ: 0.96 },
    CHEEK: { RADIUS: 0.072, WIDTH_SEGMENTS: 8, HEIGHT_SEGMENTS: 6, X: 0.052, Y: 0.168, Z: 0.048, SX: 1.08, SY: 0.92, SZ: 0.95 },
    CHIN: { RADIUS: 0.074, WIDTH_SEGMENTS: 8, HEIGHT_SEGMENTS: 6, Y: 0.152, Z: 0.048, SX: 1.12, SY: 0.86, SZ: 0.92 },
    BLUSH: { RADIUS: 0.028, HEIGHT: 0.015, SEGMENTS: 7, X: 0.076, Y: 0.172, Z: 0.106, ROLL: 0.35 },
    EYE: {
        X: 0.053,
        Y: 0.218,
        Z: 0.112,
        YAW: 0.22,
        SOCKET: { WIDTH: 0.064, HEIGHT: 0.048, DEPTH: 0.02 },
        WHITE: { WIDTH: 0.052, HEIGHT: 0.036, DEPTH: 0.02, Y: -0.002, Z: 0.005 },
        DARK: { WIDTH: 0.032, HEIGHT: 0.034, DEPTH: 0.022, X: 0.003, Y: -0.002, Z: 0.008 },
        HIGHLIGHT: { WIDTH: 0.013, HEIGHT: 0.013, DEPTH: 0.024, X: 0.009, Y: 0.006, Z: 0.011 }
    },
    NOSE: { RADIUS: 0.023, WIDTH_SEGMENTS: 6, HEIGHT_SEGMENTS: 5, Y: 0.192, Z: 0.126, SX: 0.95, SY: 1.1, SZ: 1.15 },
    MOUTH: { WIDTH: 0.052, HEIGHT: 0.015, DEPTH: 0.02, Y: 0.142, Z: 0.118 },
    BANGS: { TOP_RADIUS: 0.115, BOTTOM_RADIUS: 0.122, HEIGHT: 0.045, SEGMENTS: 8, Y: 0.272, Z: 0.028, TILT: 0.16 },
    BRAID: {
        X: 0.115,
        Y: 0.13,
        Z: 0.03,
        TILT: -0.14,
        ROLL: 0.14,
        SEGMENTS: [
            { SIZE: 0.052, HEIGHT: 0.08, Y: -0.03, Z: 0, YAW: 0.3 },
            { SIZE: 0.046, HEIGHT: 0.08, Y: -0.1, Z: 0.01, YAW: -0.3 },
            { SIZE: 0.042, HEIGHT: 0.07, Y: -0.16, Z: 0.015, YAW: 0.3 },
            { SIZE: 0.036, HEIGHT: 0.05, Y: -0.23, Z: 0.02, YAW: 0 }
        ],
        TIE: { SIZE: 0.048, HEIGHT: 0.024, Y: -0.2, Z: 0.015 }
    },
    HAT: {
        TOP_RADIUS: 0.142,
        BOTTOM_RADIUS: 0.145,
        HEIGHT: 0.07,
        SEGMENTS: 10,
        Y: 0.292,
        Z: -0.005,
        EARFLAP: { WIDTH: 0.048, HEIGHT: 0.165, DEPTH: 0.11, X: 0.132, Y: 0.19, Z: 0.01, YAW: 0.08, ROLL: 0.12 },
        EARFLAP_FUR: { WIDTH: 0.035, HEIGHT: 0.15, DEPTH: 0.095, X: 0.118, Y: 0.19, Z: 0.015, YAW: 0.08, ROLL: 0.12 }
    },
    CHINSTRAP: {
        SIDE: { WIDTH: 0.022, HEIGHT: 0.16, DEPTH: 0.025, X: 0.112, Y: 0.165, Z: 0.04, TILT: 0.15, ROLL: 0.18 },
        BOTTOM: { WIDTH: 0.14, HEIGHT: 0.022, DEPTH: 0.03, Y: 0.082, Z: 0.055 }
    },
    HELMET: {
        Y: 0.31,
        Z: -0.005,
        DOME: { TOP_RADIUS: 0.138, BOTTOM_RADIUS: 0.168, HEIGHT: 0.13, SEGMENTS: 10, Y: 0.05 },
        CROWN: { TOP_RADIUS: 0.088, BOTTOM_RADIUS: 0.138, HEIGHT: 0.06, SEGMENTS: 10, Y: 0.135 },
        RIM: { TOP_RADIUS: 0.174, BOTTOM_RADIUS: 0.176, HEIGHT: 0.036, SEGMENTS: 10, Y: -0.01, Z: 0.005, TILT: 0.04 },
        BRIM: { WIDTH: 0.22, HEIGHT: 0.028, DEPTH: 0.08, X: 0, Y: -0.015, Z: 0.145, TILT: 0.16 },
        STRAP: { TOP_RADIUS: 0.165, BOTTOM_RADIUS: 0.17, HEIGHT: 0.042, SEGMENTS: 10, Y: 0.035 },
        BATTERY: { WIDTH: 0.11, HEIGHT: 0.075, DEPTH: 0.05, Y: 0.035, Z: -0.168 },
        CABLE: { WIDTH: 0.02, HEIGHT: 0.02, DEPTH: 0.26, X: 0.158, Y: 0.055, Z: -0.02 }
    },
    LAMP: {
        Y: 0.048,
        Z: 0.168,
        TILT: 0.12,
        BRACKET: { WIDTH: 0.095, HEIGHT: 0.075, DEPTH: 0.05, Z: -0.01 },
        HOUSING: { TOP_RADIUS: 0.048, BOTTOM_RADIUS: 0.052, HEIGHT: 0.065, SEGMENTS: 8, Z: 0.025 },
        LENS: { TOP_RADIUS: 0.04, BOTTOM_RADIUS: 0.04, HEIGHT: 0.015, SEGMENTS: 8, Z: 0.055 }
    }
} as const;

// A pair of eyes is the only nested frame of the face: each eye is yawed outward
// to follow the round skull, so its four plates are baked through that yaw.
function buildEye(side: -1 | 1, materials: PlayerMaterials): THREE.Group {
    const eye = new THREE.Group();
    eye.name = side < 0 ? 'player-eye-left' : 'player-eye-right';
    eye.position.set(side * HEAD.EYE.X, HEAD.EYE.Y, HEAD.EYE.Z);
    eye.rotation.y = side * HEAD.EYE.YAW;

    const parts = createPlayerPartCollector();
    parts.box(HEAD.EYE.SOCKET.WIDTH, HEAD.EYE.SOCKET.HEIGHT, HEAD.EYE.SOCKET.DEPTH, materials.eyeSocket);
    parts.box(
        HEAD.EYE.WHITE.WIDTH,
        HEAD.EYE.WHITE.HEIGHT,
        HEAD.EYE.WHITE.DEPTH,
        materials.eyeWhite,
        0,
        HEAD.EYE.WHITE.Y,
        HEAD.EYE.WHITE.Z
    );
    parts.box(
        HEAD.EYE.DARK.WIDTH,
        HEAD.EYE.DARK.HEIGHT,
        HEAD.EYE.DARK.DEPTH,
        materials.eyeDark,
        -side * HEAD.EYE.DARK.X,
        HEAD.EYE.DARK.Y,
        HEAD.EYE.DARK.Z
    );
    parts.box(
        HEAD.EYE.HIGHLIGHT.WIDTH,
        HEAD.EYE.HIGHLIGHT.HEIGHT,
        HEAD.EYE.HIGHLIGHT.DEPTH,
        materials.eyeHighlight,
        -side * HEAD.EYE.HIGHLIGHT.X,
        HEAD.EYE.HIGHLIGHT.Y,
        HEAD.EYE.HIGHLIGHT.Z
    );
    eye.add(parts.build(side < 0 ? 'player-eye-left-plates' : 'player-eye-right-plates'));
    return eye;
}

function buildBraid(side: -1 | 1, materials: PlayerMaterials): THREE.Group {
    const braid = new THREE.Group();
    braid.name = side < 0 ? 'player-braid-left' : 'player-braid-right';
    braid.position.set(side * HEAD.BRAID.X, HEAD.BRAID.Y, HEAD.BRAID.Z);
    braid.rotation.set(HEAD.BRAID.TILT, 0, -side * HEAD.BRAID.ROLL);

    const parts = createPlayerPartCollector();
    HEAD.BRAID.SEGMENTS.forEach((segment) => {
        parts.box(segment.SIZE, segment.HEIGHT, segment.SIZE, materials.hair, 0, segment.Y, segment.Z, 0, segment.YAW, 0);
    });
    parts.box(
        HEAD.BRAID.TIE.SIZE,
        HEAD.BRAID.TIE.HEIGHT,
        HEAD.BRAID.TIE.SIZE,
        materials.hairTie,
        0,
        HEAD.BRAID.TIE.Y,
        HEAD.BRAID.TIE.Z
    );
    braid.add(parts.build(side < 0 ? 'player-braid-left-knots' : 'player-braid-right-knots'));
    return braid;
}

function buildHelmet(materials: PlayerMaterials): THREE.Group {
    const helmet = new THREE.Group();
    helmet.name = 'player-helmet';
    helmet.position.set(0, HEAD.HELMET.Y, HEAD.HELMET.Z);

    const parts = createPlayerPartCollector();
    parts.cylinder(
        HEAD.HELMET.DOME.TOP_RADIUS,
        HEAD.HELMET.DOME.BOTTOM_RADIUS,
        HEAD.HELMET.DOME.HEIGHT,
        HEAD.HELMET.DOME.SEGMENTS,
        materials.helmet,
        0,
        HEAD.HELMET.DOME.Y,
        0
    );
    parts.cylinder(
        HEAD.HELMET.CROWN.TOP_RADIUS,
        HEAD.HELMET.CROWN.BOTTOM_RADIUS,
        HEAD.HELMET.CROWN.HEIGHT,
        HEAD.HELMET.CROWN.SEGMENTS,
        materials.helmet,
        0,
        HEAD.HELMET.CROWN.Y,
        0
    );
    parts.cylinder(
        HEAD.HELMET.RIM.TOP_RADIUS,
        HEAD.HELMET.RIM.BOTTOM_RADIUS,
        HEAD.HELMET.RIM.HEIGHT,
        HEAD.HELMET.RIM.SEGMENTS,
        materials.helmetRim,
        0,
        HEAD.HELMET.RIM.Y,
        HEAD.HELMET.RIM.Z,
        HEAD.HELMET.RIM.TILT
    );
    parts.box(
        HEAD.HELMET.BRIM.WIDTH,
        HEAD.HELMET.BRIM.HEIGHT,
        HEAD.HELMET.BRIM.DEPTH,
        materials.helmetRim,
        0,
        HEAD.HELMET.BRIM.Y,
        HEAD.HELMET.BRIM.Z,
        HEAD.HELMET.BRIM.TILT
    );
    parts.cylinder(
        HEAD.HELMET.STRAP.TOP_RADIUS,
        HEAD.HELMET.STRAP.BOTTOM_RADIUS,
        HEAD.HELMET.STRAP.HEIGHT,
        HEAD.HELMET.STRAP.SEGMENTS,
        materials.strap,
        0,
        HEAD.HELMET.STRAP.Y,
        0
    );
    parts.box(
        HEAD.HELMET.BATTERY.WIDTH,
        HEAD.HELMET.BATTERY.HEIGHT,
        HEAD.HELMET.BATTERY.DEPTH,
        materials.lampHousing,
        0,
        HEAD.HELMET.BATTERY.Y,
        HEAD.HELMET.BATTERY.Z
    );
    parts.box(
        HEAD.HELMET.CABLE.WIDTH,
        HEAD.HELMET.CABLE.HEIGHT,
        HEAD.HELMET.CABLE.DEPTH,
        materials.cord,
        HEAD.HELMET.CABLE.X,
        HEAD.HELMET.CABLE.Y,
        HEAD.HELMET.CABLE.Z
    );

    // Headlamp: a decorative unit only. It carries no light, like the reference.
    const lamp = new THREE.Group();
    lamp.name = 'player-headlamp';
    lamp.position.set(0, HEAD.LAMP.Y, HEAD.LAMP.Z);
    lamp.rotation.x = HEAD.LAMP.TILT;

    const lampParts = createPlayerPartCollector();
    lampParts.box(
        HEAD.LAMP.BRACKET.WIDTH,
        HEAD.LAMP.BRACKET.HEIGHT,
        HEAD.LAMP.BRACKET.DEPTH,
        materials.lampHousing,
        0,
        0,
        HEAD.LAMP.BRACKET.Z
    );
    lampParts.cylinder(
        HEAD.LAMP.HOUSING.TOP_RADIUS,
        HEAD.LAMP.HOUSING.BOTTOM_RADIUS,
        HEAD.LAMP.HOUSING.HEIGHT,
        HEAD.LAMP.HOUSING.SEGMENTS,
        materials.lampHousing,
        0,
        0,
        HEAD.LAMP.HOUSING.Z,
        Math.PI / 2
    );
    lampParts.cylinder(
        HEAD.LAMP.LENS.TOP_RADIUS,
        HEAD.LAMP.LENS.BOTTOM_RADIUS,
        HEAD.LAMP.LENS.HEIGHT,
        HEAD.LAMP.LENS.SEGMENTS,
        materials.lampLens,
        0,
        0,
        HEAD.LAMP.LENS.Z,
        Math.PI / 2
    );
    lamp.add(lampParts.build('player-headlamp-unit'));
    helmet.add(lamp);

    return helmet;
}

export function createPlayerHead(materials: PlayerMaterials): THREE.Group {
    const head = new THREE.Group();
    head.name = 'player-head';

    const parts = createPlayerPartCollector();

    parts.cylinder(
        HEAD.NECK.TOP_RADIUS,
        HEAD.NECK.BOTTOM_RADIUS,
        HEAD.NECK.HEIGHT,
        HEAD.NECK.SEGMENTS,
        materials.skinShadow,
        0,
        HEAD.NECK.Y,
        HEAD.NECK.Z
    );
    parts.sphere(
        HEAD.SKULL.RADIUS,
        HEAD.SKULL.WIDTH_SEGMENTS,
        HEAD.SKULL.HEIGHT_SEGMENTS,
        materials.skin,
        0,
        HEAD.SKULL.Y,
        HEAD.SKULL.Z,
        HEAD.SKULL.SX,
        HEAD.SKULL.SY,
        HEAD.SKULL.SZ
    );
    [-1, 1].forEach((side) => {
        parts.sphere(
            HEAD.CHEEK.RADIUS,
            HEAD.CHEEK.WIDTH_SEGMENTS,
            HEAD.CHEEK.HEIGHT_SEGMENTS,
            materials.skin,
            side * HEAD.CHEEK.X,
            HEAD.CHEEK.Y,
            HEAD.CHEEK.Z,
            HEAD.CHEEK.SX,
            HEAD.CHEEK.SY,
            HEAD.CHEEK.SZ
        );
        parts.cylinder(
            HEAD.BLUSH.RADIUS,
            HEAD.BLUSH.RADIUS,
            HEAD.BLUSH.HEIGHT,
            HEAD.BLUSH.SEGMENTS,
            materials.skinBlush,
            side * HEAD.BLUSH.X,
            HEAD.BLUSH.Y,
            HEAD.BLUSH.Z,
            Math.PI / 2,
            0,
            side * HEAD.BLUSH.ROLL
        );
    });
    parts.sphere(
        HEAD.CHIN.RADIUS,
        HEAD.CHIN.WIDTH_SEGMENTS,
        HEAD.CHIN.HEIGHT_SEGMENTS,
        materials.skin,
        0,
        HEAD.CHIN.Y,
        HEAD.CHIN.Z,
        HEAD.CHIN.SX,
        HEAD.CHIN.SY,
        HEAD.CHIN.SZ
    );
    parts.sphere(
        HEAD.NOSE.RADIUS,
        HEAD.NOSE.WIDTH_SEGMENTS,
        HEAD.NOSE.HEIGHT_SEGMENTS,
        materials.skin,
        0,
        HEAD.NOSE.Y,
        HEAD.NOSE.Z,
        HEAD.NOSE.SX,
        HEAD.NOSE.SY,
        HEAD.NOSE.SZ
    );
    parts.box(HEAD.MOUTH.WIDTH, HEAD.MOUTH.HEIGHT, HEAD.MOUTH.DEPTH, materials.skinShadow, 0, HEAD.MOUTH.Y, HEAD.MOUTH.Z);

    // Bangs peeking out of the hat, then the hat and its sheepskin earflaps.
    parts.cylinder(
        HEAD.BANGS.TOP_RADIUS,
        HEAD.BANGS.BOTTOM_RADIUS,
        HEAD.BANGS.HEIGHT,
        HEAD.BANGS.SEGMENTS,
        materials.hair,
        0,
        HEAD.BANGS.Y,
        HEAD.BANGS.Z,
        HEAD.BANGS.TILT
    );
    parts.cylinder(
        HEAD.HAT.TOP_RADIUS,
        HEAD.HAT.BOTTOM_RADIUS,
        HEAD.HAT.HEIGHT,
        HEAD.HAT.SEGMENTS,
        materials.hat,
        0,
        HEAD.HAT.Y,
        HEAD.HAT.Z
    );
    [-1, 1].forEach((side) => {
        parts.box(
            HEAD.HAT.EARFLAP.WIDTH,
            HEAD.HAT.EARFLAP.HEIGHT,
            HEAD.HAT.EARFLAP.DEPTH,
            materials.hat,
            side * HEAD.HAT.EARFLAP.X,
            HEAD.HAT.EARFLAP.Y,
            HEAD.HAT.EARFLAP.Z,
            0,
            -side * HEAD.HAT.EARFLAP.YAW,
            side * HEAD.HAT.EARFLAP.ROLL
        );
        parts.box(
            HEAD.HAT.EARFLAP_FUR.WIDTH,
            HEAD.HAT.EARFLAP_FUR.HEIGHT,
            HEAD.HAT.EARFLAP_FUR.DEPTH,
            materials.hatFur,
            side * HEAD.HAT.EARFLAP_FUR.X,
            HEAD.HAT.EARFLAP_FUR.Y,
            HEAD.HAT.EARFLAP_FUR.Z,
            0,
            -side * HEAD.HAT.EARFLAP_FUR.YAW,
            side * HEAD.HAT.EARFLAP_FUR.ROLL
        );
        parts.box(
            HEAD.CHINSTRAP.SIDE.WIDTH,
            HEAD.CHINSTRAP.SIDE.HEIGHT,
            HEAD.CHINSTRAP.SIDE.DEPTH,
            materials.strap,
            side * HEAD.CHINSTRAP.SIDE.X,
            HEAD.CHINSTRAP.SIDE.Y,
            HEAD.CHINSTRAP.SIDE.Z,
            HEAD.CHINSTRAP.SIDE.TILT,
            0,
            -side * HEAD.CHINSTRAP.SIDE.ROLL
        );
    });
    parts.box(
        HEAD.CHINSTRAP.BOTTOM.WIDTH,
        HEAD.CHINSTRAP.BOTTOM.HEIGHT,
        HEAD.CHINSTRAP.BOTTOM.DEPTH,
        materials.strap,
        0,
        HEAD.CHINSTRAP.BOTTOM.Y,
        HEAD.CHINSTRAP.BOTTOM.Z
    );

    head.add(parts.build('player-face'));
    head.add(buildEye(-1, materials), buildEye(1, materials));
    head.add(buildBraid(-1, materials), buildBraid(1, materials));
    head.add(buildHelmet(materials));

    return head;
}
