// Low welded lawn fence around the playground, ported from code_artifact.html
// §5.6: corner posts with snow caps, two rails and an X of slanted bars in every
// bay, with a couple of bays knocked out after the accident.
//
// The runs are solid: the pilot walks around them, the mech route never comes
// close (the PLAY zone is six metres off the carriageway), and the layout
// validator measures the very footprints registered here.
import { COLORS } from '../config/colors.js';
import { createQuadBuilder } from '../core/geometryBuilder.js';
import { snowCapMat } from '../core/materials.js';
import { makePS1Material } from '../core/ps1Material.js';
import {
    LAWN_FENCE_PROFILE,
    type ObjectDescriptor,
    type YardFenceRun
} from './layout/footprints.js';
import { objectsOfType, registerColliders } from './placement.js';
import { addBox, addDecal, placeAt, type Placement, type Point } from './quadTransform.js';
import type { Layout } from './layout/createLayout.js';
import type { CollisionWorld } from '../systems/collision.js';
import * as THREE from 'three';

// Relief details only; HEIGHT / THICKNESS / BAY the plan measures live in
// LAWN_FENCE_PROFILE.
const LAWN = {
    POST: { SIZE: 0.14, EXTRA_HEIGHT: 0.06 },
    RAIL: { SIZE: 0.035, TOP_OFFSET: 0.06, BOTTOM_Y: 0.16 },
    BAR: { WIDTH: 0.03, MISSING_BAY_STEP: 5, MISSING_BAY_INDEX: 2 },
    // One continuous ridge of snow along the top rail instead of a cap per post:
    // caps every 0.8 m alias into a string of bright dots at the iso distance.
    SNOW: { HEIGHT: 0.04, OVERHANG: 0.02 },
    TILE: { IRON: 2.0, SNOW: 1.2 }
};

// The run frame: local +X runs along the fence, local +Z is its thickness.
function runFrame(run: YardFenceRun): { place: Placement; normal: Point; from: number; to: number } {
    if (run.axis === 'x') {
        return {
            place: placeAt(0, run.z, 0),
            normal: [0, 0, 1],
            from: run.x0,
            to: run.x1
        };
    }
    return {
        place: placeAt(run.x, 0, -Math.PI / 2),
        normal: [-1, 0, 0],
        from: run.z0,
        to: run.z1
    };
}

// One slanted bar, drawn as a flat strip in the fence plane: at 2.4 cm the bar
// has no readable thickness from the isometric camera, but its direction does.
function addBar(quads: ReturnType<typeof createQuadBuilder>, place: Placement, normal: Point, u0: number, y0: number, u1: number, y1: number): void {
    const du = u1 - u0;
    const dy = y1 - y0;
    const length = Math.hypot(du, dy) || 1;
    const offsetU = (-dy / length) * (LAWN.BAR.WIDTH / 2);
    const offsetY = (du / length) * (LAWN.BAR.WIDTH / 2);

    addDecal(
        quads,
        place,
        [
            [u0 + offsetU, y0 + offsetY, 0],
            [u1 + offsetU, y1 + offsetY, 0],
            [u1 - offsetU, y1 - offsetY, 0],
            [u0 - offsetU, y0 - offsetY, 0]
        ],
        normal,
        [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1]
        ]
    );
}

function buildLawnRun(group: THREE.Group, object: ObjectDescriptor): void {
    const run = object.parameters as YardFenceRun;
    const height = LAWN_FENCE_PROFILE.HEIGHT;
    const thickness = LAWN_FENCE_PROFILE.THICKNESS;
    const frame = runFrame(run);

    const iron = createQuadBuilder();
    const snow = createQuadBuilder();

    const span = frame.to - frame.from;
    const bays = Math.max(1, Math.round(span / LAWN_FENCE_PROFILE.BAY));
    const bayWidth = span / bays;
    const halfThickness = thickness / 2;
    const postHalf = LAWN.POST.SIZE / 2;
    const topRailY = height - LAWN.RAIL.TOP_OFFSET;

    // Rails along the whole run.
    [topRailY, LAWN.RAIL.BOTTOM_Y].forEach((y) => {
        addBox(
            iron,
            frame.place,
            {
                minX: frame.from,
                maxX: frame.to,
                minY: y - LAWN.RAIL.SIZE / 2,
                maxY: y + LAWN.RAIL.SIZE / 2,
                minZ: -halfThickness,
                maxZ: halfThickness
            },
            LAWN.TILE.IRON
        );
    });

    // Posts with a snow ridge along the top rail: both ends plus one per bay.
    for (let index = 0; index <= bays; index++) {
        const u = frame.from + bayWidth * index;
        addBox(
            iron,
            frame.place,
            {
                minX: u - postHalf,
                maxX: u + postHalf,
                minY: 0,
                maxY: height + LAWN.POST.EXTRA_HEIGHT,
                minZ: -halfThickness,
                maxZ: halfThickness
            },
            LAWN.TILE.IRON
        );
    }

    addBox(
        snow,
        frame.place,
        {
            minX: frame.from,
            maxX: frame.to,
            minY: height + LAWN.POST.EXTRA_HEIGHT - LAWN.SNOW.HEIGHT,
            maxY: height + LAWN.POST.EXTRA_HEIGHT,
            minZ: -halfThickness - LAWN.SNOW.OVERHANG,
            maxZ: halfThickness + LAWN.SNOW.OVERHANG
        },
        LAWN.TILE.SNOW
    );

    // X of slanted bars per bay, one missing here and there.
    for (let bay = 0; bay < bays; bay++) {
        const u0 = frame.from + bayWidth * bay;
        const u1 = u0 + bayWidth;
        const inset = postHalf + LAWN.BAR.WIDTH;
        const broken = bay % LAWN.BAR.MISSING_BAY_STEP === LAWN.BAR.MISSING_BAY_INDEX;

        addBar(iron, frame.place, frame.normal, u0 + inset, LAWN.RAIL.BOTTOM_Y, u1 - inset, topRailY);
        if (!broken) {
            addBar(iron, frame.place, frame.normal, u0 + inset, topRailY, u1 - inset, LAWN.RAIL.BOTTOM_Y);
        }
    }

    // Rusted iron, not near-black: at this size a 0.19 albedo bar disappears into
    // the paving and the run reads as a white line floating over the ground.
    const ironMat = makePS1Material({ color: COLORS.RUST, side: THREE.DoubleSide });
    if (!iron.isEmpty()) group.add(iron.buildMesh(ironMat, 'lawn-fence'));
    if (!snow.isEmpty()) group.add(snow.buildMesh(snowCapMat, 'lawn-fence-snow'));
}

export function buildLawnFences(group: THREE.Group, collision: CollisionWorld, layout: Layout): void {
    const runs = objectsOfType(layout, 'lawn-fence');

    runs.forEach((object) => buildLawnRun(group, object));
    runs.forEach((object) => registerColliders(collision, object));
}
