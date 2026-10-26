// One heavy articulated quadruped leg of the «ВНИИТЭ-68» walker, ported from the
// reference mexa.html: hip trunnion with dust-boot drums, box-girder thigh with
// twin hydraulic rams, oversized knee drum with a reinforced shin, and a broad
// multi-toed pad. The legs mount to the walker root, never to the bobbing hull,
// so a planted foot stays planted while the hull rides on its struts.
import type { MechMaterials } from './mechMaterials.js';
import { addRivetRow, box, cyl } from './mechGeometry.js';
import * as THREE from 'three';

const LEG = {
    ROOT: { X: 0.55, Y: 1.805, Z: 0.6 },
    // Splay of each leg toward its own corner, in the horizontal plane.
    BASE_YAW: 0.2,
    HIP: {
        DRUM: { TOP_RADIUS: 0.21, BOTTOM_RADIUS: 0.22, HEIGHT: 0.09, SEGMENTS: 8 },
        DRUM_COUNT: 3,
        DRUM_TAPER: 0.014,
        DRUM_X_START: 0.04,
        DRUM_X_STEP: 0.065,
        HOUSING: { WIDTH: 0.3, HEIGHT: 0.34, DEPTH: 0.36, X: 0.16, Y: 0.04 },
        FLANGE: { WIDTH: 0.24, HEIGHT: 0.06, DEPTH: 0.3, X: 0.16, Y: 0.22 }
    },
    THIGH: {
        PIVOT_X: 0.2,
        BEAM: { WIDTH: 0.5, HEIGHT: 0.28, DEPTH: 0.3, X: 0.21, Y: 0.08, TILT: 0.2 },
        GUSSET: { WIDTH: 0.42, HEIGHT: 0.18, DEPTH: 0.34, X: 0.2, Y: 0.04 },
        RIVET: { COUNT: 4, X: 0.08, Y: 0.14, Z: 0.16, STEP_X: 0.09, STEP_Y: 0.02 },
        RAM: {
            BARREL: { RADIUS: 0.052, LENGTH: 0.4, SEGMENTS: 6, X: 0.16, Y: 0.27, TILT: 0.18 },
            ROD: { RADIUS: 0.034, LENGTH: 0.36, SEGMENTS: 6, X: 0.31, Y: 0.29, TILT: 0.18 },
            OFFSETS: [-0.08, 0.08]
        }
    },
    KNEE: {
        PIVOT_X: 0.42,
        PIVOT_Y: 0.14,
        DRUM: { RADIUS: 0.2, LENGTH: 0.36, SEGMENTS: 8 },
        CAP: { RADIUS: 0.13, LENGTH: 0.4, SEGMENTS: 8 },
        AXLE: { RADIUS: 0.06, LENGTH: 0.43, SEGMENTS: 6 },
        BUMPER: { WIDTH: 0.1, HEIGHT: 0.3, DEPTH: 0.32, X: 0.18, Y: 0.04, TILT: 0.15 },
        SHIN: { TOP_RADIUS: 0.17, BOTTOM_RADIUS: 0.125, HEIGHT: 1.66, SEGMENTS: 8, X: 0.02, Y: -0.88 },
        SHIN_CORE: { WIDTH: 0.24, HEIGHT: 1.38, DEPTH: 0.26, X: 0.03, Y: -0.84 },
        PISTON: {
            BARREL: { RADIUS: 0.055, LENGTH: 0.96, SEGMENTS: 6, X: -0.11, Y: -0.52 },
            ROD: { RADIUS: 0.036, LENGTH: 0.9, SEGMENTS: 6, X: -0.11, Y: -1.16 },
            OFFSETS: [-0.09, 0.09]
        },
        COLLAR: { WIDTH: 0.32, HEIGHT: 0.08, DEPTH: 0.3, X: -0.02, LOWER_WIDTH: 0.3, DEPTH_LOWER: 0.28 },
        COLLAR_Y: [-0.42, -1.04],
        ARMOR: { WIDTH: 0.08, HEIGHT: 1.12, DEPTH: 0.34, X: 0.15, Y: -0.72 },
        SKIRT: { WIDTH: 0.06, HEIGHT: 0.44, DEPTH: 0.38, X: 0.18, Y: -1.3, TILT: 0.08 },
        RIVET: { COUNT: 7, X: 0.2, Y: -0.24, Z: 0.12, STEP_Y: -0.15 },
        GUARD: { BAR: 0.032, HEIGHT: 0.64, DEPTH: 0.31, X: 0.23, Y: -1.18, Z: 0.14, CROSS_Y: [-0.88, -1.18, -1.48] }
    },
    FOOT: {
        PIVOT_X: 0.02,
        PIVOT_Y: -1.74,
        ANKLE: { TOP_RADIUS: 0.14, BOTTOM_RADIUS: 0.18, HEIGHT: 0.16, SEGMENTS: 8, Y: -0.04 },
        ANKLE_PLATE: { WIDTH: 0.32, HEIGHT: 0.08, DEPTH: 0.34, Y: -0.09 },
        PAD: { TOP_RADIUS: 0.28, BOTTOM_RADIUS: 0.33, HEIGHT: 0.11, SEGMENTS: 8, Y: -0.15, Z: 0.01 },
        CLAW: { WIDTH: 0.1, HEIGHT: 0.08, DEPTH: 0.18, X: 0.11, Y: -0.16, Z: 0.26, TILT: 0.28, YAW: 0.12 },
        SPADE: { WIDTH: 0.12, HEIGHT: 0.08, DEPTH: 0.16, X: 0.08, Y: -0.16, Z: -0.24, TILT: -0.28, YAW: 0.1 }
    }
} as const;

export interface QuadLeg {
    // Mount of the whole leg on the walker root; carries the corner splay.
    legRoot: THREE.Group;
    // Horizontal stride joint.
    hipYaw: THREE.Group;
    // Frontal-plane fold: thigh swings out, knee folds back under the drum.
    thighPivot: THREE.Group;
    kneePivot: THREE.Group;
    // Counter-rotated by the pose animator so the pad stays level with the ground.
    footPivot: THREE.Group;
    sideX: number;
    endZ: number;
    baseYaw: number;
}

export interface QuadLegs {
    fl: QuadLeg;
    fr: QuadLeg;
    rl: QuadLeg;
    rr: QuadLeg;
}

function createQuadMechLeg(materials: MechMaterials, side: number, frontBack: number, legIndex: number): QuadLeg {
    const legRoot = new THREE.Group();
    legRoot.position.set(side * LEG.ROOT.X, LEG.ROOT.Y, frontBack * LEG.ROOT.Z);

    // 1. Hip swivel trunnion with three corrugated dust-boot drums
    const hipYaw = new THREE.Group();
    legRoot.add(hipYaw);

    for (let boot = 0; boot < LEG.HIP.DRUM_COUNT; boot++) {
        hipYaw.add(cyl(
            LEG.HIP.DRUM.TOP_RADIUS - boot * LEG.HIP.DRUM_TAPER,
            LEG.HIP.DRUM.BOTTOM_RADIUS - boot * LEG.HIP.DRUM_TAPER,
            LEG.HIP.DRUM.HEIGHT,
            LEG.HIP.DRUM.SEGMENTS,
            materials.steel,
            side * (LEG.HIP.DRUM_X_START + boot * LEG.HIP.DRUM_X_STEP),
            0,
            0,
            0,
            0,
            Math.PI / 2
        ));
    }
    hipYaw.add(box(
        LEG.HIP.HOUSING.WIDTH,
        LEG.HIP.HOUSING.HEIGHT,
        LEG.HIP.HOUSING.DEPTH,
        materials.hullDark,
        side * LEG.HIP.HOUSING.X,
        LEG.HIP.HOUSING.Y,
        0
    ));
    hipYaw.add(box(
        LEG.HIP.FLANGE.WIDTH,
        LEG.HIP.FLANGE.HEIGHT,
        LEG.HIP.FLANGE.DEPTH,
        materials.enamel,
        side * LEG.HIP.FLANGE.X,
        LEG.HIP.FLANGE.Y,
        0
    ));

    // 2. Box-girder thigh with twin parallel hydraulic rams
    const thighPivot = new THREE.Group();
    thighPivot.position.set(side * LEG.THIGH.PIVOT_X, 0, 0);
    hipYaw.add(thighPivot);

    thighPivot.add(box(
        LEG.THIGH.BEAM.WIDTH,
        LEG.THIGH.BEAM.HEIGHT,
        LEG.THIGH.BEAM.DEPTH,
        materials.hullMid,
        side * LEG.THIGH.BEAM.X,
        LEG.THIGH.BEAM.Y,
        0,
        0,
        0,
        side * LEG.THIGH.BEAM.TILT
    ));
    thighPivot.add(box(
        LEG.THIGH.GUSSET.WIDTH,
        LEG.THIGH.GUSSET.HEIGHT,
        LEG.THIGH.GUSSET.DEPTH,
        materials.castIron,
        side * LEG.THIGH.GUSSET.X,
        LEG.THIGH.GUSSET.Y,
        0,
        0,
        0,
        side * LEG.THIGH.BEAM.TILT
    ));
    addRivetRow(
        thighPivot,
        materials.rivet,
        LEG.THIGH.RIVET.COUNT,
        { x: side * LEG.THIGH.RIVET.X, y: LEG.THIGH.RIVET.Y, z: LEG.THIGH.RIVET.Z },
        { x: side * LEG.THIGH.RIVET.STEP_X, y: LEG.THIGH.RIVET.STEP_Y, z: 0 }
    );
    addRivetRow(
        thighPivot,
        materials.rivet,
        LEG.THIGH.RIVET.COUNT,
        { x: side * LEG.THIGH.RIVET.X, y: LEG.THIGH.RIVET.Y, z: -LEG.THIGH.RIVET.Z },
        { x: side * LEG.THIGH.RIVET.STEP_X, y: LEG.THIGH.RIVET.STEP_Y, z: 0 }
    );

    LEG.THIGH.RAM.OFFSETS.forEach((zOffset) => {
        thighPivot.add(cyl(
            LEG.THIGH.RAM.BARREL.RADIUS,
            LEG.THIGH.RAM.BARREL.RADIUS,
            LEG.THIGH.RAM.BARREL.LENGTH,
            LEG.THIGH.RAM.BARREL.SEGMENTS,
            materials.steel,
            side * LEG.THIGH.RAM.BARREL.X,
            LEG.THIGH.RAM.BARREL.Y,
            zOffset,
            0,
            0,
            Math.PI / 2 + side * LEG.THIGH.RAM.BARREL.TILT
        ));
        thighPivot.add(cyl(
            LEG.THIGH.RAM.ROD.RADIUS,
            LEG.THIGH.RAM.ROD.RADIUS,
            LEG.THIGH.RAM.ROD.LENGTH,
            LEG.THIGH.RAM.ROD.SEGMENTS,
            materials.piston,
            side * LEG.THIGH.RAM.ROD.X,
            LEG.THIGH.RAM.ROD.Y,
            zOffset,
            0,
            0,
            Math.PI / 2 + side * LEG.THIGH.RAM.ROD.TILT
        ));
    });

    // 3. Oversized knee drum and the reinforced shin column
    const kneePivot = new THREE.Group();
    kneePivot.position.set(side * LEG.KNEE.PIVOT_X, LEG.KNEE.PIVOT_Y, 0);
    thighPivot.add(kneePivot);

    kneePivot.add(cyl(
        LEG.KNEE.DRUM.RADIUS,
        LEG.KNEE.DRUM.RADIUS,
        LEG.KNEE.DRUM.LENGTH,
        LEG.KNEE.DRUM.SEGMENTS,
        materials.steel,
        0,
        0,
        0,
        Math.PI / 2
    ));
    kneePivot.add(cyl(
        LEG.KNEE.CAP.RADIUS,
        LEG.KNEE.CAP.RADIUS,
        LEG.KNEE.CAP.LENGTH,
        LEG.KNEE.CAP.SEGMENTS,
        materials.enamel,
        0,
        0,
        0,
        Math.PI / 2
    ));
    kneePivot.add(cyl(
        LEG.KNEE.AXLE.RADIUS,
        LEG.KNEE.AXLE.RADIUS,
        LEG.KNEE.AXLE.LENGTH,
        LEG.KNEE.AXLE.SEGMENTS,
        materials.castIron,
        0,
        0,
        0,
        Math.PI / 2
    ));
    kneePivot.add(box(
        LEG.KNEE.BUMPER.WIDTH,
        LEG.KNEE.BUMPER.HEIGHT,
        LEG.KNEE.BUMPER.DEPTH,
        materials.hullLight,
        side * LEG.KNEE.BUMPER.X,
        LEG.KNEE.BUMPER.Y,
        0,
        0,
        0,
        -side * LEG.KNEE.BUMPER.TILT
    ));

    kneePivot.add(cyl(
        LEG.KNEE.SHIN.TOP_RADIUS,
        LEG.KNEE.SHIN.BOTTOM_RADIUS,
        LEG.KNEE.SHIN.HEIGHT,
        LEG.KNEE.SHIN.SEGMENTS,
        materials.hullDark,
        side * LEG.KNEE.SHIN.X,
        LEG.KNEE.SHIN.Y,
        0
    ));
    kneePivot.add(box(
        LEG.KNEE.SHIN_CORE.WIDTH,
        LEG.KNEE.SHIN_CORE.HEIGHT,
        LEG.KNEE.SHIN_CORE.DEPTH,
        materials.castIron,
        side * LEG.KNEE.SHIN_CORE.X,
        LEG.KNEE.SHIN_CORE.Y,
        0
    ));

    LEG.KNEE.PISTON.OFFSETS.forEach((zOffset) => {
        kneePivot.add(cyl(
            LEG.KNEE.PISTON.BARREL.RADIUS,
            LEG.KNEE.PISTON.BARREL.RADIUS,
            LEG.KNEE.PISTON.BARREL.LENGTH,
            LEG.KNEE.PISTON.BARREL.SEGMENTS,
            materials.steel,
            -side * LEG.KNEE.PISTON.BARREL.X,
            LEG.KNEE.PISTON.BARREL.Y,
            zOffset
        ));
        kneePivot.add(cyl(
            LEG.KNEE.PISTON.ROD.RADIUS,
            LEG.KNEE.PISTON.ROD.RADIUS,
            LEG.KNEE.PISTON.ROD.LENGTH,
            LEG.KNEE.PISTON.ROD.SEGMENTS,
            materials.piston,
            -side * LEG.KNEE.PISTON.ROD.X,
            LEG.KNEE.PISTON.ROD.Y,
            zOffset
        ));
    });
    LEG.KNEE.COLLAR_Y.forEach((y, index) => {
        const width = index === 0 ? LEG.KNEE.COLLAR.WIDTH : LEG.KNEE.COLLAR.LOWER_WIDTH;
        const depth = index === 0 ? LEG.KNEE.COLLAR.DEPTH : LEG.KNEE.COLLAR.DEPTH_LOWER;
        kneePivot.add(box(width, LEG.KNEE.COLLAR.HEIGHT, depth, materials.steel, -side * LEG.KNEE.COLLAR.X, y, 0));
    });

    // Alternating shin plating: patch metal on two legs, aero plate on the others.
    const armorMaterial = legIndex % 2 === 0 ? materials.patch : materials.hullLight;
    kneePivot.add(box(
        LEG.KNEE.ARMOR.WIDTH,
        LEG.KNEE.ARMOR.HEIGHT,
        LEG.KNEE.ARMOR.DEPTH,
        armorMaterial,
        side * LEG.KNEE.ARMOR.X,
        LEG.KNEE.ARMOR.Y,
        0
    ));
    kneePivot.add(box(
        LEG.KNEE.SKIRT.WIDTH,
        LEG.KNEE.SKIRT.HEIGHT,
        LEG.KNEE.SKIRT.DEPTH,
        materials.hullMid,
        side * LEG.KNEE.SKIRT.X,
        LEG.KNEE.SKIRT.Y,
        0,
        0,
        0,
        -side * LEG.KNEE.SKIRT.TILT
    ));
    addRivetRow(
        kneePivot,
        materials.rivet,
        LEG.KNEE.RIVET.COUNT,
        { x: side * LEG.KNEE.RIVET.X, y: LEG.KNEE.RIVET.Y, z: LEG.KNEE.RIVET.Z },
        { x: 0, y: LEG.KNEE.RIVET.STEP_Y, z: 0 }
    );
    addRivetRow(
        kneePivot,
        materials.rivet,
        LEG.KNEE.RIVET.COUNT,
        { x: side * LEG.KNEE.RIVET.X, y: LEG.KNEE.RIVET.Y, z: -LEG.KNEE.RIVET.Z },
        { x: 0, y: LEG.KNEE.RIVET.STEP_Y, z: 0 }
    );

    // Welded rebar brush guard on the outer shin
    kneePivot.add(box(LEG.KNEE.GUARD.BAR, LEG.KNEE.GUARD.HEIGHT, LEG.KNEE.GUARD.BAR, materials.steel, side * LEG.KNEE.GUARD.X, LEG.KNEE.GUARD.Y, LEG.KNEE.GUARD.Z));
    kneePivot.add(box(LEG.KNEE.GUARD.BAR, LEG.KNEE.GUARD.HEIGHT, LEG.KNEE.GUARD.BAR, materials.steel, side * LEG.KNEE.GUARD.X, LEG.KNEE.GUARD.Y, -LEG.KNEE.GUARD.Z));
    LEG.KNEE.GUARD.CROSS_Y.forEach((y) => {
        kneePivot.add(box(LEG.KNEE.GUARD.BAR, LEG.KNEE.GUARD.BAR, LEG.KNEE.GUARD.DEPTH, materials.steel, side * LEG.KNEE.GUARD.X, y, 0));
    });

    // 4. Broad multi-toed industrial pad
    const footPivot = new THREE.Group();
    footPivot.position.set(side * LEG.FOOT.PIVOT_X, LEG.FOOT.PIVOT_Y, 0);
    kneePivot.add(footPivot);

    footPivot.add(cyl(
        LEG.FOOT.ANKLE.TOP_RADIUS,
        LEG.FOOT.ANKLE.BOTTOM_RADIUS,
        LEG.FOOT.ANKLE.HEIGHT,
        LEG.FOOT.ANKLE.SEGMENTS,
        materials.steel,
        0,
        LEG.FOOT.ANKLE.Y,
        0
    ));
    footPivot.add(box(
        LEG.FOOT.ANKLE_PLATE.WIDTH,
        LEG.FOOT.ANKLE_PLATE.HEIGHT,
        LEG.FOOT.ANKLE_PLATE.DEPTH,
        materials.hullDark,
        0,
        LEG.FOOT.ANKLE_PLATE.Y,
        0
    ));
    footPivot.add(cyl(
        LEG.FOOT.PAD.TOP_RADIUS,
        LEG.FOOT.PAD.BOTTOM_RADIUS,
        LEG.FOOT.PAD.HEIGHT,
        LEG.FOOT.PAD.SEGMENTS,
        materials.castIron,
        0,
        LEG.FOOT.PAD.Y,
        LEG.FOOT.PAD.Z
    ));

    for (let claw = -1; claw <= 1; claw++) {
        footPivot.add(box(
            LEG.FOOT.CLAW.WIDTH,
            LEG.FOOT.CLAW.HEIGHT,
            LEG.FOOT.CLAW.DEPTH,
            materials.hullMid,
            claw * LEG.FOOT.CLAW.X,
            LEG.FOOT.CLAW.Y,
            LEG.FOOT.CLAW.Z,
            LEG.FOOT.CLAW.TILT,
            -claw * LEG.FOOT.CLAW.YAW,
            0
        ));
    }
    [-1, 1].forEach((sweep) => {
        footPivot.add(box(
            LEG.FOOT.SPADE.WIDTH,
            LEG.FOOT.SPADE.HEIGHT,
            LEG.FOOT.SPADE.DEPTH,
            materials.hullMid,
            sweep * LEG.FOOT.SPADE.X,
            LEG.FOOT.SPADE.Y,
            LEG.FOOT.SPADE.Z,
            LEG.FOOT.SPADE.TILT,
            sweep * LEG.FOOT.SPADE.YAW,
            0
        ));
    });

    return {
        legRoot,
        hipYaw,
        thighPivot,
        kneePivot,
        footPivot,
        sideX: side,
        endZ: frontBack,
        baseYaw: side * frontBack * -LEG.BASE_YAW
    };
}

export function createQuadLegs(materials: MechMaterials): QuadLegs {
    return {
        fl: createQuadMechLeg(materials, -1, 1, 0),
        rr: createQuadMechLeg(materials, 1, -1, 1),
        fr: createQuadMechLeg(materials, 1, 1, 2),
        rl: createQuadMechLeg(materials, -1, -1, 3)
    };
}
