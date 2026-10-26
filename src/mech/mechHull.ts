// The armoured hull of the «ВНИИТЭ-68»: gyroscopic drive block and undercarriage
// on the suspension pivot, the mid-section industrial core with its tapered
// cheeks and collar belt, the command tower, the flank door, the field repairs
// and the rear spine. The legs are mounted by the composition root, never here.
import { MECH_RIG } from '../config/mech.js';
import type { MechMaterials } from './mechMaterials.js';
import { addRivetRow, box, cyl } from './mechGeometry.js';
import { createDoor, type MechDoor } from './mechDoor.js';
import { createFieldRepairs, createSpine } from './mechHullDetails.js';
import { createTower, type MechTower } from './mechTower.js';
import * as THREE from 'three';

const HULL = {
    UNDERCARRIAGE: {
        BLOCK: { WIDTH: 1.04, HEIGHT: 0.46, DEPTH: 1.32, Y: -0.44 },
        PIVOT_DRUM: { TOP_RADIUS: 0.38, BOTTOM_RADIUS: 0.28, HEIGHT: 0.34, SEGMENTS: 8, Y: -0.74 },
        SUMP: { WIDTH: 0.68, HEIGHT: 0.14, DEPTH: 0.96, Y: -0.68, Z: 0.04 },
        DIFFERENTIAL: { RADIUS: 0.12, HEIGHT: 0.24, SEGMENTS: 6, Y: -0.82, Z: 0.22 },
        SHACKLE: { WIDTH: 0.06, HEIGHT: 0.12, DEPTH: 0.16, X: 0.28, Y: -0.5, Z: 0.7 },
        TOW_BAR: { RADIUS: 0.025, HEIGHT: 0.68, SEGMENTS: 6, Y: -0.5, Z: 0.75 }
    },
    CORE: {
        BODY: { WIDTH: 1.16, HEIGHT: 0.94, DEPTH: 1.42, Y: 0.16, Z: -0.02 },
        CHEEK: { WIDTH: 0.12, HEIGHT: 0.88, DEPTH: 1.28, X: 0.59, Y: 0.18, TILT: 0.08 },
        COLLAR: { WIDTH: 1.22, HEIGHT: 0.09, DEPTH: 1.46, Y: 0.56 },
        COLLAR_RIVETS: { COUNT: 7, X: -0.48, Y: 0.56, Z: 0.74, STEP_X: 0.16 }
    }
} as const;

interface MechHull {
    hullPivot: THREE.Group;
    tower: MechTower;
    door: MechDoor;
}

export function createHull(materials: MechMaterials, parent: THREE.Object3D): MechHull {
    const hullPivot = new THREE.Group();
    hullPivot.position.y = MECH_RIG.HULL_HEIGHT;
    parent.add(hullPivot);

    // Lower pelvis / gyroscopic drive block and undercarriage details
    const under = HULL.UNDERCARRIAGE;
    hullPivot.add(box(under.BLOCK.WIDTH, under.BLOCK.HEIGHT, under.BLOCK.DEPTH, materials.castIron, 0, under.BLOCK.Y, 0));
    hullPivot.add(cyl(under.PIVOT_DRUM.TOP_RADIUS, under.PIVOT_DRUM.BOTTOM_RADIUS, under.PIVOT_DRUM.HEIGHT, under.PIVOT_DRUM.SEGMENTS, materials.steel, 0, under.PIVOT_DRUM.Y, 0));
    hullPivot.add(box(under.SUMP.WIDTH, under.SUMP.HEIGHT, under.SUMP.DEPTH, materials.hullDark, 0, under.SUMP.Y, under.SUMP.Z));
    hullPivot.add(cyl(under.DIFFERENTIAL.RADIUS, under.DIFFERENTIAL.RADIUS, under.DIFFERENTIAL.HEIGHT, under.DIFFERENTIAL.SEGMENTS, materials.piston, 0, under.DIFFERENTIAL.Y, under.DIFFERENTIAL.Z, Math.PI / 2));

    // Front and rear heavy tow shackles
    [-1, 1].forEach((side) => {
        hullPivot.add(box(under.SHACKLE.WIDTH, under.SHACKLE.HEIGHT, under.SHACKLE.DEPTH, materials.steel, side * under.SHACKLE.X, under.SHACKLE.Y, under.SHACKLE.Z));
    });
    hullPivot.add(cyl(under.TOW_BAR.RADIUS, under.TOW_BAR.RADIUS, under.TOW_BAR.HEIGHT, under.TOW_BAR.SEGMENTS, materials.piston, 0, under.TOW_BAR.Y, under.TOW_BAR.Z, 0, 0, Math.PI / 2));

    // Mid-section industrial core with tapered faceted cheeks and collar belt
    const core = HULL.CORE;
    hullPivot.add(box(core.BODY.WIDTH, core.BODY.HEIGHT, core.BODY.DEPTH, materials.hullDark, 0, core.BODY.Y, core.BODY.Z));
    hullPivot.add(box(core.CHEEK.WIDTH, core.CHEEK.HEIGHT, core.CHEEK.DEPTH, materials.hullMid, core.CHEEK.X, core.CHEEK.Y, core.BODY.Z, 0, 0, core.CHEEK.TILT));
    hullPivot.add(box(core.CHEEK.WIDTH, core.CHEEK.HEIGHT, core.CHEEK.DEPTH, materials.hullMid, -core.CHEEK.X, core.CHEEK.Y, core.BODY.Z, 0, 0, -core.CHEEK.TILT));
    hullPivot.add(box(core.COLLAR.WIDTH, core.COLLAR.HEIGHT, core.COLLAR.DEPTH, materials.steel, 0, core.COLLAR.Y, 0));
    addRivetRow(
        hullPivot,
        materials.rivet,
        core.COLLAR_RIVETS.COUNT,
        { x: core.COLLAR_RIVETS.X, y: core.COLLAR_RIVETS.Y, z: core.COLLAR_RIVETS.Z },
        { x: core.COLLAR_RIVETS.STEP_X, y: 0, z: 0 }
    );

    hullPivot.add(createSpine(materials));

    const tower = createTower(materials);
    hullPivot.add(tower.group);

    const door = createDoor(materials);
    hullPivot.add(door.assembly);

    const repairs = createFieldRepairs(materials);
    hullPivot.add(repairs.right, repairs.left, repairs.guard);

    return { hullPivot, tower, door };
}
