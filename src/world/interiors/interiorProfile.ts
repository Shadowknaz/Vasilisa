// Dimensions of the walkable interior of a Khrushchyovka. The numbers are metres
// in the building-local frame of the frozen layout (footprints.ts), and every one
// of them is hung off the profile the facade was built with:
//
//   facade plane   DEPTH/2 - BODY_INSET.PANEL = 4.79 + 0.40
//   front wall     0.40 m panel, room side at 4.79
//   floor          plinth top 1.10 — the porch door threshold of the skin
//   storey         3.90, ceiling 3.64, slab 0.26
//
// The vertical stack follows the taller block (KHRUSHCHYOVKA.FLOOR_HEIGHT
// 3.0 × 1.3): ceiling and slab scale with the storey so the core walls still
// reach the floor plate above them, while doors, windows and the plinth keep
// their human size — only the panel grid around them grew.
//
// This module deliberately imports nothing: the planner (layout/footprints.ts)
// reads it before any world module exists, and validateLayout() re-measures every
// number below against KHRUSHCHYOVKA so a drift is a hard error, not a silent one.
export const INTERIOR = {
    // Visible facade plane and the wall behind it.
    FACADE_Z: 5.19,
    EXTERIOR_WALL: 0.40,
    INNER_FRONT: 4.79,
    INNER_BACK: -4.79,
    // The interior skin of the exterior wall. Rooms end here; the pane sits at
    // PANE_Z and the facade's own sash decal lives 18 cm further out, so the two
    // never share a plane.
    SKIN: 0.26,
    PANE_Z: 5.05,
    // Floor of storey 0 and the storey height. floorY(storey) = FLOOR + STOREY·s,
    // which is exactly floorBaseY() of the shell, so every interior window lands
    // on the sash of the facade above it.
    FLOOR: 0.10,
    STOREY: 3.90,
    CEILING: 3.64,
    SLAB: 0.26,

    WALL: {
        // Panel walls of the section (the core's flanks, the flat's outer wall).
        BEARING: 0.24,
        PARTITION: 0.12,
        RAIL: 0.06,
        SPINE: 0.10
    },

    DOOR: {
        // Clear width of a doorway between rooms. The pilot's collider is a
        // 0.42 m circle, so a 0.90 m opening would only pass a perfectly centred
        // walker; 1.10 keeps a metre of clear passage once the frame is on.
        WIDTH: 1.10,
        // The entrance of a flat opens straight off the landing: the widest leaf
        // of the plan, 1.20 m, and the only one that is ever a leaf at all.
        ENTRY: 1.20,
        HEIGHT: 2.05,
        LEAF: 0.045,
        // Openings of a flat: plain reveals inside.
        INNER_HEIGHT: 2.00,
        FRAME: 0.06
    },

    WINDOW: {
        WIDTH: 1.50,
        HEIGHT: 1.50,
        SILL: 0.80,
        SILL_BOARD: 0.06
    },

    // Stair window of the landing: the facade uses 1.25 × 1.8 centred 1.55 above
    // the storey floor (khrushchyovkaFacade WINDOW.STAIR), and the landing is at
    // the porch column, so the two openings coincide.
    STAIR_WINDOW: {
        WIDTH: 1.25,
        HEIGHT: 1.80,
        SILL: 0.65
    },

    // The doorway cut through the panel at ground level threshold.
    PORCH_DOOR: {
        WIDTH: 1.80,
        HEIGHT: 2.25
    },

    // Stair core of a porch bay. 2.70 m overall (2.50 clear) — narrower than the
    // 2.80 m porch, the way a real подъезд is a shaft behind a wider stoop. The
    // landing is 1.50 m deep: enough for the two flat doors, not a hall.
    CORE: {
        HALF: 1.35,
        WALL: 0.20,
        INNER_HALF: 1.25,
        // Inner face of the core's back wall (behind the mid landing).
        BACK: -0.80,
        // Front edge of the flights = back edge of the landing.
        LANDING_BACK: 3.30
    },

    // Dog-leg stair between two storeys: two 1.20 m flights side by side, twelve
    // risers of 0.1625 over a 0.233 tread, one 1.30 m mid landing at half height.
    // The pitch follows the taller storey but stays a real 1-464 flight, not a
    // short steep ladder: flight length is fixed by the core, so the riser count
    // grew with the storey instead of the tread.
    STAIR: {
        FLIGHT_BACK: 0.50,
        FLIGHT_FRONT: 3.30,
        RISERS: 12,
        HALF_RISE: 1.95
    },

    // Vertical tolerance of a single walking step. Threshold is smooth (~0.05-0.10 m),
    // and stair risers are 0.1625 m.
    STEP_UP: 0.40,
    // The body the interior colliders are measured against (child height ~1.28 m).
    BODY: { LOW: 0.10, HIGH: 1.28 },

    // Feet follow the floor height with this rate.
    HEIGHT_RATE: 11
} as const;

export interface InteriorBox {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    minY: number;
    maxY: number;
}

export interface InteriorRect {
    minX: number;
    minZ: number;
    maxX: number;
    maxZ: number;
}

// Room kinds share one vocabulary between the plans, the debug labels and the
// window rule: everything but a wet room, a larder and a hall gets daylight.
export type RoomKind = 'room' | 'kitchen' | 'bath' | 'hall' | 'larder';

export function roomIsLit(kind: RoomKind): boolean {
    return kind === 'room' || kind === 'kitchen';
}

export function floorY(storey: number): number {
    return INTERIOR.FLOOR + storey * INTERIOR.STOREY;
}

export function ceilingY(storey: number): number {
    return floorY(storey) + INTERIOR.CEILING;
}
