// Shared diorama geometry constants. The fixed 108×108 plan (roads, zones,
// placements, clearances) lives in src/config/layout.js and builds on these sizes.

export const DIORAMA = {
    SIZE: 108,
    DEPTH: 6.5,
    // 108 / 128 = 0.84375 — the same lighting-grid density the 54-wide island used.
    GROUND_SEGMENTS: 128,
    TERRAIN_FREQUENCY: 0.35,
    TERRAIN_AMPLITUDE: 0.04,
    TERRAIN_EDGE_RATIO: 0.46,
    PEDESTAL_GAP: 0.02,
    SUB_BASE_INSET: 1.2,
    SUB_BASE_HEIGHT: 1.8,
    WALK_MARGIN: 1.4
} as const;

// Height scale above the ground plane. Pavement is a thin plate, so the terrain
// inside every road/sidewalk/building mask is flattened before those plates are laid.
export const SURFACE = {
    GROUND: 0,
    ASPHALT: 0.02,
    PAVING: 0.04,
    CURB_TOP: 0.12,
    OVERLAY: 0.005,
    FLATTEN_EDGE: 0.5,
    FLATTEN_BLEND: 1.0
} as const;
