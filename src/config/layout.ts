// Fixed plan of the 108×108 courtyard: road network, functional zones, object
// placements and the clearance profile. Pure numbers only — no Three.js here, so
// the planner can run (and be validated) before a single mesh is created.
import { DIORAMA } from './world.js';

export const LAYOUT_SEED = 108;
export const GENERATOR_VERSION = '2.1.0';

export const GRID = {
    AXIS_STEP: 0.5,
    BOUNDARY_STEP: 0.25,
    EPS_GEOMETRY: 0.01,
    EPS_CLEARANCE: 0.05
} as const;

export const WORLD = {
    SIZE: DIORAMA.SIZE,
    HALF: DIORAMA.SIZE / 2,
    WALK_MARGIN: DIORAMA.WALK_MARGIN,
    BOUNDS: DIORAMA.SIZE / 2 - DIORAMA.WALK_MARGIN
} as const;

// y -Z is north, +Z is south, +X is east. Widths are carriageway widths without
// kerbs and sidewalks.
export const ROAD = {
    KINDS: {
        street: { width: 6.0, sidewalk: 2.0 },
        access: { width: 5.5, sidewalk: 1.5 },
        courtyard: { width: 5.5, sidewalk: 1.5 }
    },
    NODES: {
        A: [-54, -48],
        B: [-42, -48],
        C: [42, -48],
        D: [54, -48],
        L: [-42, -22],
        R: [42, -22],
        S: [42, 22],
        T: [-42, 22]
    },
    EDGES: [
        ['A', 'B', 'street'],
        ['B', 'C', 'street'],
        ['C', 'D', 'street'],
        ['B', 'L', 'access'],
        ['C', 'R', 'access'],
        ['L', 'R', 'courtyard'],
        ['R', 'S', 'courtyard'],
        ['S', 'T', 'courtyard'],
        ['T', 'L', 'courtyard']
    ]
} as const;

export const FUNCTIONAL_ZONES = [
    {
        id: 'PLAY',
        kind: 'playground',
        rect: { minX: -12, minZ: -12, maxX: 12, maxZ: 8 },
        owner: 'playground',
        paved: false
    },
    {
        id: 'TP_YARD',
        kind: 'service',
        rect: { minX: 23, minZ: -12, maxX: 35, maxZ: 2 },
        owner: 'transformer',
        paved: true
    },
    {
        id: 'KIOSK_APRON',
        kind: 'commercial',
        rect: { minX: -35, minZ: -10, maxX: -31.5, maxZ: -4 },
        owner: 'kiosk',
        paved: true
    }
] as const;

export const SPAWN = {
    x: 0,
    z: 14,
    radius: 5,
    yaw: 0,
    // Local offset of the boarding ladder exit point (BOARDING.EXIT_DISTANCE).
    pilotOffset: 3.15
} as const;

export const BUILDINGS = [
    { id: 'H1', x: -20, z: -35, rotY: 0, sections: 5, ownerZone: 'housing-north-west' },
    { id: 'H2', x: 20, z: -35, rotY: 0, sections: 5, ownerZone: 'housing-north-east' },
    { id: 'H3', x: -20, z: 35, rotY: Math.PI, sections: 5, ownerZone: 'housing-south-west' },
    { id: 'H4', x: 20, z: 35, rotY: Math.PI, sections: 5, ownerZone: 'housing-south-east' }
] as const;

export const PLAYGROUND = {
    origin: { x: 0, z: -2 },
    sandbox: { x: -5, z: -3 },
    rocket: { x: 4, z: -5 },
    swing: { x: 4, z: 3 },
    swingReserve: { minX: 1.5, minZ: -0.5, maxX: 6.5, maxZ: 6.5 }
} as const;

export const KIOSK = {
    id: 'KIOSK',
    x: -29,
    z: -7,
    // Prefab front is local +Z; -pi/2 turns the shop window to the west approach.
    rotY: -Math.PI / 2,
    ownerZone: 'kiosk'
} as const;

export const BOOTH = {
    id: 'TP',
    x: 29,
    z: -5,
    rotY: 0,
    ownerZone: 'transformer'
} as const;

export const YARD = {
    // The leaf hangs on the south gate post and is swung this far into the yard,
    // so the opening stays a hole in both the geometry and the collision set.
    gate: { x: 35, z: -9, width: 2.4, leaf: { ajarDeg: 100 } },
    servicePath: { width: 2, points: [[35, -9], [32, -9], [29, -9]] },
    doorReserve: { minX: 26, minZ: -9.8, maxX: 32, maxZ: -6.8 }
} as const;

// Winter courtyard trees: 'poplar' is the tall fastigiate tree, 'spreading' the
// wide crown. Both are bare skeletons — the branch project radius per unit of
// scale stays below the reserved crown radius of the spec (TREE_PROFILE.CROWN_RADIUS).
export const TREES = [
    { id: 'T1', x: -28, z: 12, scale: 1.0, type: 'spreading' },
    { id: 'T2', x: -23.5, z: -12, scale: 1.0, type: 'poplar' },
    { id: 'T3', x: 22, z: 12, scale: 0.95, type: 'spreading' },
    { id: 'T4', x: 31, z: 13, scale: 0.9, type: 'poplar' },
    { id: 'T5', x: -8, z: 14, scale: 1.0, type: 'spreading' },
    { id: 'T6', x: 10, z: 14, scale: 0.85, type: 'poplar' },
    // Lawn fill: every one of these was measured by the validator, not eyeballed.
    { id: 'T7', x: -33, z: 1, scale: 1.0, type: 'spreading' },
    { id: 'T8', x: 34, z: 6, scale: 0.95, type: 'poplar' },
    { id: 'T9', x: 16, z: -14.2, scale: 0.9, type: 'spreading' },
    { id: 'T10', x: -23, z: 0, scale: 1.0, type: 'poplar' },
    // Second wave: the lawn pockets that stayed empty once the crowns grew. The
    // saplings sit where a full-size crown no longer clears the pavement.
    { id: 'T11', x: 19, z: 4.5, scale: 1.0, type: 'spreading' },
    { id: 'T12', x: 16, z: -8, scale: 1.0, type: 'poplar' },
    { id: 'T13', x: -4, z: -14.8, scale: 0.7, type: 'spreading' },
    { id: 'T14', x: -14, z: 12.5, scale: 0.7, type: 'spreading' },
    { id: 'T15', x: -34.5, z: 9, scale: 0.7, type: 'poplar' },
    { id: 'T16', x: -22, z: 14.5, scale: 0.7, type: 'spreading' }
] as const;

export const POLES = {
    x: 48.5,
    z: [-10, -2, 6, 14],
    height: 9.8,
    anchorY: 9.3,
    sag: 1.15,
    // Explicit neighbours: no closed ring stretched across the courtyard.
    spans: [[0, 1], [1, 2], [2, 3]]
} as const;

export const PIPELINE = {
    id: 'PIPE-SOUTH',
    z: 48.5,
    fromX: -30,
    toX: 30,
    pillarX: [-30, -15, 0, 15, 30],
    height: 2.1,
    width: 1.0
} as const;

export const FENCE_RUNS = [
    {
        id: 'FENCE-EAST',
        x: 50,
        fromZ: -12,
        toZ: 18,
        step: 2.5,
        rotY: -Math.PI / 2,
        // One lean per section (13 sections, 0..12). Baked into the vertices by
        // the builder, so the whole run stays a handful of merged meshes.
        leans: [0.02, -0.03, 0.045, -0.015, 0.03, -0.045, 0.025, 0.01, -0.035, 0.05, -0.02, 0.015, -0.03],
        // Section that was knocked out after the accident: a real hole, not a decal.
        missing: [4]
    },
    {
        // The western twin of the run above: the same PO-2 section, its own lean
        // pattern so the two edges never read as a mirror. The gate is a hole in
        // the run with a leaf hanging ajar from its northern post.
        id: 'FENCE-WEST',
        x: -50,
        fromZ: -12,
        toZ: 18,
        step: 2.5,
        rotY: -Math.PI / 2,
        leans: [-0.025, 0.04, -0.02, 0.035, -0.05, 0.02, -0.015, 0.045, -0.03, 0.01, -0.04, 0.03, -0.02],
        // One panel knocked out and one opening left as a gate: both are holes in
        // the merged geometry and in the collision set.
        missing: [3, 9],
        gate: { index: 9, ajarDeg: 62 }
    }
] as const;

// Low welded lawn fences around the playground. The west run stops at z = 1.4 so
// the playground link (z 3..5) and the spawn approach stay open.
export const PLAY_FENCES = [
    { id: 'PLAY-FENCE-N', axis: 'x', x0: -11.6, x1: 11.6, z: -11.85 },
    { id: 'PLAY-FENCE-E', axis: 'z', z0: -11.6, z1: 7.6, x: 11.85 },
    { id: 'PLAY-FENCE-W', axis: 'z', z0: -11.6, z1: 1.4, x: -11.85 }
] as const;

// Secondary decor. Dropped with a reason if the validator rejects a placement.
export const DECOR = {
    fbs: [
        { id: 'FBS1', x: -30, z: -42.2, rotY: 0.15 },
        { id: 'FBS2', x: -12, z: -42.0, rotY: -0.2 },
        // Leftovers of the same works: one on top of the other and one dropped on
        // its edge, so the pair reads as a stack that was never collected.
        { id: 'FBS3', x: -25.5, z: -41.8, rotY: -0.08, stack: 2 },
        { id: 'FBS4', x: -18.5, z: -42.0, rotY: 0.2, lean: 0.28 }
    ],
    barrels: [
        { id: 'B1', x: 31.4, z: 0.2, tilted: false },
        { id: 'B2', x: 32.3, z: 0.7, tilted: true },
        { id: 'B3', x: -33.5, z: -2.2, tilted: false }
    ],
    stencilPad: { x: 0, z: 10.4, rotY: 0 },
    // Snow-covered shrub clumps: no collider, checked off every route by the
    // DECOR_PLACEMENT rule.
    shrubs: [
        { id: 'SH1', x: 49.2, z: -8, w: 1.1, h: 0.5, d: 0.5, ry: 0 },
        { id: 'SH2', x: 49.2, z: 2, w: 0.9, h: 0.45, d: 0.5, ry: 0 },
        { id: 'SH3', x: 49.2, z: 12, w: 1.2, h: 0.52, d: 0.55, ry: 0 },
        { id: 'SH4', x: -4.5, z: -12.55, w: 1.1, h: 0.46, d: 0.5, ry: 0 },
        { id: 'SH5', x: 3.5, z: -12.55, w: 1.0, h: 0.44, d: 0.5, ry: 0 },
        { id: 'SH6', x: -30.6, z: -10.4, w: 0.9, h: 0.44, d: 0.5, ry: 0 },
        { id: 'SH7', x: 13, z: -12.55, w: 1.0, h: 0.46, d: 0.5, ry: 0 },
        { id: 'SH8', x: -36, z: 16.5, w: 1.1, h: 0.46, d: 0.5, ry: 0 },
        { id: 'SH9', x: -48.9, z: -2, w: 1.1, h: 0.48, d: 0.5, ry: 0 },
        { id: 'SH10', x: -48.9, z: 9, w: 1.0, h: 0.46, d: 0.5, ry: 0 }
    ],
    // Settled snow fields on the lawns inside the ring. `mounds` is the drift
    // count, `seed` keeps the drift layout stable across reloads.
    snowPatches: [
        { id: 'SP1', x: -26.5, z: -12.5, width: 8, depth: 5.5, mounds: 7, seed: 11 },
        { id: 'SP2', x: 28, z: 9, width: 9, depth: 8, mounds: 7, seed: 12 },
        { id: 'SP3', x: 17, z: -15, width: 6, depth: 4, mounds: 5, seed: 13 },
        { id: 'SP4', x: -32, z: 13.5, width: 7, depth: 4, mounds: 5, seed: 14 },
        { id: 'SP5', x: -29, z: 0.5, width: 6, depth: 7, mounds: 6, seed: 15 },
        // Ploughed banks along the courtyard-side kerb of the ring: they lie on
        // the pavement band, which the DECOR_PLACEMENT policy allows for snow.
        { id: 'SP6', x: -30, z: -18.5, width: 16, depth: 1.2, mounds: 3, seed: 21 },
        { id: 'SP7', x: -30, z: 18.5, width: 16, depth: 1.2, mounds: 3, seed: 22 },
        { id: 'SP8', x: 21, z: 18.5, width: 30, depth: 1.2, mounds: 4, seed: 23 },
        // The rest of the kerb line: the ring was ploughed once, not in patches.
        { id: 'SP9', x: 9, z: -18.5, width: 18, depth: 1.2, mounds: 3, seed: 24 },
        { id: 'SP10', x: 4, z: 18.5, width: 16, depth: 1.2, mounds: 3, seed: 25 },
        { id: 'SP11', x: -20, z: -44, width: 20, depth: 1.2, mounds: 3, seed: 26 },
        { id: 'SP12', x: 38.6, z: -1, width: 1.2, depth: 10, mounds: 3, seed: 27 },
        // Snow banked against the plinths: split around the porch approaches, so
        // no bank ever crosses a walk to a door.
        { id: 'SP13', x: -27.5, z: -29, width: 11, depth: 0.8, mounds: 3, seed: 31 },
        { id: 'SP14', x: -12.5, z: -29, width: 11, depth: 0.8, mounds: 3, seed: 32 },
        { id: 'SP15', x: 12.5, z: 29, width: 11, depth: 0.8, mounds: 3, seed: 33 },
        { id: 'SP16', x: 27.5, z: 29, width: 11, depth: 0.8, mounds: 3, seed: 34 }
    ],
    // Cast-iron manhole covers in the carriageway. No collider: a 3.5 cm plate
    // the walker steps over, kept only as a read of "the yard was lived in".
    manholes: [
        { id: 'MH1', x: -26, z: -22.9, rotY: 0 },
        { id: 'MH2', x: 18, z: 22.9, rotY: 0.4 },
        { id: 'MH3', x: -9, z: -48.8, rotY: 0 },
        { id: 'MH4', x: 12, z: -47.2, rotY: 0.9 },
        { id: 'MH5', x: -40.5, z: -22.9, rotY: 0.2 },
        { id: 'MH6', x: 20, z: -47.5, rotY: 0 }
    ],
    // Storm-water grates hugging the kerb: the only road furniture the yard ever
    // had. Flat decor on the carriageway (DECOR_PLACEMENT 'on-asphalt').
    grates: [
        { id: 'GR1', x: 10, z: -45.7, rotY: 0 },
        { id: 'GR2', x: -30, z: -19.9, rotY: 0 },
        { id: 'GR3', x: 44.1, z: 4, rotY: Math.PI / 2 }
    ],
    // Laundry frames on the lawns: two posts, three wires, one rug left out.
    laundry: [
        { id: 'LD1', x: 26, z: 8, rotY: 0, rug: true },
        { id: 'LD2', x: -31, z: 6, rotY: 0, rug: false }
    ],
    // Refuse containers beside the transformer yard, where the vans turned round.
    bins: [
        { id: 'BIN1', x: 28.6, z: 4, rotY: 0.06 },
        { id: 'BIN2', x: 29.9, z: 4.1, rotY: -0.08 }
    ],
    // PAG-14 plate field in the kiosk apron: a paving inlay, not a second floor.
    pagSlab: { id: 'PAG-SLAB', x: -33.25, z: -7, cols: 3, rows: 6, seed: 16 }
} as const;

// Minimum gaps from the expansion spec (§7). Measured between full footprints,
// with the additional numeric epsilon applied by the validator.
export const CLEARANCE = {
    BUILDING_TO_COURTYARD_ASPHALT: 2.5,
    BUILDING_TO_STREET_ASPHALT: 4,
    BUILDING_GABLE_GAP: 6,
    BUILDING_TO_EDGE: 2,
    PLAY_TO_ASPHALT: 6,
    PLAY_TO_TP_YARD: 10,
    PLAY_TO_KIOSK: 8,
    KIOSK_TO_ASPHALT: 3,
    BOOTH_TO_ASPHALT: 3,
    TREE_CENTER_TO_BUILDING: 4,
    TREE_CENTER_TO_ASPHALT: 2.5,
    TREE_BRANCHES_TO_PAVING: 0.5,
    // A winter crown must not grow into a fence: the snow caps would intersect
    // the concrete and the merged geometry would read as one broken object.
    TREE_TO_FENCE: 0.5,
    TREE_TO_TREE: 6,
    OBJECT_TO_RESERVATION: 0.5,
    PEDESTRIAN_WIDTH: 2,
    ENTRANCE_APPROACH_WIDTH: 1.5,
    CLEAR_HEADROOM: 0.5
} as const;

export const MECH_PLAN = {
    COLLIDER_RADIUS: 2.15,
    // Conservative silhouette used by the route checks: the widest splayed pads
    // plus the searchlight cone footprint, not the controller collider. It is
    // deliberately never measured at runtime — the plan stays frozen.
    VISUAL_RADIUS: 3.6,
    VISUAL_HEIGHT: 6.2,
    MIN_PASSAGE: 5.5
} as const;

export const DEBUG = {
    LAYOUT_QUERY: 'debug',
    LAYOUT_VALUE: 'layout',
    PERF_QUERY: 'perf',
    // Layer switches: each one removes exactly one suspect from the frame, so a
    // visual artefact can be attributed without editing the source.
    POST_QUERY: 'post',
    SNAP_QUERY: 'snap',
    SNOW_QUERY: 'snow',
    FOG_QUERY: 'fog',
    LIGHTS_QUERY: 'lights',
    NIGHT_QUERY: 'night',
    // Decay layer: ?decay=off rebuilds the blocks as they were before the
    // post-catastrophe pass — intact sashes, entire roofs, sealed porches — so an
    // A/B of the whole package is one URL away. The flag is read before the world
    // is built, exactly like the render switches.
    DECAY_QUERY: 'decay',
    // Interior layer: ?interior=off plans the district without any opened porch,
    // so the blocks come back exactly as they were before the pass (solid stair
    // bays, sealed doorways). Read before the plan is built, like ?decay=off.
    INTERIOR_QUERY: 'interior',
    // Exposure sweep: the two night budgets (SURFACE / SKY, see config/render.ts)
    // can be moved for one boot without editing the config, so the acceptance
    // harness measures a candidate look in one run and the winning numbers are
    // written back into render.ts.
    EXPOSURE_SURFACE_QUERY: 'surf',
    EXPOSURE_SKY_QUERY: 'sky',
    OFF_VALUE: 'off'
} as const;
