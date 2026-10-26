// Composition root of the walker rig. Builds the «ВНИИТЭ-68» hull, its command
// tower, the four heavy legs, the exhaust flap and the searchlight, and exposes
// exactly the pivots and materials the simulation animates. Nothing here knows
// about state or input: systems only move what this function returns.
import { MECH_RIG } from '../config/mech.js';
import { createExhaust } from './mechExhaust.js';
import { createHull } from './mechHull.js';
import { createMechMaterials } from './mechMaterials.js';
import { createQuadLegs, type QuadLegs } from './legs.js';
import { createSearchlight, type MechSearchlight } from './mechSearchlight.js';
import * as THREE from 'three';

export interface MechRig {
    group: THREE.Group;
    // World-space pivot of the searchlight's ground pool (gait-independent).
    ground: { group: THREE.Group; pool: THREE.Group };
    // Hull suspension pivot: bobs, sways and squats without moving the feet.
    hullPivot: THREE.Group;
    hatchPivot: THREE.Group;
    ladderPivot: THREE.Group;
    boardingLampMat: THREE.MeshBasicMaterial;
    radarPivot: THREE.Group;
    antennaPivot: THREE.Group;
    exhaustFlapPivot: THREE.Group;
    searchlight: MechSearchlight;
    legs: QuadLegs;
}

// The searchlight's additive pool is the walker's only ground overlay. It lives
// in its own world-space group, never under the rig, so the gait cannot carry it
// away from the pavement.
function createGroundPool(): { group: THREE.Group; pool: THREE.Group } {
    const group = new THREE.Group();
    const pool = new THREE.Group();
    group.add(pool);
    return { group, pool };
}

export function buildMech(): MechRig {
    const materials = createMechMaterials();
    const ground = createGroundPool();
    const group = new THREE.Group();
    // One uniform enlargement of the whole reference model: the rig-local
    // proportions stay untouched and the feet stay on y = 0.
    group.scale.setScalar(MECH_RIG.SCALE);

    const hull = createHull(materials, group);
    const exhaustFlapPivot = createExhaust(materials);
    hull.hullPivot.add(exhaustFlapPivot);

    // The legs mount to the walker root, so a planted foot stays planted while
    // the hull rides on its struts above them.
    const legs = createQuadLegs(materials);
    group.add(legs.fl.legRoot, legs.fr.legRoot, legs.rl.legRoot, legs.rr.legRoot);

    const searchlight = createSearchlight(hull.tower.group, ground.pool, materials);

    return {
        group,
        ground,
        hullPivot: hull.hullPivot,
        hatchPivot: hull.door.hatchPivot,
        ladderPivot: hull.door.ladderPivot,
        boardingLampMat: hull.door.lampMat,
        radarPivot: hull.tower.radarPivot,
        antennaPivot: hull.tower.antennaPivot,
        exhaustFlapPivot,
        searchlight,
        legs
    };
}
