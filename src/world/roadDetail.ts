// Winter dressing of the carriageway: frozen ruts, tar repairs, frost cracks,
// ice plates, the zebra on the two crossings and the settled joints of the
// pavement. All of it is flat decals laid a few millimetres above the surface
// plate it dresses — no collider, no layout object, no change to the road plan.
//
// Rules this module obeys (see README "Слои на земле"):
//   * every decal is created with `vertexSnap: false`, because two tessellations
//     of one plane shear differently under the PS1 snap and start flipping depth;
//   * every layer has its own height above the plate it covers, and the height is
//     jittered per decal so two decals of the same class never share a plane where
//     a junction makes them overlap;
//   * one merged mesh per material, so the whole dressing costs six draw calls.
import { COLORS } from '../config/colors.js';
import { SURFACE } from '../config/world.js';
import { createQuadBuilder, type QuadBuilder } from '../core/geometryBuilder.js';
import { makePS1Material } from '../core/ps1Material.js';
import { createSeededRandom } from '../core/random.js';
import { textures } from '../core/textures.js';
import type { Group } from 'three';
import type { Layout, Masks } from './layout/createLayout.js';
import type { MaskGrid } from './layout/maskGrid.js';
import type { PedestrianRect } from './layout/pedestrian.js';
import type { RoadEdge } from './layout/roadGraph.js';

const RUT = {
    OFFSET: 0.85,
    WIDTH: 0.56,
    SEGMENT: 2.2,
    GAP_RATIO: 0.18,
    LIFT: 0.004,
    LIFT_STEP: 0.0006,
    TILE: 2.6,
    SEED: 0x5c21
};

const PATCH = {
    PER_EDGE: 4,
    MIN: 0.9,
    MAX: 2.2,
    LIFT: 0.005,
    LIFT_STEP: 0.0005,
    TILE: 1.6,
    SEED: 0x2d77
};

const CRACK = {
    PER_EDGE: 3,
    STEP: 0.45,
    STEPS: 7,
    WIDTH: 0.055,
    BRANCH_CHANCE: 0.4,
    LIFT: 0.0065,
    SEED: 0x71a3
};

const ICE = {
    COUNT: 12,
    MIN: 1.1,
    MAX: 3.0,
    LIFT: 0.008,
    LIFT_STEP: 0.0004,
    TILE: 1.4,
    SEED: 0x6b41
};

const ZEBRA = {
    BAR: 0.55,
    GAP: 0.55,
    WORN: 0.12,
    LIFT: SURFACE.PAVING + 0.006,
    TILE: 1.8,
    SEED: 0x1f3d
};

const SLAB = {
    COUNT: 14,
    INSET: 0.15,
    LIFT: 0.003,
    LIFT_STEP: 0.0004,
    TILE: 2.0,
    SEED: 0x4e2a
};

interface Rect {
    minX: number;
    minZ: number;
    maxX: number;
    maxZ: number;
}

// A flat quad with world-space UVs. `alongAxis` decides which axis the V
// coordinate follows, so a directional texture (the ruts) always runs with the
// road instead of lying across it.
function addFlat(quads: QuadBuilder, rect: Rect, y: number, alongAxis: 'x' | 'z', tile: number): void {
    const corners = [
        [rect.minX, y, rect.minZ],
        [rect.minX, y, rect.maxZ],
        [rect.maxX, y, rect.maxZ],
        [rect.maxX, y, rect.minZ]
    ];
    const uvs = corners.map((corner) => (alongAxis === 'x' ? [corner[2] / tile, corner[0] / tile] : [corner[0] / tile, corner[2] / tile]));
    quads.addQuad(corners, [0, 1, 0], uvs);
}

function edgeSpan(edge: RoadEdge): { along0: number; along1: number; cross: number; half: number } {
    const horizontal = edge.axis === 'x';
    return {
        along0: horizontal ? edge.strip.minX : edge.strip.minZ,
        along1: horizontal ? edge.strip.maxX : edge.strip.maxZ,
        cross: horizontal ? (edge.strip.minZ + edge.strip.maxZ) / 2 : (edge.strip.minX + edge.strip.maxX) / 2,
        half: edge.width / 2
    };
}

function stripRect(axis: 'x' | 'z', along0: number, along1: number, cross: number, width: number): Rect {
    return axis === 'x'
        ? { minX: along0, maxX: along1, minZ: cross - width / 2, maxZ: cross + width / 2 }
        : { minX: cross - width / 2, maxX: cross + width / 2, minZ: along0, maxZ: along1 };
}

// Two polished bands per carriageway: the wheels of every car that drove here all
// winter. They stop and start at random, so the road never reads as two stripes
// painted on.
function buildRuts(quads: QuadBuilder, edges: RoadEdge[]): void {
    const random = createSeededRandom(RUT.SEED);

    edges.forEach((edge, edgeIndex) => {
        const span = edgeSpan(edge);
        const count = Math.max(1, Math.floor((span.along1 - span.along0) / RUT.SEGMENT));
        const lift = SURFACE.ASPHALT + RUT.LIFT + (edgeIndex % 3) * RUT.LIFT_STEP;

        [-1, 1].forEach((side) => {
            const cross = span.cross + side * RUT.OFFSET;
            for (let index = 0; index < count; index++) {
                if (random() < RUT.GAP_RATIO) continue;
                const from = span.along0 + index * RUT.SEGMENT + random() * 0.2;
                const to = Math.min(from + RUT.SEGMENT * (0.82 + random() * 0.14), span.along1);
                if (to - from < 0.4) continue;
                addFlat(quads, stripRect(edge.axis, from, to, cross, RUT.WIDTH), lift, edge.axis, RUT.TILE);
            }
        });
    });
}

// Tar repairs: rectangles of fresh binder poured over a pothole, lighter at the
// edge where the brush dragged. Two overlapping quads per repair give the
// irregular outline a single rectangle cannot.
function buildPatches(quads: QuadBuilder, edges: RoadEdge[]): void {
    const random = createSeededRandom(PATCH.SEED);

    edges.forEach((edge, edgeIndex) => {
        const span = edgeSpan(edge);
        for (let index = 0; index < PATCH.PER_EDGE; index++) {
            const width = PATCH.MIN + random() * (PATCH.MAX - PATCH.MIN);
            const length = PATCH.MIN + random() * (PATCH.MAX - PATCH.MIN);
            const cross = span.cross + (random() - 0.5) * Math.max(1, span.half * 1.4);
            const along = span.along0 + random() * Math.max(1, span.along1 - span.along0 - length);
            const lift = SURFACE.ASPHALT + PATCH.LIFT + (edgeIndex % 2) * PATCH.LIFT_STEP;

            addFlat(quads, stripRect(edge.axis, along, along + length, cross, width), lift, edge.axis, PATCH.TILE);
            addFlat(
                quads,
                stripRect(
                    edge.axis,
                    along + length * 0.18,
                    along + length * (0.72 + random() * 0.2),
                    cross + (random() - 0.5) * width * 0.3,
                    width * 0.62
                ),
                lift + 0.0004,
                edge.axis,
                PATCH.TILE
            );
        }
    });
}

// One crack segment: a thin quad between two points, so the crack bends instead
// of being a ruled line.
function addCrackSegment(quads: QuadBuilder, ax: number, az: number, bx: number, bz: number, y: number): void {
    const dx = bx - ax;
    const dz = bz - az;
    const length = Math.hypot(dx, dz) || 1;
    const px = (-dz / length) * (CRACK.WIDTH / 2);
    const pz = (dx / length) * (CRACK.WIDTH / 2);
    quads.addQuad(
        [
            [ax + px, y, az + pz],
            [bx + px, y, bz + pz],
            [bx - px, y, bz - pz],
            [ax - px, y, az - pz]
        ],
        [0, 1, 0],
        [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1]
        ]
    );
}

function buildCracks(quads: QuadBuilder, edges: RoadEdge[]): void {
    const random = createSeededRandom(CRACK.SEED);

    edges.forEach((edge) => {
        const span = edgeSpan(edge);
        const y = SURFACE.ASPHALT + CRACK.LIFT;

        for (let crack = 0; crack < CRACK.PER_EDGE; crack++) {
            const along = span.along0 + random() * Math.max(1, span.along1 - span.along0);
            let cross = span.cross + (random() - 0.5) * Math.max(1, edge.width - 1.4);
            let currentAlong = along;
            let direction = random() < 0.5 ? 1 : -1;

            for (let step = 0; step < CRACK.STEPS; step++) {
                const nextAlong = currentAlong + direction * CRACK.STEP * (0.6 + random() * 0.8);
                const nextCross = cross + (random() - 0.5) * CRACK.STEP * 0.8;
                const ax = edge.axis === 'x' ? currentAlong : cross;
                const az = edge.axis === 'x' ? cross : currentAlong;
                const bx = edge.axis === 'x' ? nextAlong : nextCross;
                const bz = edge.axis === 'x' ? nextCross : nextAlong;
                addCrackSegment(quads, ax, az, bx, bz, y);

                if (random() < CRACK.BRANCH_CHANCE) {
                    addCrackSegment(
                        quads,
                        bx,
                        bz,
                        bx + (edge.axis === 'x' ? 0.24 : 0.18) * direction,
                        bz + (edge.axis === 'x' ? 0.18 : 0.24),
                        y
                    );
                }

                currentAlong = nextAlong;
                cross = nextCross;
                if (random() < 0.14) direction *= -1;
            }
        }
    });
}

// Ice plates: meltwater that froze again along the kerbs and in the junction
// corners. They are the lightest ground decal of the frame, so they stay well
// under the snow caps in tone.
function buildIce(quads: QuadBuilder, edges: RoadEdge[], grid: MaskGrid, masks: Masks): void {
    if (edges.length === 0) return;
    const random = createSeededRandom(ICE.SEED);

    for (let index = 0; index < ICE.COUNT; index++) {
        const edge = edges[Math.floor(random() * edges.length)];
        const span = edgeSpan(edge);
        const width = ICE.MIN + random() * (ICE.MAX - ICE.MIN);
        const depth = ICE.MIN + random() * (ICE.MAX - ICE.MIN);
        const along = span.along0 + random() * Math.max(1, span.along1 - span.along0 - depth);
        const cross = span.cross + (random() - 0.5) * Math.max(0.6, edge.width - width);
        const rect = stripRect(edge.axis, along, along + depth, cross, width);

        if (!grid.isCoveredAt(masks.asphalt, (rect.minX + rect.maxX) / 2, (rect.minZ + rect.maxZ) / 2)) continue;
        addFlat(quads, rect, SURFACE.ASPHALT + ICE.LIFT + (index % 3) * ICE.LIFT_STEP, edge.axis, ICE.TILE);
    }
}

// Zebra across the two crossings: bars perpendicular to the walk, some of them
// worn down to a ghost. `layout.pedestrian` owns the crossing rectangles, so the
// paint cannot drift off the pavement it belongs to.
function buildZebra(quads: QuadBuilder, crossings: PedestrianRect[]): void {
    const random = createSeededRandom(ZEBRA.SEED);
    const step = ZEBRA.BAR + ZEBRA.GAP;

    crossings.forEach((crossing) => {
        const rect = crossing.rect;
        const walkAlongZ = rect.maxZ - rect.minZ >= rect.maxX - rect.minX;
        const from = walkAlongZ ? rect.minZ : rect.minX;
        const to = walkAlongZ ? rect.maxZ : rect.maxX;
        const count = Math.max(1, Math.floor((to - from) / step));

        for (let index = 0; index < count; index++) {
            if (random() < ZEBRA.WORN) continue;
            const start = from + index * step;
            const end = Math.min(start + ZEBRA.BAR, to);
            const bar =
                walkAlongZ
                    ? { minX: rect.minX, maxX: rect.maxX, minZ: start, maxZ: end }
                    : { minX: start, maxX: end, minZ: rect.minZ, maxZ: rect.maxZ };
            addFlat(quads, bar, ZEBRA.LIFT, walkAlongZ ? 'x' : 'z', ZEBRA.TILE);
        }
    });
}

// Settled joints of the pavement: a slab that dropped a couple of centimetres
// leaves a dark seam, which is the cheapest way to make a flat plate read as
// separate plates.
function buildSlabJoints(quads: QuadBuilder, grid: MaskGrid, masks: Masks): void {
    const random = createSeededRandom(SLAB.SEED);
    const cells: Rect[] = [];
    grid.forEachCell(masks.sidewalk, (rect) => {
        if (rect.maxX - rect.minX > 1.4 && rect.maxZ - rect.minZ > 1.4) cells.push(rect);
    });
    if (cells.length === 0) return;

    for (let index = 0; index < SLAB.COUNT; index++) {
        const cell = cells[Math.floor(random() * cells.length)];
        const width = Math.min(cell.maxX - cell.minX, 1.4 + random() * 1.6);
        const depth = Math.min(cell.maxZ - cell.minZ, 1.4 + random() * 1.6);
        const x = cell.minX + SLAB.INSET + random() * Math.max(0, cell.maxX - cell.minX - width - SLAB.INSET * 2);
        const z = cell.minZ + SLAB.INSET + random() * Math.max(0, cell.maxZ - cell.minZ - depth - SLAB.INSET * 2);
        addFlat(
            quads,
            { minX: x, maxX: x + width, minZ: z, maxZ: z + depth },
            SURFACE.PAVING + SLAB.LIFT + (index % 3) * SLAB.LIFT_STEP,
            'x',
            SLAB.TILE
        );
    }
}

export function buildRoadDetail(
    group: Group,
    { layout, masks, grid }: { layout: Layout; masks: Masks; grid: MaskGrid }
): void {
    const edges = layout.roadGraph.edges;
    const crossings = layout.pedestrian.rects.filter((entry) => entry.kind === 'crossing');

    const ruts = createQuadBuilder();
    const patches = createQuadBuilder();
    const cracks = createQuadBuilder();
    const ice = createQuadBuilder();
    const zebra = createQuadBuilder();
    const joints = createQuadBuilder();

    buildRuts(ruts, edges);
    buildPatches(patches, edges);
    buildCracks(cracks, edges);
    buildIce(ice, edges, grid, masks);
    buildZebra(zebra, crossings);
    buildSlabJoints(joints, grid, masks);

    if (!ruts.isEmpty()) {
        group.add(
            ruts.buildMesh(
                makePS1Material({ map: textures.roadRut, color: COLORS.CURB }, { vertexSnap: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
                'road-ruts'
            )
        );
    }
    if (!patches.isEmpty()) {
        group.add(
            patches.buildMesh(
                makePS1Material({ map: textures.winterSnow, color: COLORS.TAR_PATCH }, { vertexSnap: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
                'road-patches'
            )
        );
    }
    if (!cracks.isEmpty()) {
        group.add(
            cracks.buildMesh(makePS1Material({ color: COLORS.VOID_SOFT }, { vertexSnap: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), 'road-cracks')
        );
    }
    if (!ice.isEmpty()) {
        group.add(
            ice.buildMesh(makePS1Material({ map: textures.winterSnow, color: COLORS.ICE }, { vertexSnap: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), 'road-ice')
        );
    }
    if (!zebra.isEmpty()) {
        group.add(
            zebra.buildMesh(
                makePS1Material({ color: COLORS.ROAD_MARKING }, { vertexSnap: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
                'road-zebra'
            )
        );
    }
    if (!joints.isEmpty()) {
        group.add(
            joints.buildMesh(makePS1Material({ color: COLORS.CONCRETE }, { vertexSnap: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), 'pavement-joints')
        );
    }
}
