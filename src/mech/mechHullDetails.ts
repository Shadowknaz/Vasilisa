// Hull attachments of the «ВНИИТЭ-68»: the rear spine with its ribbed cooling
// fins, pneumatic accumulators and reserve fuel drum, plus the artisanal field
// repairs — a rebar slat screen and a stamped toolbox on the right flank,
// armoured cable routing on the left, and a channel-iron debris deflector with
// its headlight cage on the lower prow.
import type { MechMaterials } from './mechMaterials.js';
import { addRivetRow, box, cyl } from './mechGeometry.js';
import * as THREE from 'three';

const SPINE = {
    ORIGIN: { Y: 0.26, Z: -0.78 },
    BODY: { WIDTH: 0.86, HEIGHT: 1.2, DEPTH: 0.36 },
    FIN: { WIDTH: 0.96, HEIGHT: 0.035, DEPTH: 0.44, COUNT: 11, STEP: 0.095, Z: -0.04 },
    ACCUMULATOR: { RADIUS: 0.19, X: 0.25, Y: -0.72, Z: -0.06 },
    DRUM: { RADIUS: 0.16, HEIGHT: 0.88, SEGMENTS: 8, Y: 0.58, Z: -0.22 },
    DRUM_CAP: { RADIUS: 0.17, HEIGHT: 0.04, SEGMENTS: 8, X: 0.28 }
} as const;

const RIGHT_MODS = {
    ORIGIN: { X: 0.64, Y: 0.22, Z: 0.02 },
    PATCH: { WIDTH: 0.06, HEIGHT: 0.62, DEPTH: 0.74, X: 0.02, Y: 0.32, Z: 0.06, TILT: 0.04 },
    PATCH_RIVETS: { COUNT: 5, X: 0.06, Y: [0.58, 0.06], Z: -0.24, STEP_Z: 0.15 },
    TOOLBOX: { WIDTH: 0.16, HEIGHT: 0.26, DEPTH: 0.44, X: 0.07, Y: -0.22, Z: 0.32 },
    TOOLBOX_LID: { WIDTH: 0.17, HEIGHT: 0.04, DEPTH: 0.46, X: 0.07, Y: -0.1, Z: 0.32 },
    HOSE: [
        { RADIUS: 0.028, HEIGHT: 1.18, SEGMENTS: 5, X: 0.06, Y: 0.1, Z: -0.44, TILT: 0.18 },
        { RADIUS: 0.02, HEIGHT: 1.12, SEGMENTS: 5, X: 0.09, Y: 0.1, Z: -0.36, TILT: 0.18 }
    ],
    // Anti-shaped-charge rebar slat screen (решётчатый экран)
    SLATS: {
        BAR: 0.026,
        X: 0.18,
        Z: -0.02,
        LENGTH: 1.24,
        Y_START: -0.32,
        Y_END: 0.2,
        Y_STEP: 0.13,
        POST_HEIGHT: 0.6,
        POST_Y: -0.06,
        POST_START: -0.54,
        POST_END: 0.56,
        POST_STEP: 0.36,
        BRACE: { WIDTH: 0.18, LENGTH: 0.026, X: 0.09, Y: [0.18, -0.3] }
    }
} as const;

const LEFT_DETAILS = {
    ORIGIN: { X: -0.62, Y: 0.22, Z: 0.02 },
    JUNCTION: { WIDTH: 0.08, HEIGHT: 0.24, DEPTH: 0.2, X: -0.03, Y: 0.08, Z: -0.52 },
    CABLE: [
        { RADIUS: 0.026, HEIGHT: 0.88, SEGMENTS: 5, X: -0.05, Y: 0.14, Z: -0.48, TILT: 0.12 },
        { RADIUS: 0.022, HEIGHT: 0.76, SEGMENTS: 5, X: -0.05, Y: 0.24, Z: 0.54, TILT: -0.15 }
    ]
} as const;

const FRONT_GUARD = {
    ORIGIN: { Y: -0.36, Z: 0.74 },
    BLADE: { WIDTH: 1.24, HEIGHT: 0.18, DEPTH: 0.09, Z: 0.14, TILT: 0.22 },
    POST: { WIDTH: 0.07, HEIGHT: 0.3, DEPTH: 0.26, X: 0.44, Y: 0.06 },
    RIVETS: { COUNT: 7, Y: 0.02, Z: 0.19, STEP_X: 0.16, START_X: -0.48 }
} as const;

function count(start: number, end: number, step: number): number {
    return Math.round((end - start) / step) + 1;
}

export function createSpine(materials: MechMaterials): THREE.Group {
    const spine = new THREE.Group();
    spine.position.set(0, SPINE.ORIGIN.Y, SPINE.ORIGIN.Z);

    spine.add(box(SPINE.BODY.WIDTH, SPINE.BODY.HEIGHT, SPINE.BODY.DEPTH, materials.castIron));
    const finCount = SPINE.FIN.COUNT;
    for (let fin = 0; fin < finCount; fin++) {
        const y = (fin - (finCount - 1) / 2) * SPINE.FIN.STEP;
        spine.add(box(SPINE.FIN.WIDTH, SPINE.FIN.HEIGHT, SPINE.FIN.DEPTH, materials.piston, 0, y, SPINE.FIN.Z));
    }

    // Twin spherical high-pressure pneumatic accumulators
    const accumulatorLeft = new THREE.Mesh(new THREE.IcosahedronGeometry(SPINE.ACCUMULATOR.RADIUS, 0), materials.enamel);
    accumulatorLeft.position.set(-SPINE.ACCUMULATOR.X, SPINE.ACCUMULATOR.Y, SPINE.ACCUMULATOR.Z);
    spine.add(accumulatorLeft);
    const accumulatorRight = new THREE.Mesh(new THREE.IcosahedronGeometry(SPINE.ACCUMULATOR.RADIUS, 0), materials.hullMid);
    accumulatorRight.position.set(SPINE.ACCUMULATOR.X, SPINE.ACCUMULATOR.Y, SPINE.ACCUMULATOR.Z);
    spine.add(accumulatorRight);

    // Reserve fuel drum strapped across the spine
    spine.add(cyl(
        SPINE.DRUM.RADIUS,
        SPINE.DRUM.RADIUS,
        SPINE.DRUM.HEIGHT,
        SPINE.DRUM.SEGMENTS,
        materials.hullLight,
        0,
        SPINE.DRUM.Y,
        SPINE.DRUM.Z,
        0,
        0,
        Math.PI / 2
    ));
    [-1, 1].forEach((side) => {
        spine.add(cyl(
            SPINE.DRUM_CAP.RADIUS,
            SPINE.DRUM_CAP.RADIUS,
            SPINE.DRUM_CAP.HEIGHT,
            SPINE.DRUM_CAP.SEGMENTS,
            materials.steel,
            side * SPINE.DRUM_CAP.X,
            SPINE.DRUM.Y,
            SPINE.DRUM.Z,
            0,
            0,
            Math.PI / 2
        ));
    });

    return spine;
}

export function createFieldRepairs(materials: MechMaterials): { right: THREE.Group; left: THREE.Group; guard: THREE.Group } {
    // Right flank: corrugated patch, ZIP toolbox, high-pressure hoses and slat screen
    const right = new THREE.Group();
    right.position.set(RIGHT_MODS.ORIGIN.X, RIGHT_MODS.ORIGIN.Y, RIGHT_MODS.ORIGIN.Z);
    right.add(box(
        RIGHT_MODS.PATCH.WIDTH,
        RIGHT_MODS.PATCH.HEIGHT,
        RIGHT_MODS.PATCH.DEPTH,
        materials.patch,
        RIGHT_MODS.PATCH.X,
        RIGHT_MODS.PATCH.Y,
        RIGHT_MODS.PATCH.Z,
        0,
        0,
        RIGHT_MODS.PATCH.TILT
    ));
    RIGHT_MODS.PATCH_RIVETS.Y.forEach((y) => {
        addRivetRow(
            right,
            materials.rivet,
            RIGHT_MODS.PATCH_RIVETS.COUNT,
            { x: RIGHT_MODS.PATCH_RIVETS.X, y, z: RIGHT_MODS.PATCH_RIVETS.Z },
            { x: 0, y: 0, z: RIGHT_MODS.PATCH_RIVETS.STEP_Z }
        );
    });
    right.add(box(
        RIGHT_MODS.TOOLBOX.WIDTH,
        RIGHT_MODS.TOOLBOX.HEIGHT,
        RIGHT_MODS.TOOLBOX.DEPTH,
        materials.hullDark,
        RIGHT_MODS.TOOLBOX.X,
        RIGHT_MODS.TOOLBOX.Y,
        RIGHT_MODS.TOOLBOX.Z
    ));
    right.add(box(
        RIGHT_MODS.TOOLBOX_LID.WIDTH,
        RIGHT_MODS.TOOLBOX_LID.HEIGHT,
        RIGHT_MODS.TOOLBOX_LID.DEPTH,
        materials.enamel,
        RIGHT_MODS.TOOLBOX_LID.X,
        RIGHT_MODS.TOOLBOX_LID.Y,
        RIGHT_MODS.TOOLBOX_LID.Z
    ));
    RIGHT_MODS.HOSE.forEach((hose) => {
        right.add(cyl(hose.RADIUS, hose.RADIUS, hose.HEIGHT, hose.SEGMENTS, materials.steel, hose.X, hose.Y, hose.Z, hose.TILT));
    });

    const slats = RIGHT_MODS.SLATS;
    const slatCount = count(slats.Y_START, slats.Y_END, slats.Y_STEP);
    for (let slat = 0; slat < slatCount; slat++) {
        right.add(box(slats.BAR, slats.BAR, slats.LENGTH, materials.steel, slats.X, slats.Y_START + slat * slats.Y_STEP, slats.Z));
    }
    const postCount = count(slats.POST_START, slats.POST_END, slats.POST_STEP);
    for (let post = 0; post < postCount; post++) {
        const z = slats.POST_START + post * slats.POST_STEP;
        right.add(box(slats.BAR, slats.POST_HEIGHT, slats.BAR, materials.steel, slats.X, slats.POST_Y, z));
        slats.BRACE.Y.forEach((y) => {
            right.add(box(slats.BRACE.WIDTH, slats.BRACE.LENGTH, slats.BRACE.LENGTH, materials.steel, slats.BRACE.X, y, z));
        });
    }

    // Left flank: junction box and armoured cable routing framing the door
    const left = new THREE.Group();
    left.position.set(LEFT_DETAILS.ORIGIN.X, LEFT_DETAILS.ORIGIN.Y, LEFT_DETAILS.ORIGIN.Z);
    left.add(box(
        LEFT_DETAILS.JUNCTION.WIDTH,
        LEFT_DETAILS.JUNCTION.HEIGHT,
        LEFT_DETAILS.JUNCTION.DEPTH,
        materials.castIron,
        LEFT_DETAILS.JUNCTION.X,
        LEFT_DETAILS.JUNCTION.Y,
        LEFT_DETAILS.JUNCTION.Z
    ));
    LEFT_DETAILS.CABLE.forEach((cable) => {
        left.add(cyl(cable.RADIUS, cable.RADIUS, cable.HEIGHT, cable.SEGMENTS, materials.piston, cable.X, cable.Y, cable.Z, cable.TILT));
    });

    // Lower prow: reinforced channel-iron debris deflector
    const guard = new THREE.Group();
    guard.position.set(0, FRONT_GUARD.ORIGIN.Y, FRONT_GUARD.ORIGIN.Z);
    guard.add(box(
        FRONT_GUARD.BLADE.WIDTH,
        FRONT_GUARD.BLADE.HEIGHT,
        FRONT_GUARD.BLADE.DEPTH,
        materials.patch,
        0,
        0,
        FRONT_GUARD.BLADE.Z,
        FRONT_GUARD.BLADE.TILT
    ));
    [-1, 1].forEach((side) => {
        guard.add(box(
            FRONT_GUARD.POST.WIDTH,
            FRONT_GUARD.POST.HEIGHT,
            FRONT_GUARD.POST.DEPTH,
            materials.steel,
            side * FRONT_GUARD.POST.X,
            FRONT_GUARD.POST.Y,
            0
        ));
    });
    addRivetRow(
        guard,
        materials.rivet,
        FRONT_GUARD.RIVETS.COUNT,
        { x: FRONT_GUARD.RIVETS.START_X, y: FRONT_GUARD.RIVETS.Y, z: FRONT_GUARD.RIVETS.Z },
        { x: FRONT_GUARD.RIVETS.STEP_X, y: 0, z: 0 }
    );

    return { right, left, guard };
}
