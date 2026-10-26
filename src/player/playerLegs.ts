// Lower body of the heroine: quilted trousers tucked into felt boots with cloth
// wraps and a strap around each ankle. The reference leg is one rigid group that
// rotates at the ground; here it is split at the boot top into a hip and a knee
// pivot, so the first-person camera can read a real stride under the coat hem.
//
// All dimensions are metres in the model frame: feet on y = 0, front along +Z.
import type { PlayerMaterials } from './playerMaterials.js';
import { createPlayerPartCollector } from './playerParts.js';
import * as THREE from 'three';

const LEG = {
    // Hip joint height and lateral offset. The right leg stands slightly behind
    // and both are turned out, as in the reference stance.
    HIP_Y: 0.64,
    HIP_X: 0.125,
    RIGHT_Z: -0.025,
    LEFT_YAW: 0.05,
    RIGHT_YAW: -0.07,
    // Top of the felt boot shaft: the knee folds just under the coat hem (0.4 m),
    // which hides the joint itself.
    KNEE_Y: 0.38,
    THIGH: { TOP_RADIUS: 0.082, BOTTOM_RADIUS: 0.072, HEIGHT: 0.32, SEGMENTS: 7, CENTER_Y: 0.48 },
    SOLE: { WIDTH: 0.145, HEIGHT: 0.055, DEPTH: 0.28, Y: 0.028, Z: 0.035 },
    BOOT: { WIDTH: 0.138, HEIGHT: 0.085, DEPTH: 0.25, Y: 0.09, Z: 0.03 },
    SHAFT: { TOP_RADIUS: 0.072, BOTTOM_RADIUS: 0.068, HEIGHT: 0.28, SEGMENTS: 7, Y: 0.24 },
    WRAP: { RADIUS: 0.076, HEIGHT: 0.06, SEGMENTS: 7, LOWER_Y: 0.22, UPPER_Y: 0.3 },
    STRAP: { WIDTH: 0.15, HEIGHT: 0.03, DEPTH: 0.16, Y: 0.15, Z: 0.01 }
} as const;

interface PlayerLegs {
    group: THREE.Group;
    // [left, right] in model space (-X is her left side, front +Z).
    hips: [THREE.Group, THREE.Group];
    knees: [THREE.Group, THREE.Group];
}

function buildLeg(side: -1 | 1, materials: PlayerMaterials): { hip: THREE.Group; knee: THREE.Group } {
    const hip = new THREE.Group();
    hip.name = side < 0 ? 'player-hip-left' : 'player-hip-right';
    hip.position.set(side * LEG.HIP_X, LEG.HIP_Y, side > 0 ? LEG.RIGHT_Z : 0);
    hip.rotation.y = side < 0 ? LEG.LEFT_YAW : LEG.RIGHT_YAW;

    const thigh = createPlayerPartCollector();
    thigh.cylinder(
        LEG.THIGH.TOP_RADIUS,
        LEG.THIGH.BOTTOM_RADIUS,
        LEG.THIGH.HEIGHT,
        LEG.THIGH.SEGMENTS,
        materials.pants,
        0,
        LEG.THIGH.CENTER_Y - LEG.HIP_Y,
        0
    );
    hip.add(thigh.build(side < 0 ? 'player-thigh-left' : 'player-thigh-right'));

    const knee = new THREE.Group();
    knee.name = side < 0 ? 'player-knee-left' : 'player-knee-right';
    knee.position.set(0, LEG.KNEE_Y - LEG.HIP_Y, 0);
    hip.add(knee);

    // Everything below the boot top lives in the knee group; the pivot sits at the
    // shaft opening, so the trousers stay with the thigh and only the boot swings.
    const shin = createPlayerPartCollector();
    const drop = LEG.KNEE_Y;

    shin.box(LEG.SOLE.WIDTH, LEG.SOLE.HEIGHT, LEG.SOLE.DEPTH, materials.bootSole, 0, LEG.SOLE.Y - drop, LEG.SOLE.Z);
    shin.box(LEG.BOOT.WIDTH, LEG.BOOT.HEIGHT, LEG.BOOT.DEPTH, materials.feltBoots, 0, LEG.BOOT.Y - drop, LEG.BOOT.Z);
    shin.cylinder(
        LEG.SHAFT.TOP_RADIUS,
        LEG.SHAFT.BOTTOM_RADIUS,
        LEG.SHAFT.HEIGHT,
        LEG.SHAFT.SEGMENTS,
        materials.feltBoots,
        0,
        LEG.SHAFT.Y - drop,
        0
    );
    shin.cylinder(
        LEG.WRAP.RADIUS,
        LEG.WRAP.RADIUS - 0.002,
        LEG.WRAP.HEIGHT,
        LEG.WRAP.SEGMENTS,
        materials.legWraps,
        0,
        LEG.WRAP.LOWER_Y - drop,
        0,
        0.05,
        0,
        side * 0.04
    );
    shin.cylinder(
        LEG.WRAP.RADIUS + 0.002,
        LEG.WRAP.RADIUS + 0.001,
        LEG.WRAP.HEIGHT,
        LEG.WRAP.SEGMENTS,
        materials.legWraps,
        0,
        LEG.WRAP.UPPER_Y - drop,
        0,
        -0.04,
        0,
        -side * 0.04
    );
    shin.box(LEG.STRAP.WIDTH, LEG.STRAP.HEIGHT, LEG.STRAP.DEPTH, materials.strap, 0, LEG.STRAP.Y - drop, LEG.STRAP.Z);
    knee.add(shin.build(side < 0 ? 'player-shin-left' : 'player-shin-right'));

    return { hip, knee };
}

export function createPlayerLegs(materials: PlayerMaterials): PlayerLegs {
    const group = new THREE.Group();
    group.name = 'player-legs';

    const left = buildLeg(-1, materials);
    const right = buildLeg(1, materials);
    group.add(left.hip, right.hip);

    return {
        group,
        hips: [left.hip, right.hip],
        knees: [left.knee, right.knee]
    };
}
