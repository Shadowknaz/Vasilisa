// The single source of truth of the diorama (TZ В§8.1): road graph -> surface masks
// -> object footprints and reservations -> pedestrian links -> validation ->
// frozen layout. Geometry builders only read the result; they never invent a
// coordinate, a clearance or a route of their own.
import {
    BUILDINGS,
    BOOTH,
    CLEARANCE,
    DECOR,
    FENCE_RUNS,
    FUNCTIONAL_ZONES,
    GENERATOR_VERSION,
    GRID,
    KIOSK,
    LAYOUT_SEED,
    MECH_PLAN,
    PIPELINE,
    PLAY_FENCES,
    PLAYGROUND,
    POLES,
    ROAD,
    SPAWN,
    TREES,
    WORLD,
    YARD
} from '../../config/layout.js';
import { SURFACE } from '../../config/world.js';
import { createRoadGraph, type RoadGraph } from './roadGraph.js';
import { createObjectDescriptors } from './footprints.js';
import { createReservations } from './reservations.js';
import { createPedestrianNetwork, type PedestrianNetwork } from './pedestrian.js';
import { createMaskGrid, type Mask, type MaskGrid } from './maskGrid.js';
import { validateLayout, type MechMetrics } from './validateLayout.js';
import type { Rect } from './rect.js';

export interface SurfaceRects {
    asphalt: Rect[];
    shells: Rect[];
    walk: Rect[];
    paving: Rect[];
}

export type CurbSegment =
    | { axis: 'z'; x: number; z0: number; z1: number; side: number }
    | { axis: 'x'; z: number; x0: number; x1: number; side: number };

export type Masks = ReturnType<typeof createMasks>;

// Everything that defines the plan goes into the hash. A different number anywhere
// means a different diorama, even when the layout data happens to look alike.
const PROFILE = {
    seed: LAYOUT_SEED,
    version: GENERATOR_VERSION,
    grid: GRID,
    world: WORLD,
    road: ROAD,
    zones: FUNCTIONAL_ZONES,
    spawn: SPAWN,
    buildings: BUILDINGS,
    playground: PLAYGROUND,
    kiosk: KIOSK,
    booth: BOOTH,
    yard: YARD,
    trees: TREES,
    poles: POLES,
    pipeline: PIPELINE,
    fences: FENCE_RUNS,
    playFences: PLAY_FENCES,
    decor: DECOR,
    clearance: CLEARANCE,
    mech: MECH_PLAN
};

// FNV-1a over the serialized profile: short, stable, and dependency free.
function configHash(profile: object = PROFILE): string {
    const text = JSON.stringify(profile);
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
}

// Mech routes the TZ requires to stay drivable: the ring, the street, both
// entrances and the run from the spawn to the ring. Checked at the measured
// silhouette radius, not at the controller radius.
function createMechRoute(graph: RoadGraph) {
    const node = (id: string) => {
        const entry = graph.nodeById.get(id)!;
        return { x: entry.x, z: entry.z };
    };

    return {
        ring: ['L', 'R', 'S', 'T', 'L'],
        spawn: { x: SPAWN.x, z: SPAWN.z },
        routes: [
            { id: 'RING', points: [node('L'), node('R'), node('S'), node('T'), node('L')] },
            // The street is drivable between the two access junctions; the portals
            // beyond them are a visual cut-away of the island.
            { id: 'STREET', points: [node('B'), node('C')] },
            { id: 'ENTRANCE-WEST', points: [node('B'), node('L')] },
            { id: 'ENTRANCE-EAST', points: [node('C'), node('R')] },
            {
                id: 'SPAWN-LINK',
                points: [
                    { x: SPAWN.x, z: SPAWN.z },
                    { x: SPAWN.x, z: ROAD.NODES.S[1] }
                ]
            }
        ]
    };
}

// Surface masks on one shared grid. Priority of overlap: pedestrian (a crossing
// painted over the carriageway) > asphalt > paving > sidewalk, so no two quads
// ever share a plane.
function createMasks(grid: MaskGrid, surfaceRects: SurfaceRects) {
    const asphalt = grid.mark(grid.createMask(), surfaceRects.asphalt);
    const paving = grid.mark(grid.createMask(), surfaceRects.paving);
    const walk = grid.mark(grid.createMask(), surfaceRects.walk);
    const shell = grid.mark(grid.createMask(), surfaceRects.shells);

    const sidewalk = grid.subtractMask(shell, asphalt);
    grid.subtractMask(sidewalk, walk);
    grid.subtractMask(sidewalk, paving);

    grid.subtractMask(paving, asphalt);
    grid.subtractMask(paving, walk);

    const crossing = grid.createMask();
    for (let index = 0; index < asphalt.cells.length; index++) {
        if (asphalt.cells[index] === 1 && walk.cells[index] === 1) crossing.cells[index] = 1;
    }

    const summarize = (mask: Mask) => ({
        area: grid.area(mask),
        cells: grid.cellCount(mask),
        checksum: grid.checksum(mask)
    });

    return {
        asphalt,
        sidewalk,
        pedestrian: walk,
        paving,
        crossing,
        areas: {
            asphalt: summarize(asphalt).area,
            sidewalk: summarize(sidewalk).area,
            pedestrian: summarize(walk).area,
            paving: summarize(paving).area,
            crossing: summarize(crossing).area
        },
        summary: {
            asphalt: summarize(asphalt),
            sidewalk: summarize(sidewalk),
            pedestrian: summarize(walk),
            paving: summarize(paving),
            crossing: summarize(crossing)
        }
    };
}

// Kerb segments: the boundary of the carriageway, except where a crossing meets
// it (the pedestrian mask is excluded) and except at the two street portals on
// the cut plane. `side` is the sign of the outward normal along the axis.
function createCurbs(grid: MaskGrid, masks: Masks) {
    const { vertical, horizontal } = grid.boundary(masks.asphalt, masks.pedestrian);
    const cut = WORLD.HALF - 1e-6;
    const segments: CurbSegment[] = [];
    let length = 0;

    vertical.forEach((segment) => {
        if (Math.abs(segment.x) >= cut) return;
        segments.push({ axis: 'z', x: segment.x, z0: segment.z0, z1: segment.z1, side: segment.side });
        length += segment.z1 - segment.z0;
    });

    horizontal.forEach((segment) => {
        if (Math.abs(segment.z) >= cut) return;
        segments.push({ axis: 'x', z: segment.z, x0: segment.x0, x1: segment.x1, side: segment.side });
        length += segment.x1 - segment.x0;
    });

    return { segments, length };
}

function deepFreeze<T>(value: T, seen: WeakSet<object> = new WeakSet()): T {
    if (value === null || typeof value !== 'object' || seen.has(value as object)) return value;
    seen.add(value as object);
    Object.getOwnPropertyNames(value).forEach((key) => deepFreeze((value as Record<string, unknown>)[key], seen));
    return Object.freeze(value);
}

// Canonical JSON: keys are sorted, so two planner runs can be compared as strings
// and a single number moving anywhere shows up as a diff.
function serializeLayout(layout: object): string {
    return JSON.stringify(layout, (_key, value) => {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
        const sorted: Record<string, unknown> = {};
        Object.keys(value)
            .sort()
            .forEach((name) => {
                sorted[name] = value[name];
            });
        return sorted;
    });
}

// Pavement never leaves the cut slab: the shells of the two street portals are
// wider than the island, so every surface rect is clipped before it is marked.
function clipToWorld(rects: Rect[]): Rect[] {
    const half = WORLD.HALF;
    const result: Rect[] = [];
    rects.forEach((rect) => {
        const minX = Math.max(rect.minX, -half);
        const minZ = Math.max(rect.minZ, -half);
        const maxX = Math.min(rect.maxX, half);
        const maxZ = Math.min(rect.maxZ, half);
        if (maxX - minX > 1e-6 && maxZ - minZ > 1e-6) result.push({ minX, minZ, maxX, maxZ });
    });
    return result;
}

function buildSurfaces(graph: RoadGraph, pedestrian: PedestrianNetwork): SurfaceRects {
    return {
        asphalt: clipToWorld(graph.asphaltRects),
        shells: clipToWorld(graph.sidewalkShells),
        walk: clipToWorld(pedestrian.rects.map((entry) => entry.rect)),
        paving: clipToWorld(FUNCTIONAL_ZONES.filter((zone) => zone.paved).map((zone) => zone.rect))
    };
}

function plan() {
    const graph = createRoadGraph();
    const objects = createObjectDescriptors();
    const reservations = createReservations(objects);
    const pedestrian = createPedestrianNetwork({ graph, objects });
    const zones = reservations.zones.map((zone) => ({
        id: zone.id,
        kind: zone.kind,
        zoneKind: zone.zoneKind,
        rect: { ...zone.rect },
        owner: zone.owner
    }));
    const mechRoute = createMechRoute(graph);
    const surfaces = buildSurfaces(graph, pedestrian);

    const grid = createMaskGrid({
        minX: -WORLD.HALF,
        minZ: -WORLD.HALF,
        maxX: WORLD.HALF,
        maxZ: WORLD.HALF,
        rects: [...surfaces.asphalt, ...surfaces.shells, ...surfaces.walk, ...surfaces.paving]
    });

    const masks = createMasks(grid, surfaces);
    const curbs = createCurbs(grid, masks);

    const layout = {
        seed: LAYOUT_SEED,
        generatorVersion: GENERATOR_VERSION,
        configHash: configHash(),
        world: {
            size: WORLD.SIZE,
            half: WORLD.HALF,
            walkMargin: WORLD.WALK_MARGIN,
            bounds: WORLD.BOUNDS
        },
        surfaces: { ...SURFACE },
        roadGraph: {
            nodes: graph.nodes,
            edges: graph.edges,
            pads: graph.pads,
            components: graph.components,
            cycles: graph.cycles,
            axisLength: graph.axisLength,
            asphaltArea: graph.expectedAsphaltArea
        },
        zones,
        objects,
        reservations,
        crossings: pedestrian.crossings,
        pedestrian: {
            rects: pedestrian.rects,
            approaches: pedestrian.approaches,
            links: pedestrian.links
        },
        mechRoute,
        spawn: pedestrian.spawn,
        curbs: curbs.segments,
        maskSummary: {
            ...masks.summary,
            curbLength: curbs.length,
            gridColumns: grid.nx,
            gridRows: grid.nz
        }
    };

    // The report is kept beside the layout, not inside it: the serialized plan must
    // stay a pure description of the diorama.
    const validation = validateLayout({
        layout,
        graph,
        masks,
        mech: { visualRadius: MECH_PLAN.VISUAL_RADIUS, visualHeight: MECH_PLAN.VISUAL_HEIGHT }
    });

    return { layout, graph, masks, grid, surfaceRects: surfaces, validation };
}

// Builds the plan once. `verifyDeterminism` runs the planner a second time and
// compares the canonical serializations вЂ” used by `?debug=layout`, never in the
// normal boot path.
export function createLayout({
    verifyDeterminism = false,
    mech = null
}: { verifyDeterminism?: boolean; mech?: MechMetrics | null } = {}): BuiltLayout {
    const built: PlannedLayout & { serialized?: string } = plan();

    if (mech) {
        built.validation = validateLayout({
            layout: built.layout,
            graph: built.graph,
            masks: built.masks,
            mech
        });
    }

    if (verifyDeterminism) {
        const second = plan();
        const first = serializeLayout(built.layout);
        const other = serializeLayout(second.layout);
        built.validation.checks.push({
            id: 'DETERMINISM',
            passed: first === other,
            detail: first === other ? 'two planner runs serialize identically' : 'layout differs between two runs'
        });
        if (first !== other) {
            built.validation.ok = false;
            built.validation.errors.push('DETERMINISM: layout differs between two runs');
        }
    }

    deepFreeze(built.layout);
    built.serialized = serializeLayout(built.layout);
    return built as BuiltLayout;
}

export type PlannedLayout = ReturnType<typeof plan>;
export type Layout = PlannedLayout['layout'];
export interface BuiltLayout extends PlannedLayout {
    serialized: string;
}


