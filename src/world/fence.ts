// Fence runs. Two styles share this module because they share the same job —
// closing a perimeter with a thin solid that the collision world already knows
// about: the PO-2 concrete fragments along both island edges (separate sections,
// knocked-out panels, leaning slabs, a gate) and the merged transformer-yard
// fence with its gate opening and its wire leaf (TZ §9.4, §9.6). Every run is
// placed by a layout descriptor.
//
// The PO-2 section is ported from the reference diorama (code_artifact.html
// §5.5): two foundation cups, posts, a chamfered panel with diamond reliefs and
// a snow cap. The lean of a section is baked into its vertices as a Z shear, so
// both runs together still cost six meshes instead of ninety.
import { COLORS } from '../config/colors.js';
import { createQuadBuilder, type QuadBuilder } from '../core/geometryBuilder.js';
import { innerVoidMat, snowCapMat, snowSoilMat } from '../core/materials.js';
import { makePS1Material } from '../core/ps1Material.js';
import { textures } from '../core/textures.js';
import { FENCE_PROFILE, type ObjectDescriptor, type YardFenceRun } from './layout/footprints.js';
import { objectsOfType, registerColliders } from './placement.js';
import { addBox, addDecal, addRidge, compose, placeAt, shearY, type Placement } from './quadTransform.js';
import type { Layout } from './layout/createLayout.js';
import type { CollisionWorld } from '../systems/collision.js';
import * as THREE from 'three';

// PO-2 concrete section: profile numbers the plan measures live in
// FENCE_PROFILE; these are the relief details only.
const PO2 = {
    CUPS: { WIDTH: 0.3, HEIGHT: 0.18, DEPTH: 0.3, INSET: 0.1 },
    POST: { WIDTH: 0.16, DEPTH: 0.16 },
    PANEL: { INSET: 0.1, BOTTOM: 0.15, HEIGHT: 1.75 },
    COPING: { HEIGHT: 0.09, DEPTH: 0.22, OVERHANG: 0.03 },
    CAP: { HEIGHT: 0.05, DEPTH: 0.2, OVERHANG: 0.06 },
    DIAMOND: { COLUMNS: 4, ROWS: 2, PADDING: 0.16, LIFT: 0.02, WIDTH_RATIO: 0.42, HEIGHT_RATIO: 0.85 },
    // One continuous ridge of snow banked against the foot of the whole run.
    DRIFT: { WIDTH: 0.55, HEIGHT: 0.07 },
    TILE: { CONCRETE: 2.4, SNOW: 1.2 },
    // The gate: two gate posts, a steel leaf hanging ajar and snow on its top rail.
    GATE: {
        POST: { WIDTH: 0.18, DEPTH: 0.18, EXTRA: 0.16 },
        LEAF: { HEIGHT: 1.78, THICKNESS: 0.07, INSET: 0.06 },
        RAIL: { SIZE: 0.05, BOTTOM_Y: 0.22, TOP_OFFSET: 0.08 },
        BAR: { WIDTH: 0.03, COUNT: 6 },
        SNOW: { HEIGHT: 0.045, OVERHANG: 0.02 }
    },
    // A panel that came off its posts lies flat in front of the run.
    FALLEN: { LIFT: 0.02, INSET: 0.08 }
};

// Yard fence: tall thin panels on posts, standing on a black bottom gap.
const YARD = {
    PANEL_BOTTOM: 0.18,
    POST_SPACING: 2.5,
    POST_TOP: 1.7,
    GAP_THICKNESS: 0.12,
    GAP_HEIGHT: 0.18,
    CAP: { HEIGHT: 0.05, OVERHANG: 0.02, TILE: 1.2 },
    // Wire leaf of the yard gate: two rails, vertical bars, one brace.
    LEAF: {
        THICKNESS: 0.06,
        RAIL: { SIZE: 0.045, BOTTOM_Y: 0.24, TOP_OFFSET: 0.12 },
        BAR: { WIDTH: 0.025, COUNT: 6 },
        BRACE: 0.04,
        SNOW: { HEIGHT: 0.04, OVERHANG: 0.015 }
    }
};

const FLAT_UVS = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1]
];

interface Po2RunParameters {
    id: string;
    x: number;
    fromZ: number;
    toZ: number;
    step: number;
    rotY: number;
    leans?: number[];
    missing?: number[];
    gate?: { index: number; ajarDeg: number };
    fallen?: { minX: number; maxX: number; minZ: number; maxZ: number; height: number } | null;
}

interface YardGateLeaf {
    hinge: { x: number; z: number };
    tip: { x: number; z: number };
    height: number;
    ajarDeg: number;
}

interface YardFenceParameters {
    runs: YardFenceRun[];
    gateLeaf?: YardGateLeaf;
}

// One merged builder per material for the whole PO-2 catalogue: both runs share
// the five meshes they produce together.
interface Po2Buckets {
    concrete: QuadBuilder;
    relief: QuadBuilder;
    trim: QuadBuilder;
    steel: QuadBuilder;
    snow: QuadBuilder;
    drift: QuadBuilder;
}

function createPo2Buckets(): Po2Buckets {
    return {
        concrete: createQuadBuilder(),
        relief: createQuadBuilder(),
        trim: createQuadBuilder(),
        steel: createQuadBuilder(),
        snow: createQuadBuilder(),
        drift: createQuadBuilder()
    };
}

// A flat diamond plate punched out of the panel face. It is a decal 2 cm proud
// of the slab, so it never fights the panel plane and never needs its own mesh.
function addDiamond(
    quads: QuadBuilder,
    place: Placement,
    cx: number,
    cy: number,
    halfWidth: number,
    halfHeight: number,
    z: number,
    normalZ: number
): void {
    addDecal(
        quads,
        place,
        [
            [cx - halfWidth, cy, z],
            [cx, cy + halfHeight, z],
            [cx + halfWidth, cy, z],
            [cx, cy - halfHeight, z]
        ],
        [0, 0, normalZ],
        FLAT_UVS
    );
}

function addPo2Panel(buckets: Po2Buckets, place: Placement, addRelief: boolean): void {
    const section = FENCE_PROFILE.SECTION;
    const halfWidth = section.WIDTH / 2;
    const halfThickness = section.THICKNESS / 2;
    const postOffset = halfWidth - PO2.CUPS.INSET;
    const panelBottom = PO2.PANEL.BOTTOM;
    const panelTop = panelBottom + PO2.PANEL.HEIGHT;

    // Foundation cups and posts.
    [-1, 1].forEach((side) => {
        const x = side * postOffset;
        addBox(buckets.trim, place, {
            minX: x - PO2.CUPS.WIDTH / 2,
            maxX: x + PO2.CUPS.WIDTH / 2,
            minY: 0,
            maxY: PO2.CUPS.HEIGHT,
            minZ: -PO2.CUPS.DEPTH / 2,
            maxZ: PO2.CUPS.DEPTH / 2
        }, PO2.TILE.CONCRETE);
        addBox(buckets.trim, place, {
            minX: x - PO2.POST.WIDTH / 2,
            maxX: x + PO2.POST.WIDTH / 2,
            minY: PO2.CUPS.HEIGHT,
            maxY: section.HEIGHT,
            minZ: -PO2.POST.DEPTH / 2,
            maxZ: PO2.POST.DEPTH / 2
        }, PO2.TILE.CONCRETE);
    });

    // Panel, coping and snow cap.
    addBox(buckets.concrete, place, {
        minX: -halfWidth + PO2.PANEL.INSET,
        maxX: halfWidth - PO2.PANEL.INSET,
        minY: panelBottom,
        maxY: panelTop,
        minZ: -halfThickness,
        maxZ: halfThickness
    }, PO2.TILE.CONCRETE);
    addBox(buckets.trim, place, {
        minX: -halfWidth + PO2.COPING.OVERHANG,
        maxX: halfWidth - PO2.COPING.OVERHANG,
        minY: panelTop,
        maxY: panelTop + PO2.COPING.HEIGHT,
        minZ: -PO2.COPING.DEPTH / 2,
        maxZ: PO2.COPING.DEPTH / 2
    }, PO2.TILE.CONCRETE);
    addBox(buckets.snow, place, {
        minX: -halfWidth + PO2.CAP.OVERHANG,
        maxX: halfWidth - PO2.CAP.OVERHANG,
        minY: panelTop + PO2.COPING.HEIGHT,
        maxY: panelTop + PO2.COPING.HEIGHT + PO2.CAP.HEIGHT,
        minZ: -PO2.CAP.DEPTH / 2,
        maxZ: PO2.CAP.DEPTH / 2
    }, PO2.TILE.SNOW);

    if (!addRelief) return;

    // Diamond reliefs on both faces of the panel.
    const cellWidth = (section.WIDTH - PO2.PANEL.INSET * 2 - PO2.DIAMOND.PADDING) / PO2.DIAMOND.COLUMNS;
    const cellHeight = (PO2.PANEL.HEIGHT - PO2.DIAMOND.PADDING) / PO2.DIAMOND.ROWS;
    const halfDiamondWidth = cellWidth * PO2.DIAMOND.WIDTH_RATIO;
    const halfDiamondHeight = cellHeight * 0.5 * PO2.DIAMOND.HEIGHT_RATIO;

    for (let row = 0; row < PO2.DIAMOND.ROWS; row++) {
        for (let column = 0; column < PO2.DIAMOND.COLUMNS; column++) {
            const cx = -((PO2.DIAMOND.COLUMNS - 1) * cellWidth) / 2 + column * cellWidth;
            const cy = panelBottom + PO2.DIAMOND.PADDING / 2 + cellHeight * (row + 0.5);
            addDiamond(buckets.relief, place, cx, cy, halfDiamondWidth, halfDiamondHeight, halfThickness + PO2.DIAMOND.LIFT, 1);
            addDiamond(buckets.relief, place, cx, cy, halfDiamondWidth, halfDiamondHeight, -halfThickness - PO2.DIAMOND.LIFT, -1);
        }
    }
}

// Gate posts stand one step taller than the run and carry no snow: they are the
// only bare concrete in the whole fence, which is what marks the opening.
function addPo2GatePost(buckets: Po2Buckets, place: Placement): void {
    const gate = PO2.GATE.POST;
    addBox(buckets.trim, place, {
        minX: -gate.WIDTH / 2,
        maxX: gate.WIDTH / 2,
        minY: 0,
        maxY: FENCE_PROFILE.SECTION.HEIGHT + gate.EXTRA,
        minZ: -gate.DEPTH / 2,
        maxZ: gate.DEPTH / 2
    }, PO2.TILE.CONCRETE);
}

// Steel gate leaf hanging ajar from the north post of the gate section. The leaf
// is not a collider: an open gate must be walkable, otherwise the hole in the
// run is decoration instead of an entrance.
function addPo2GateLeaf(buckets: Po2Buckets, run: Po2RunParameters): void {
    if (!run.gate) return;
    const gate = PO2.GATE;
    const section = FENCE_PROFILE.SECTION;
    const centerZ = run.fromZ + run.gate.index * run.step;
    const hingeZ = centerZ + section.WIDTH / 2;
    const length = section.WIDTH - gate.LEAF.INSET * 2;
    const ajar = (run.gate.ajarDeg * Math.PI) / 180;
    // Local +X of the placement turns towards the island by 90 deg minus the ajar
    // angle, so 0 deg would be a closed leaf lying along -Z from the hinge.
    const side = run.x < 0 ? 1 : -1;
    const place = placeAt(run.x, hingeZ, Math.PI / 2 - side * ajar);
    const halfThickness = gate.LEAF.THICKNESS / 2;
    const topRailY = gate.LEAF.HEIGHT - gate.RAIL.TOP_OFFSET;
    const inner = gate.LEAF.INSET;

    [gate.RAIL.BOTTOM_Y, topRailY].forEach((y) => {
        addBox(buckets.steel, place, {
            minX: inner,
            maxX: length,
            minY: y - gate.RAIL.SIZE / 2,
            maxY: y + gate.RAIL.SIZE / 2,
            minZ: -halfThickness,
            maxZ: halfThickness
        }, 1.8);
    });

    [0, length].forEach((x) => {
        addBox(buckets.steel, place, {
            minX: x,
            maxX: x + gate.RAIL.SIZE,
            minY: gate.RAIL.BOTTOM_Y,
            maxY: topRailY,
            minZ: -halfThickness,
            maxZ: halfThickness
        }, 1.8);
    });

    for (let index = 1; index < gate.BAR.COUNT; index++) {
        const x = inner + ((length - inner) * index) / gate.BAR.COUNT;
        addBox(buckets.steel, place, {
            minX: x - gate.BAR.WIDTH / 2,
            maxX: x + gate.BAR.WIDTH / 2,
            minY: gate.RAIL.BOTTOM_Y,
            maxY: topRailY,
            minZ: -halfThickness * 0.6,
            maxZ: halfThickness * 0.6
        }, 1.8);
    }

    addBox(buckets.snow, place, {
        minX: inner,
        maxX: length,
        minY: topRailY + gate.RAIL.SIZE / 2,
        maxY: topRailY + gate.RAIL.SIZE / 2 + gate.SNOW.HEIGHT,
        minZ: -halfThickness - gate.SNOW.OVERHANG,
        maxZ: halfThickness + gate.SNOW.OVERHANG
    }, PO2.TILE.SNOW);
}

// The slab that was knocked out lies flat in front of the run, its diamonds up.
function addFallenPanel(buckets: Po2Buckets, run: Po2RunParameters): void {
    const fallen = run.fallen;
    if (!fallen) return;

    const width = fallen.maxX - fallen.minX;
    const depth = fallen.maxZ - fallen.minZ;
    const place = placeAt((fallen.minX + fallen.maxX) / 2, (fallen.minZ + fallen.maxZ) / 2, 0);
    const bottom = PO2.FALLEN.LIFT;

    addBox(buckets.concrete, place, {
        minX: -width / 2,
        maxX: width / 2,
        minY: bottom,
        maxY: bottom + fallen.height,
        minZ: -depth / 2,
        maxZ: depth / 2
    }, PO2.TILE.CONCRETE);

    // Two diamonds of the top face, so the slab is recognisably a PO-2 panel.
    [-1, 1].forEach((side) => {
        addDecal(
            buckets.relief,
            place,
            [
                [side * 0.42 - 0.22, bottom + fallen.height + 0.002, 0],
                [side * 0.42, bottom + fallen.height + 0.002, 0.34],
                [side * 0.42 + 0.22, bottom + fallen.height + 0.002, 0],
                [side * 0.42, bottom + fallen.height + 0.002, -0.34]
            ],
            [0, 1, 0],
            FLAT_UVS
        );
    });
}

function addPo2Run(buckets: Po2Buckets, object: ObjectDescriptor): void {
    const run = object.parameters as Po2RunParameters;
    const section = FENCE_PROFILE.SECTION;
    const count = Math.round((run.toZ - run.fromZ) / run.step);
    const missing: number[] = run.missing || [];
    const leans: number[] = run.leans || [];

    for (let index = 0; index <= count; index++) {
        if (missing.includes(index)) continue;
        const z = run.fromZ + index * run.step;
        addPo2Panel(buckets, compose(placeAt(run.x, z, run.rotY), shearY(leans[index] || 0)), true);
    }

    // Gate: a taller post on each side of the opening and the leaf hanging ajar.
    if (run.gate) {
        const centerZ = run.fromZ + run.gate.index * run.step;
        const halfWidth = section.WIDTH / 2;
        [-1, 1].forEach((side) => {
            addPo2GatePost(buckets, placeAt(run.x, centerZ + side * halfWidth, run.rotY));
        });
        addPo2GateLeaf(buckets, run);
    }

    addFallenPanel(buckets, run);

    // Snow banked against the foot of the slab is one ridge for the whole run:
    // a box per section reads as a row of white crates, not a ploughed bank.
    const span = run.toZ - run.fromZ;
    if (span > 0) {
        addRidge(
            buckets.drift,
            placeAt(run.x, (run.fromZ + run.toZ) / 2, run.rotY),
            { length: span + section.WIDTH, width: PO2.DRIFT.WIDTH, height: PO2.DRIFT.HEIGHT },
            PO2.TILE.SNOW
        );
    }
}

function addYardRun(panels: QuadBuilder, gaps: QuadBuilder, caps: QuadBuilder, run: YardFenceRun, tile: number): void {
    const half = FENCE_PROFILE.YARD_THICKNESS / 2;
    const gapHalf = YARD.GAP_THICKNESS / 2;
    const capHalf = half + YARD.CAP.OVERHANG;

    const toBox = (inset: number, minY: number, maxY: number) =>
        run.axis === 'x'
            ? { minX: run.x0, maxX: run.x1, minZ: run.z - inset, maxZ: run.z + inset, minY, maxY }
            : { minX: run.x - inset, maxX: run.x + inset, minZ: run.z0, maxZ: run.z1, minY, maxY };

    panels.addBox(toBox(half, YARD.PANEL_BOTTOM, FENCE_PROFILE.YARD_HEIGHT), tile);
    gaps.addBox(toBox(gapHalf, 0, YARD.GAP_HEIGHT), tile);
    // Snow cap along the top edge: the single winter line that makes the yard
    // fence read as standing outside in February.
    caps.addBox(toBox(capHalf, FENCE_PROFILE.YARD_HEIGHT, FENCE_PROFILE.YARD_HEIGHT + YARD.CAP.HEIGHT), YARD.CAP.TILE);

    // Posts at both ends and at most every POST_SPACING along the run
    const from = run.axis === 'x' ? run.x0 : run.z0;
    const to = run.axis === 'x' ? run.x1 : run.z1;
    const span = to - from;
    const count = Math.max(1, Math.round(span / YARD.POST_SPACING));
    const postHalfX = FENCE_PROFILE.YARD_POST.WIDTH / 2;
    const postHalfZ = FENCE_PROFILE.YARD_POST.DEPTH / 2;
    const postCapHalfX = postHalfX + YARD.CAP.OVERHANG;
    const postCapHalfZ = postHalfZ + YARD.CAP.OVERHANG;

    for (let index = 0; index <= count; index++) {
        const along = from + (span * index) / count;
        panels.addBox(
            run.axis === 'x'
                ? {
                      minX: along - postHalfX,
                      maxX: along + postHalfX,
                      minZ: run.z - postHalfZ,
                      maxZ: run.z + postHalfZ,
                      minY: 0,
                      maxY: YARD.POST_TOP
                  }
                : {
                      minX: run.x - postHalfX,
                      maxX: run.x + postHalfX,
                      minZ: along - postHalfZ,
                      maxZ: along + postHalfZ,
                      minY: 0,
                      maxY: YARD.POST_TOP
                  },
            tile
        );
        caps.addBox(
            run.axis === 'x'
                ? {
                      minX: along - postCapHalfX,
                      maxX: along + postCapHalfX,
                      minZ: run.z - postCapHalfZ,
                      maxZ: run.z + postCapHalfZ,
                      minY: YARD.POST_TOP,
                      maxY: YARD.POST_TOP + YARD.CAP.HEIGHT
                  }
                : {
                      minX: run.x - postCapHalfX,
                      maxX: run.x + postCapHalfX,
                      minZ: along - postCapHalfZ,
                      maxZ: along + postCapHalfZ,
                      minY: YARD.POST_TOP,
                      maxY: YARD.POST_TOP + YARD.CAP.HEIGHT
                  },
            YARD.CAP.TILE
        );
    }
}

// The wire leaf of the yard gate: hinged on the south post, swung into the yard.
// Both its rails and the collider registered by the plan come from the same two
// points of the descriptor.
function addYardGateLeaf(steel: QuadBuilder, cap: QuadBuilder, leaf: YardGateLeaf): void {
    const profile = YARD.LEAF;
    const dx = leaf.tip.x - leaf.hinge.x;
    const dz = leaf.tip.z - leaf.hinge.z;
    const length = Math.hypot(dx, dz);
    if (length < 1e-3) return;

    // Local +X of a placement maps to (cos, -sin), so the yaw that points the
    // leaf from its hinge to its tip is atan2(-dz, dx).
    const place = placeAt(leaf.hinge.x, leaf.hinge.z, Math.atan2(-dz, dx));
    const halfThickness = profile.THICKNESS / 2;
    const topRailY = leaf.height - profile.RAIL.TOP_OFFSET;

    [profile.RAIL.BOTTOM_Y, topRailY].forEach((y) => {
        addBox(steel, place, {
            minX: 0,
            maxX: length,
            minY: y - profile.RAIL.SIZE / 2,
            maxY: y + profile.RAIL.SIZE / 2,
            minZ: -halfThickness,
            maxZ: halfThickness
        }, 1.6);
    });

    for (let index = 0; index <= profile.BAR.COUNT; index++) {
        const x = (length * index) / profile.BAR.COUNT;
        addBox(steel, place, {
            minX: x - profile.BAR.WIDTH / 2,
            maxX: x + profile.BAR.WIDTH / 2,
            minY: profile.RAIL.BOTTOM_Y,
            maxY: topRailY,
            minZ: -halfThickness * 0.6,
            maxZ: halfThickness * 0.6
        }, 1.6);
    }

    // Diagonal brace from the hinge to the far end of the top rail.
    addBox(steel, place, {
        minX: 0,
        maxX: profile.BRACE,
        minY: profile.RAIL.BOTTOM_Y,
        maxY: topRailY,
        minZ: -halfThickness * 0.5,
        maxZ: halfThickness * 0.5
    }, 1.6);
    addBox(steel, place, {
        minX: length - profile.BRACE,
        maxX: length,
        minY: profile.RAIL.BOTTOM_Y,
        maxY: topRailY,
        minZ: -halfThickness * 0.5,
        maxZ: halfThickness * 0.5
    }, 1.6);

    addBox(cap, place, {
        minX: 0,
        maxX: length,
        minY: topRailY + profile.RAIL.SIZE / 2,
        maxY: topRailY + profile.RAIL.SIZE / 2 + profile.SNOW.HEIGHT,
        minZ: -halfThickness - profile.SNOW.OVERHANG,
        maxZ: halfThickness + profile.SNOW.OVERHANG
    }, YARD.CAP.TILE);
}

// The five runs stop at the gate, so the 2.4 m opening is a real hole in both the
// merged geometry and the collision set.
function buildYardFence(group: THREE.Group, object: ObjectDescriptor): void {
    const parameters = object.parameters as YardFenceParameters;
    const panels = createQuadBuilder();
    const gaps = createQuadBuilder();
    const caps = createQuadBuilder();
    const steel = createQuadBuilder();
    const tile = FENCE_PROFILE.SECTION.WIDTH;

    parameters.runs.forEach((run) => addYardRun(panels, gaps, caps, run, tile));
    if (parameters.gateLeaf) addYardGateLeaf(steel, caps, parameters.gateLeaf);

    if (!panels.isEmpty()) {
        group.add(panels.buildMesh(makePS1Material({ color: COLORS.FENCE }), 'yard-fence'));
    }
    if (!gaps.isEmpty()) {
        group.add(gaps.buildMesh(innerVoidMat, 'yard-fence-gaps'));
    }
    if (!caps.isEmpty()) {
        group.add(caps.buildMesh(snowCapMat, 'yard-fence-snow'));
    }
    if (!steel.isEmpty()) {
        group.add(steel.buildMesh(makePS1Material({ color: COLORS.IRON_FENCE }), 'yard-fence-leaf'));
    }
}

function buildPo2Fence(group: THREE.Group, objects: ObjectDescriptor[]): void {
    if (objects.length === 0) return;
    const buckets = createPo2Buckets();
    objects.forEach((object) => addPo2Run(buckets, object));

    // Concrete takes its tone from the texture; the diamond relief has no map on
    // purpose, so it reads as a lighter stud on the slab instead of a second copy
    // of the same wall.
    const layers: Array<[string, THREE.Material, QuadBuilder]> = [
        ['po2-panels', makePS1Material({ map: textures.sidewalkConcrete, color: COLORS.BUILDING_PLINTH }), buckets.concrete],
        ['po2-relief', makePS1Material({ color: COLORS.CONCRETE }), buckets.relief],
        ['po2-trim', makePS1Material({ map: textures.sidewalkConcrete, color: COLORS.CONCRETE_TRIM }), buckets.trim],
        ['po2-steel', makePS1Material({ color: COLORS.IRON_FENCE }), buckets.steel],
        ['po2-snow', snowCapMat, buckets.snow],
        ['po2-drift', snowSoilMat, buckets.drift]
    ];

    layers.forEach(([name, material, builder]) => {
        if (builder.isEmpty()) return;
        group.add(builder.buildMesh(material, name));
    });
}

export function buildFence(group: THREE.Group, collision: CollisionWorld, layout: Layout): void {
    const po2 = objectsOfType(layout, 'po2-fence');
    const yard = objectsOfType(layout, 'yard-fence');

    buildPo2Fence(group, po2);
    yard.forEach((object) => buildYardFence(group, object));

    [...po2, ...yard].forEach((object) => registerColliders(collision, object));
}
