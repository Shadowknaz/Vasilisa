// Armoured airlock door on the walker's left flank: heavy frame with a weather
// drip hood, the stamped leaf on two external barrel hinges, the Soviet rotary
// locking handwheel with external dog latches, grab rails, and the folding
// boarding stirrup the pilot climbs from. The pose animator swings the leaf and
// unfolds the stirrup during a boarding transition.
import type { MechMaterials } from './mechMaterials.js';
import { box, cyl } from './mechGeometry.js';
import * as THREE from 'three';

const DOOR = {
    // The whole assembly hangs off the left flank of the hull's mid-core.
    ORIGIN: { X: -0.62, Y: 0.14, Z: 0.04 },
    FRAME: { WIDTH: 0.09, HEIGHT: 0.96, DEPTH: 0.68, X: -0.01, Y: 0.08 },
    HOOD: { WIDTH: 0.14, HEIGHT: 0.06, DEPTH: 0.74, X: -0.04, Y: 0.57, TILT: 0.22 },
    LAMP: { WIDTH: 0.08, HEIGHT: 0.07, DEPTH: 0.16, X: -0.06, Y: 0.63 },
    LAMP_CAGE: { WIDTH: 0.1, HEIGHT: 0.02, DEPTH: 0.18, X: -0.07, Y: 0.67 },
    // Hinge on the rear edge; the leaf occupies +Z from the hinge.
    HINGE: { X: -0.05, Y: 0.08, Z: -0.29 },
    LEAF: { WIDTH: 0.06, HEIGHT: 0.84, DEPTH: 0.58, Z: 0.29 },
    LEAF_PLATE: { WIDTH: 0.04, HEIGHT: 0.14, DEPTH: 0.3, X: -0.03, Y: 0.24 },
    LEAF_PEEP: { WIDTH: 0.05, HEIGHT: 0.07, DEPTH: 0.22, X: -0.035, Y: 0.24 },
    LEAF_BROW: { WIDTH: 0.07, HEIGHT: 0.03, DEPTH: 0.26, X: -0.04, Y: 0.3 },
    WHEEL: {
        X: -0.065,
        Y: -0.05,
        Z: 0.36,
        HUB: { TOP_RADIUS: 0.045, BOTTOM_RADIUS: 0.055, HEIGHT: 0.06, SEGMENTS: 6, X: 0.02 },
        SHAFT: { RADIUS: 0.03, HEIGHT: 0.08, SEGMENTS: 6 },
        SPOKES: { COUNT: 4, WIDTH: 0.022, LENGTH: 0.24, X: -0.02 },
        RIM: { COUNT: 8, WIDTH: 0.026, LENGTH: 0.095, RADIUS: 0.115, X: -0.02 },
        LATCH: { WIDTH: 0.025, HEIGHT: 0.035, DEPTH: 0.18, X: -0.035, Y: 0.14, Z: 0.48 }
    },
    HINGES: {
        Y: [0.3, -0.16],
        BLOCK: { WIDTH: 0.1, HEIGHT: 0.1, DEPTH: 0.14, X: -0.05, Z: -0.31 },
        PIN: { RADIUS: 0.038, HEIGHT: 0.18, SEGMENTS: 6, X: -0.07 }
    },
    RAIL: { RADIUS: 0.02, HEIGHT: 0.72, SEGMENTS: 5, X: -0.08, Y: 0.1, Z: 0.42 },
    RAIL_BRACKET: { WIDTH: 0.08, HEIGHT: 0.025, DEPTH: 0.025, X: -0.04, Y: [-0.24, 0.44], Z: 0.42 },
    STIRRUP: {
        PIVOT: { X: -0.06, Y: -0.44, Z: 0.02 },
        PLATE: { WIDTH: 0.12, HEIGHT: 0.04, DEPTH: 0.48 },
        ROD: { WIDTH: 0.025, HEIGHT: 0.3, DEPTH: 0.03, X: -0.03, Y: -0.16, Z: 0.16 },
        STEP: { WIDTH: 0.06, HEIGHT: 0.03, DEPTH: 0.36, X: -0.03, Y: -0.3 }
    }
} as const;

export interface MechDoor {
    // Frame, leaf, handwheel and stirrup, mounted on the hull's left flank.
    assembly: THREE.Group;
    // Door leaf hinge; the pose animator swings it open around Y.
    hatchPivot: THREE.Group;
    // Folding boarding stirrup; the pose animator swings it out around Z.
    ladderPivot: THREE.Group;
    // Boarding plafond lamp, pulsed by the pilot's proximity.
    lampMat: THREE.MeshBasicMaterial;
}

export function createDoor(materials: MechMaterials): MechDoor {
    const assembly = new THREE.Group();
    assembly.position.set(DOOR.ORIGIN.X, DOOR.ORIGIN.Y, DOOR.ORIGIN.Z);

    assembly.add(box(DOOR.FRAME.WIDTH, DOOR.FRAME.HEIGHT, DOOR.FRAME.DEPTH, materials.steel, DOOR.FRAME.X, DOOR.FRAME.Y, 0));
    assembly.add(box(DOOR.HOOD.WIDTH, DOOR.HOOD.HEIGHT, DOOR.HOOD.DEPTH, materials.hullLight, DOOR.HOOD.X, DOOR.HOOD.Y, 0, 0, 0, DOOR.HOOD.TILT));
    assembly.add(box(DOOR.LAMP.WIDTH, DOOR.LAMP.HEIGHT, DOOR.LAMP.DEPTH, materials.boardingLamp, DOOR.LAMP.X, DOOR.LAMP.Y, 0));
    assembly.add(box(DOOR.LAMP_CAGE.WIDTH, DOOR.LAMP_CAGE.HEIGHT, DOOR.LAMP_CAGE.DEPTH, materials.steel, DOOR.LAMP_CAGE.X, DOOR.LAMP_CAGE.Y, 0));

    // Stamped armoured leaf on its rear-edge hinge
    const hatchPivot = new THREE.Group();
    hatchPivot.position.set(DOOR.HINGE.X, DOOR.HINGE.Y, DOOR.HINGE.Z);
    assembly.add(hatchPivot);

    hatchPivot.add(box(DOOR.LEAF.WIDTH, DOOR.LEAF.HEIGHT, DOOR.LEAF.DEPTH, materials.door, 0, 0, DOOR.LEAF.Z));
    hatchPivot.add(box(DOOR.LEAF_PLATE.WIDTH, DOOR.LEAF_PLATE.HEIGHT, DOOR.LEAF_PLATE.DEPTH, materials.steel, DOOR.LEAF_PLATE.X, DOOR.LEAF_PLATE.Y, DOOR.LEAF.Z));
    hatchPivot.add(box(DOOR.LEAF_PEEP.WIDTH, DOOR.LEAF_PEEP.HEIGHT, DOOR.LEAF_PEEP.DEPTH, materials.visor, DOOR.LEAF_PEEP.X, DOOR.LEAF_PEEP.Y, DOOR.LEAF.Z));
    hatchPivot.add(box(DOOR.LEAF_BROW.WIDTH, DOOR.LEAF_BROW.HEIGHT, DOOR.LEAF_BROW.DEPTH, materials.piston, DOOR.LEAF_BROW.X, DOOR.LEAF_BROW.Y, DOOR.LEAF.Z));

    // Soviet rotary locking handwheel (штурвал-кремальера)
    const wheel = DOOR.WHEEL;
    hatchPivot.add(cyl(wheel.HUB.TOP_RADIUS, wheel.HUB.BOTTOM_RADIUS, wheel.HUB.HEIGHT, wheel.HUB.SEGMENTS, materials.steel, wheel.X + wheel.HUB.X, wheel.Y, wheel.Z, 0, 0, Math.PI / 2));
    hatchPivot.add(cyl(wheel.SHAFT.RADIUS, wheel.SHAFT.RADIUS, wheel.SHAFT.HEIGHT, wheel.SHAFT.SEGMENTS, materials.piston, wheel.X, wheel.Y, wheel.Z, 0, 0, Math.PI / 2));

    for (let spoke = 0; spoke < wheel.SPOKES.COUNT; spoke++) {
        const angle = (spoke / wheel.SPOKES.COUNT) * Math.PI;
        hatchPivot.add(box(wheel.SPOKES.WIDTH, wheel.SPOKES.LENGTH, wheel.SPOKES.WIDTH, materials.piston, wheel.X + wheel.SPOKES.X, wheel.Y, wheel.Z, angle));
    }
    for (let segment = 0; segment < wheel.RIM.COUNT; segment++) {
        const angle = (segment / wheel.RIM.COUNT) * Math.PI * 2;
        hatchPivot.add(box(
            wheel.RIM.WIDTH,
            wheel.RIM.LENGTH,
            wheel.RIM.WIDTH,
            materials.enamel,
            wheel.X + wheel.RIM.X,
            wheel.Y + Math.cos(angle) * wheel.RIM.RADIUS,
            wheel.Z + Math.sin(angle) * wheel.RIM.RADIUS,
            angle + Math.PI / 2
        ));
    }
    [-1, 1].forEach((side) => {
        hatchPivot.add(box(wheel.LATCH.WIDTH, wheel.LATCH.HEIGHT, wheel.LATCH.DEPTH, materials.steel, wheel.LATCH.X, wheel.Y + side * wheel.LATCH.Y, wheel.LATCH.Z));
    });

    // Two external barrel hinges
    DOOR.HINGES.Y.forEach((y) => {
        assembly.add(box(DOOR.HINGES.BLOCK.WIDTH, DOOR.HINGES.BLOCK.HEIGHT, DOOR.HINGES.BLOCK.DEPTH, materials.castIron, DOOR.HINGES.BLOCK.X, y, DOOR.HINGES.BLOCK.Z));
        assembly.add(cyl(DOOR.HINGES.PIN.RADIUS, DOOR.HINGES.PIN.RADIUS, DOOR.HINGES.PIN.HEIGHT, DOOR.HINGES.PIN.SEGMENTS, materials.piston, DOOR.HINGES.PIN.X, y, DOOR.HINGES.BLOCK.Z));
    });

    // Vertical grab rail beside the door
    assembly.add(cyl(DOOR.RAIL.RADIUS, DOOR.RAIL.RADIUS, DOOR.RAIL.HEIGHT, DOOR.RAIL.SEGMENTS, materials.piston, DOOR.RAIL.X, DOOR.RAIL.Y, DOOR.RAIL.Z));
    DOOR.RAIL_BRACKET.Y.forEach((y) => {
        assembly.add(box(DOOR.RAIL_BRACKET.WIDTH, DOOR.RAIL_BRACKET.HEIGHT, DOOR.RAIL_BRACKET.DEPTH, materials.steel, DOOR.RAIL_BRACKET.X, y, DOOR.RAIL_BRACKET.Z));
    });

    // Folding boarding stirrup under the threshold
    const stirrup = DOOR.STIRRUP;
    const ladderPivot = new THREE.Group();
    ladderPivot.position.set(stirrup.PIVOT.X, stirrup.PIVOT.Y, stirrup.PIVOT.Z);
    assembly.add(ladderPivot);
    ladderPivot.add(box(stirrup.PLATE.WIDTH, stirrup.PLATE.HEIGHT, stirrup.PLATE.DEPTH, materials.steel));
    [-1, 1].forEach((side) => {
        ladderPivot.add(box(stirrup.ROD.WIDTH, stirrup.ROD.HEIGHT, stirrup.ROD.DEPTH, materials.piston, stirrup.ROD.X, stirrup.ROD.Y, side * stirrup.ROD.Z));
    });
    ladderPivot.add(box(stirrup.STEP.WIDTH, stirrup.STEP.HEIGHT, stirrup.STEP.DEPTH, materials.enamel, stirrup.STEP.X, stirrup.STEP.Y, 0));

    return { assembly, hatchPivot, ladderPivot, lampMat: materials.boardingLamp };
}
