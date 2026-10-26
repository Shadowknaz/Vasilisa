// Typical Soviet flat plans of a Khrushchyovka section, as pure data.
//
// One grammar for all three: the entrance from the stair landing is in the shared
// wall at the front of the flat, a hall runs back along that wall, the kitchen and
// the wet rooms sit at the courtyard face beside it, and the living rooms fill the
// rear. `u` runs from the shared wall into the flat, `z` is the building's own
// local axis, +Z towards the courtyard facade.
//
// No furniture, no decoration and no leaves between rooms: openings, not doors.
// Every room a person lives in touches a facade, every wet room and larder is the
// dark box in the middle — exactly how these blocks were built.
import { INTERIOR, roomIsLit, type RoomKind } from './interiorProfile.js';

export type FlatType = 'one-room' | 'two-room' | 'three-room';

export interface FlatRoom {
    id: string;
    kind: RoomKind;
    minU: number;
    maxU: number;
    minZ: number;
    maxZ: number;
}

export interface FlatOpening {
    // Centre of the opening along the wall run, metres.
    at: number;
    width: number;
    height: number;
    sill: number;
}

export interface FlatWallSpec {
    // 'x' runs the wall along X at z = at, 'z' along Z at x = at.
    axis: 'x' | 'z';
    at: number;
    from: number;
    to: number;
    thickness: number;
    openings: FlatOpening[];
}

export interface FlatWindow {
    roomId: string;
    side: 'front' | 'back';
    u: number;
    width: number;
}

export interface FlatPlan {
    type: FlatType;
    width: number;
    rooms: FlatRoom[];
    walls: FlatWallSpec[];
    windows: FlatWindow[];
}

// Clear width of each type. They stay under the 9 m bay between two porch cores,
// so a flat always fits beside the stairwell it belongs to.
export const FLAT_WIDTH: Record<FlatType, number> = {
    'one-room': 3.6,
    'two-room': 5.4,
    'three-room': 7.2
};

export const FLAT_LABEL: Record<FlatType, string> = {
    'one-room': '1К',
    'two-room': '2К',
    'three-room': '3К'
};

const Z_FRONT = INTERIOR.INNER_FRONT;
const Z_BACK = INTERIOR.INNER_BACK;

function door(at: number): FlatOpening {
    return { at, width: INTERIOR.DOOR.WIDTH, height: INTERIOR.DOOR.INNER_HEIGHT, sill: 0 };
}

function windowOpening(at: number, width: number): FlatOpening {
    return { at, width, height: INTERIOR.WINDOW.HEIGHT, sill: INTERIOR.WINDOW.SILL };
}

function wallZ(at: number, from: number, to: number, openings: FlatOpening[], thickness: number = INTERIOR.WALL.PARTITION): FlatWallSpec {
    return { axis: 'x', at, from, to, thickness, openings };
}

function wallU(at: number, from: number, to: number, openings: FlatOpening[], thickness: number = INTERIOR.WALL.PARTITION): FlatWallSpec {
    return { axis: 'z', at, from, to, thickness, openings };
}

// The exterior skin of the flat: a panel wall carrying the windows of the rooms
// behind it. It hangs off the room-side face of the front/back wall, so the
// facade's own sash and this opening never share a plane.
function skinZ(innerFace: number, width: number, windows: FlatWindow[]): FlatWallSpec {
    const at = innerFace + Math.sign(innerFace) * (INTERIOR.SKIN / 2);
    return {
        axis: 'x',
        at,
        from: 0,
        to: width,
        thickness: INTERIOR.SKIN,
        openings: windows.map((entry) => windowOpening(entry.u, entry.width))
    };
}

function room(id: string, kind: RoomKind, minU: number, maxU: number, minZ: number, maxZ: number): FlatRoom {
    return { id, kind, minU, maxU, minZ, maxZ };
}

// One window per lit room, centred on the room and kept off its corners. Rooms
// that touch neither facade (wet rooms, larders, the hall) carry none: they are
// the dark boxes of the plan, exactly as they were built.
function windowsOf(rooms: FlatRoom[]): FlatWindow[] {
    const windows: FlatWindow[] = [];
    rooms.forEach((entry) => {
        if (!roomIsLit(entry.kind)) return;
        const side = entry.maxZ >= Z_FRONT - 1e-6 ? 'front' : entry.minZ <= Z_BACK + 1e-6 ? 'back' : null;
        if (!side) return;
        const span = entry.maxU - entry.minU;
        const width = Math.min(INTERIOR.WINDOW.WIDTH, span - 0.70);
        if (width < 0.90) return;
        const margin = width / 2 + 0.30;
        const centre = (entry.minU + entry.maxU) / 2;
        const u = Math.min(Math.max(centre, entry.minU + margin), entry.maxU - margin);
        windows.push({ roomId: entry.id, side, u: Math.round(u * 100) / 100, width: Math.round(width * 100) / 100 });
    });
    return windows;
}

function windowsOn(windows: FlatWindow[], side: 'front' | 'back'): FlatWindow[] {
    return windows.filter((entry) => entry.side === side);
}

interface LayoutSpec {
    rooms: FlatRoom[];
    walls: (width: number, windows: FlatWindow[]) => FlatWallSpec[];
}

// --- one-room flat -----------------------------------------------------------
// Enter off the landing into a hall down the shared wall, kitchen at the
// courtyard face, combined bathroom behind the hall, one big room at the rear.
// 34 m² — the classic малометражка.
const ONE_ROOM: LayoutSpec = {
    rooms: [
        room('hall', 'hall', 0, 1.5, 1.7, Z_FRONT),
        room('kitchen', 'kitchen', 1.5, 3.6, 2.9, Z_FRONT),
        room('bath', 'bath', 1.5, 3.6, 1.7, 2.9),
        room('room', 'room', 0, 3.6, Z_BACK, 1.7)
    ],
    walls: (width, windows) => [
        wallZ(1.7, 0, width, [door(0.75)]),
        wallU(1.5, 1.7, Z_FRONT, [door(2.3), door(4.15)]),
        wallU(width, Z_BACK, Z_FRONT, [], INTERIOR.WALL.BEARING),
        skinZ(Z_BACK, width, windowsOn(windows, 'back')),
        skinZ(Z_FRONT, width, windowsOn(windows, 'front'))
    ]
};

// --- two-room flat -----------------------------------------------------------
// The same hall, a wider kitchen across the courtyard face, bathroom and larder
// in the middle, a walk-through pair of living rooms at the rear. 42 m².
const TWO_ROOM: LayoutSpec = {
    rooms: [
        room('hall', 'hall', 0, 1.5, 1.5, Z_FRONT),
        room('kitchen', 'kitchen', 1.5, 5.4, 2.9, Z_FRONT),
        room('bath', 'bath', 1.5, 2.9, 1.5, 2.9),
        room('larder', 'larder', 2.9, 3.6, 1.5, 2.9),
        room('room-1', 'room', 1.5, 3.6, Z_BACK, 1.5),
        room('room-2', 'room', 3.6, 5.4, Z_BACK, 2.9)
    ],
    walls: (width, windows) => [
        wallZ(1.5, 0, 3.6, [door(0.75)]),
        wallU(1.5, 1.5, Z_FRONT, [door(2.25), door(4.15)]),
        wallU(2.9, 1.5, 2.9, []),
        wallZ(2.9, 1.5, 2.9, []),
        wallU(3.6, Z_BACK, 2.9, [door(-2.6)]),
        wallZ(2.9, 3.6, width, []),
        wallU(width, Z_BACK, Z_FRONT, [], INTERIOR.WALL.BEARING),
        skinZ(Z_BACK, width, windowsOn(windows, 'back')),
        skinZ(Z_FRONT, width, windowsOn(windows, 'front'))
    ]
};

// --- three-room flat ---------------------------------------------------------
// Hall, kitchen and a large bathroom block on the courtyard side, a third room
// beside them, two living rooms across the rear. 69 m² — the "improved layout"
// of the later series, still with one walk-through pair.
const THREE_ROOM: LayoutSpec = {
    rooms: [
        room('hall', 'hall', 0, 1.5, 1.5, Z_FRONT),
        room('kitchen', 'kitchen', 1.5, 4.0, 2.9, Z_FRONT),
        room('bath', 'bath', 1.5, 3.0, 1.5, 2.9),
        room('larder', 'larder', 3.0, 4.0, 1.5, 2.9),
        room('room-3', 'room', 4.0, 7.2, 1.5, Z_FRONT),
        room('room-1', 'room', 0, 3.6, Z_BACK, 1.5),
        room('room-2', 'room', 3.6, 7.2, Z_BACK, 1.5)
    ],
    walls: (width, windows) => [
        wallZ(1.5, 0, width, [door(0.75), door(5.9)]),
        wallU(1.5, 1.5, Z_FRONT, [door(2.25), door(4.15)]),
        wallU(3.0, 1.5, 2.9, []),
        wallZ(2.9, 1.5, 3.0, []),
        wallU(4.0, 1.5, Z_FRONT, []),
        wallU(3.6, Z_BACK, 1.5, [door(-1.0)]),
        wallU(width, Z_BACK, Z_FRONT, [], INTERIOR.WALL.BEARING),
        skinZ(Z_BACK, width, windowsOn(windows, 'back')),
        skinZ(Z_FRONT, width, windowsOn(windows, 'front'))
    ]
};

const LAYOUTS: Record<FlatType, LayoutSpec> = {
    'one-room': ONE_ROOM,
    'two-room': TWO_ROOM,
    'three-room': THREE_ROOM
};

export function buildFlatPlan(type: FlatType): FlatPlan {
    const layout = LAYOUTS[type];
    const width = FLAT_WIDTH[type];
    const windows = windowsOf(layout.rooms);
    return {
        type,
        width,
        rooms: layout.rooms.map((entry) => ({ ...entry })),
        walls: layout.walls(width, windows),
        windows
    };
}
