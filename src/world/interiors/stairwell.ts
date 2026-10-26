// The stair core of an opened-up porch: the landing behind the entrance, the
// dog-leg flights between two storeys, the mid landing, the railings, the spine
// wall and the flat doors that open off it.
//
// Everything is emitted in building-local metres — the same frame the layout
// measured — as four lists: solids (six-faced boxes, merged per material), plates
// (floor and ceiling planes), panes (the dark glass of an interior window) and
// doors (a leaf with a hinge, a collider and a frame). Walk surfaces are emitted
// separately: a floor is something the feet follow, not something they bump into.
import { INTERIOR, ceilingY, floorY, type InteriorBox, type InteriorRect, type RoomKind } from './interiorProfile.js';
import { buildFlatPlan, type FlatOpening, type FlatPlan, type FlatType } from './flatPlans.js';

export type InteriorMaterial = 'plaster' | 'concrete' | 'lino' | 'whitewash' | 'wood' | 'iron' | 'pane';

export interface PlanSolid {
    box: InteriorBox;
    material: InteriorMaterial;
    // Treads and slabs are walk surfaces: the feet follow them, the body does not
    // collide with them.
    collide: boolean;
}

export interface PlanPlate {
    rect: InteriorRect;
    y: number;
    material: InteriorMaterial;
    // true = a floor (faces up), false = a ceiling (faces down).
    up: boolean;
}

export interface PlanPane {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    z: number;
    // Normal along Z: -1 faces the room from the front wall, +1 from the back.
    facing: 1 | -1;
}

export interface PlanDoor {
    id: string;
    level: number;
    kind: 'flat' | 'locked';
    // Hinge, building-local. The closed leaf runs from the hinge towards -Z.
    hingeX: number;
    hingeZ: number;
    width: number;
    height: number;
    // rotation.y of the leaf when it is open.
    swing: number;
    // The closed leaf, used as a collider until the door is opened.
    collider: InteriorBox;
    frame: InteriorBox[];
}

export interface WalkPlate {
    rect: InteriorRect;
    y: number;
}

export interface WalkRamp {
    rect: InteriorRect;
    z0: number;
    z1: number;
    y0: number;
    y1: number;
}

export interface PlanRoom {
    level: number;
    id: string;
    kind: RoomKind;
    rect: InteriorRect;
}

export interface PlanFlat {
    level: number;
    type: FlatType;
    x0: number;
    x1: number;
    side: 1 | -1;
}

export interface StairPlan {
    id: string;
    porchX: number;
    side: 1 | -1;
    levels: number[];
    // Floor of storey 0 and ceiling of the top storey.
    floor: number;
    top: number;
    solids: PlanSolid[];
    plates: PlanPlate[];
    panes: PlanPane[];
    doors: PlanDoor[];
    walkPlates: WalkPlate[];
    ramps: WalkRamp[];
    rooms: PlanRoom[];
    flats: PlanFlat[];
    lights: { x: number; y: number; z: number }[];
    entry: { x: number; z: number };
    exit: { x: number; z: number };
}

// Structural input: exactly the fields interiorSelection computes, so the plan
// module stays independent of the descriptor type (no import cycle).
interface StairPlanInput {
    id: string;
    porchX: number;
    side: 1 | -1;
    levels: number[];
    flats: { level: number; type: FlatType; side: 1 | -1; x0: number; x1: number }[];
}

interface WallRun {
    axis: 'x' | 'z';
    at: number;
    from: number;
    to: number;
    thickness: number;
    y0: number;
    height: number;
    openings: FlatOpening[];
    material: InteriorMaterial;
    collide?: boolean;
}

function emptyPlan(input: StairPlanInput): StairPlan {
    const top = input.levels[input.levels.length - 1] ?? 0;
    return {
        id: input.id,
        porchX: input.porchX,
        side: input.side,
        levels: input.levels.slice(),
        floor: floorY(0),
        top: ceilingY(top),
        solids: [],
        plates: [],
        panes: [],
        doors: [],
        walkPlates: [],
        ramps: [],
        rooms: [],
        flats: [],
        lights: [],
        entry: { x: input.porchX, z: INTERIOR.INNER_FRONT - 0.35 },
        exit: { x: input.porchX, z: 6.3 }
    };
}

function pushSolid(plan: StairPlan, box: InteriorBox, material: InteriorMaterial, collide: boolean): void {
    if (box.maxX - box.minX < 1e-4 || box.maxZ - box.minZ < 1e-4 || box.maxY - box.minY < 1e-4) return;
    plan.solids.push({ box, material, collide });
}

// A wall cut by the openings of its run. The pieces that reach the walking band
// become colliders; the lintel above a doorway does not, so a 2.05 m opening is a
// hole for the body and a wall for the eye.
function pushWall(plan: StairPlan, run: WallRun): void {
    const start = Math.min(run.from, run.to);
    const end = Math.max(run.from, run.to);
    const half = run.thickness / 2;
    const emit = (a0: number, a1: number, b0: number, b1: number): void => {
        if (a1 - a0 < 1e-4 || b1 - b0 < 1e-4) return;
        const box: InteriorBox =
            run.axis === 'x'
                ? {
                      minX: a0,
                      maxX: a1,
                      minZ: run.at - half,
                      maxZ: run.at + half,
                      minY: run.y0 + b0,
                      maxY: run.y0 + b1
                  }
                : {
                      minX: run.at - half,
                      maxX: run.at + half,
                      minZ: a0,
                      maxZ: a1,
                      minY: run.y0 + b0,
                      maxY: run.y0 + b1
                  };
        const collide = run.collide !== false && b0 < INTERIOR.BODY.HIGH && b1 > INTERIOR.BODY.LOW;
        pushSolid(plan, box, run.material, collide);
    };

    const openings = run.openings
        .map((entry) => ({ ...entry, a0: entry.at - entry.width / 2, a1: entry.at + entry.width / 2 }))
        .filter((entry) => entry.a0 >= start - 1e-6 && entry.a1 <= end + 1e-6)
        .sort((left, right) => left.a0 - right.a0);

    let cursor = start;
    openings.forEach((opening) => {
        if (opening.a0 > cursor + 1e-4) emit(cursor, opening.a0, 0, run.height);
        if (opening.sill > 1e-4) emit(opening.a0, opening.a1, 0, opening.sill);
        const head = opening.sill + opening.height;
        if (head < run.height - 1e-4) emit(opening.a0, opening.a1, head, run.height);
        cursor = Math.max(cursor, opening.a1);
    });
    if (cursor < end - 1e-4) emit(cursor, end, 0, run.height);
}

function pushPlate(plan: StairPlan, rect: InteriorRect, y: number, material: InteriorMaterial, up: boolean): void {
    plan.plates.push({ rect, y, material, up });
}

function pushWalk(plan: StairPlan, rect: InteriorRect, y: number): void {
    plan.walkPlates.push({ rect, y });
}

// --- stair core --------------------------------------------------------------

const CORE = INTERIOR.CORE;
const STAIR = INTERIOR.STAIR;
// The entrance of a flat, in the flank wall of the landing: 1.20 m wide, its
// threshold 0.15 m from the back edge of the landing. Exported because the
// validator walks through the same opening the builder cut.
export const FLAT_DOORWAY = {
    AT: 4.05,
    WIDTH: INTERIOR.DOOR.ENTRY,
    HEIGHT: INTERIOR.DOOR.HEIGHT
} as const;

const DOOR_OPENING = { at: FLAT_DOORWAY.AT, width: FLAT_DOORWAY.WIDTH, height: FLAT_DOORWAY.HEIGHT, sill: 0 };

// A doorway with no leaf: the flat is open, the pilot walks in. Only the casing
// is built, and it sits outside the opening so it never narrows the passage.
function addOpenDoorway(plan: StairPlan, level: number, hingeX: number, hingeZ: number): void {
    const width = DOOR_OPENING.width;
    const y = floorY(level);
    const half = INTERIOR.WALL.BEARING / 2;

    pushSolid(
        plan,
        { minX: hingeX - half, maxX: hingeX + half, minZ: hingeZ - width - 0.10, maxZ: hingeZ - width, minY: y, maxY: y + INTERIOR.DOOR.HEIGHT },
        'wood',
        false
    );
    pushSolid(
        plan,
        { minX: hingeX - half, maxX: hingeX + half, minZ: hingeZ, maxZ: hingeZ + 0.10, minY: y, maxY: y + INTERIOR.DOOR.HEIGHT },
        'wood',
        false
    );
    pushSolid(
        plan,
        {
            minX: hingeX - half,
            maxX: hingeX + half,
            minZ: hingeZ - width - 0.10,
            maxZ: hingeZ + 0.10,
            minY: y + INTERIOR.DOOR.HEIGHT,
            maxY: y + INTERIOR.DOOR.HEIGHT + 0.06
        },
        'wood',
        false
    );
}

// A flat that stayed shut: the leaf is part of the wall and never opens. Nobody
// opens a door by hand in this district — a door is either a doorway or a panel.
function addLockedDoor(plan: StairPlan, level: number, hingeX: number, hingeZ: number): void {
    const width = DOOR_OPENING.width - 0.04;
    const height = INTERIOR.DOOR.HEIGHT - 0.05;
    const y = floorY(level);
    // Exactly the flank wall, never a millimetre more: a leaf that juts past the
    // wall face turns the landing into a 5 mm snag for the 0.42 m body.
    const half = INTERIOR.WALL.BEARING / 2;
    plan.doors.push({
        id: `${plan.id}-L${level}-LOCKED`,
        level,
        kind: 'locked',
        hingeX,
        hingeZ,
        width,
        height,
        swing: 0,
        collider: {
            minX: hingeX - half,
            maxX: hingeX + half,
            minZ: hingeZ - width,
            maxZ: hingeZ,
            minY: y,
            maxY: y + height
        },
        frame: [
            { minX: hingeX - half, maxX: hingeX + half, minZ: hingeZ - width - 0.10, maxZ: hingeZ - width, minY: y, maxY: y + INTERIOR.DOOR.HEIGHT },
            { minX: hingeX - half, maxX: hingeX + half, minZ: hingeZ, maxZ: hingeZ + 0.10, minY: y, maxY: y + INTERIOR.DOOR.HEIGHT },
            { minX: hingeX - half, maxX: hingeX + half, minZ: hingeZ - width - 0.10, maxZ: hingeZ + 0.10, minY: y + INTERIOR.DOOR.HEIGHT - 0.06, maxY: y + INTERIOR.DOOR.HEIGHT }
        ]
    });
}

function addFlights(plan: StairPlan, cx: number, level: number, climb: boolean): void {
    const y = floorY(level);
    const innerHalf = CORE.INNER_HALF;
    const spine = INTERIOR.WALL.SPINE / 2;
    const front = STAIR.FLIGHT_FRONT;
    const back = STAIR.FLIGHT_BACK;
    const riser = STAIR.HALF_RISE / STAIR.RISERS;
    const tread = (front - back) / STAIR.RISERS;

    for (let step = 0; step < STAIR.RISERS; step += 1) {
        const z1 = front - step * tread;
        const z0 = front - (step + 1) * tread;
        pushSolid(
            plan,
            { minX: cx - innerHalf, maxX: cx - spine, minZ: z0, maxZ: z1, minY: y + step * riser, maxY: y + (step + 1) * riser },
            'concrete',
            false
        );
        if (!climb) continue;
        const b0 = back + step * tread;
        const b1 = back + (step + 1) * tread;
        pushSolid(
            plan,
            {
                minX: cx + spine,
                maxX: cx + innerHalf,
                minZ: b0,
                maxZ: b1,
                minY: y + STAIR.HALF_RISE + step * riser,
                maxY: y + STAIR.HALF_RISE + (step + 1) * riser
            },
            'concrete',
            false
        );
    }

    // Mid landing at half height, its slab and its walk surface.
    const mid: InteriorRect = { minX: cx - innerHalf, maxX: cx + innerHalf, minZ: CORE.BACK, maxZ: back };
    pushSolid(
        plan,
        { ...mid, minY: y + STAIR.HALF_RISE - INTERIOR.SLAB, maxY: y + STAIR.HALF_RISE },
        'concrete',
        false
    );
    pushWalk(plan, mid, y + STAIR.HALF_RISE);

    // The two flights share one Z span and are separated by the spine wall.
    plan.ramps.push({
        rect: { minX: cx - innerHalf, maxX: cx - spine, minZ: back, maxZ: front },
        z0: back,
        z1: front,
        y0: y + STAIR.HALF_RISE,
        y1: y
    });

    if (climb) {
        plan.ramps.push({
            rect: { minX: cx + spine, maxX: cx + innerHalf, minZ: back, maxZ: front },
            z0: back,
            z1: front,
            y0: y + STAIR.HALF_RISE,
            y1: y + INTERIOR.STOREY
        });
    } else {
        // A porch the district only opened as far as the half landing: the return
        // flight is boarded from the mid landing up, so the climb ends in a wall
        // of planks instead of in a storey that does not exist.
        const wallZ = back - 0.06;
        const top = ceilingY(level);
        pushSolid(
            plan,
            {
                minX: cx + spine,
                maxX: cx + innerHalf,
                minZ: wallZ,
                maxZ: wallZ + 0.06,
                minY: y + STAIR.HALF_RISE,
                maxY: top
            },
            'plaster',
            true
        );
        for (let plank = 0; plank < 3; plank += 1) {
            const bottom = y + STAIR.HALF_RISE + 0.3 + plank * 0.32;
            pushSolid(
                plan,
                {
                    minX: cx + spine + 0.1,
                    maxX: cx + innerHalf - 0.1,
                    minZ: wallZ - 0.04,
                    maxZ: wallZ,
                    minY: bottom,
                    maxY: bottom + 0.22
                },
                'wood',
                false
            );
        }
    }

    // Floor under the stairwell of the entrance storey: the flights start above
    // it, so the void under them never reads as a hole in the world. It stops at
    // the landing edge — two floor plates on one plane would fight for the pixel.
    if (level === plan.levels[0]) {
        const under: InteriorRect = { minX: cx - innerHalf, maxX: cx + innerHalf, minZ: CORE.BACK, maxZ: STAIR.FLIGHT_FRONT };
        pushPlate(plan, under, y, 'concrete', true);
        pushWalk(plan, under, y);
    }
}

function addCore(plan: StairPlan, cx: number, level: number, isTop: boolean, flats: StairPlanInput['flats']): void {
    const y = floorY(level);
    const innerHalf = CORE.INNER_HALF;
    const landing: InteriorRect = { minX: cx - innerHalf, maxX: cx + innerHalf, minZ: CORE.LANDING_BACK, maxZ: INTERIOR.INNER_FRONT };

    pushPlate(plan, landing, y, 'lino', true);
    pushWalk(plan, landing, y);
    pushPlate(plan, landing, ceilingY(level), 'whitewash', false);

    // The doorway walks out through the panel: a threshold plate runs to the
    // facade plane so the crossing happens on solid ground, and a walk-only
    // surface continues onto the stoop, so the feet are already climbing while
    // the pilot is still in the opening.
    if (level === 0) {
        const threshold: InteriorRect = {
            minX: cx - INTERIOR.PORCH_DOOR.WIDTH / 2,
            maxX: cx + INTERIOR.PORCH_DOOR.WIDTH / 2,
            minZ: INTERIOR.INNER_FRONT,
            maxZ: INTERIOR.FACADE_Z
        };
        pushPlate(plan, threshold, y, 'concrete', true);
        pushWalk(plan, { ...threshold, maxZ: INTERIOR.FACADE_Z + 0.45 }, y);
    }

    // Both flanks of the core carry a door: the flat's own leaf on the flat side,
    // a locked leaf on the other. A stairwell-only porch keeps both shut.
    pushWall(plan, {
        axis: 'z',
        at: cx + plan.side * CORE.HALF,
        from: CORE.BACK,
        to: INTERIOR.INNER_FRONT,
        thickness: CORE.WALL,
        y0: y,
        height: INTERIOR.CEILING,
        openings: [DOOR_OPENING],
        material: 'plaster'
    });
    pushWall(plan, {
        axis: 'z',
        at: cx - plan.side * CORE.HALF,
        from: CORE.BACK,
        to: INTERIOR.INNER_FRONT,
        thickness: CORE.WALL,
        y0: y,
        height: INTERIOR.CEILING,
        openings: [DOOR_OPENING],
        material: 'plaster'
    });
    // The flat side of the landing: an open doorway where a flat was opened,
    // a shut leaf where it was not. The opposite flank is always a shut leaf —
    // that is the neighbour the district never opened.
    const flatHingeZ = DOOR_OPENING.at + DOOR_OPENING.width / 2;
    const flatHere = flats.some((flat) => flat.level === level);
    if (flatHere) addOpenDoorway(plan, level, cx + plan.side * CORE.HALF, flatHingeZ);
    else addLockedDoor(plan, level, cx + plan.side * CORE.HALF, flatHingeZ);
    addLockedDoor(plan, level, cx - plan.side * CORE.HALF, flatHingeZ);

    // Back wall of the core, behind the mid landing.
    pushWall(plan, {
        axis: 'x',
        at: CORE.BACK,
        from: cx - innerHalf,
        to: cx + innerHalf,
        thickness: INTERIOR.WALL.PARTITION,
        y0: y,
        height: INTERIOR.CEILING,
        openings: [],
        material: 'plaster'
    });

    // The panel face of the stairwell: the porch doorway on the entrance storey,
    // the landing window above it, exactly where the facade draws its own.
    const opening: FlatOpening =
        level === 0
            ? { at: cx, width: INTERIOR.PORCH_DOOR.WIDTH, height: INTERIOR.PORCH_DOOR.HEIGHT, sill: 0 }
            : {
                  at: cx,
                  width: INTERIOR.STAIR_WINDOW.WIDTH,
                  height: INTERIOR.STAIR_WINDOW.HEIGHT,
                  sill: INTERIOR.STAIR_WINDOW.SILL
              };
    pushWall(plan, {
        axis: 'x',
        at: INTERIOR.INNER_FRONT + INTERIOR.SKIN / 2,
        from: cx - innerHalf,
        to: cx + innerHalf,
        thickness: INTERIOR.SKIN,
        y0: y,
        height: INTERIOR.CEILING,
        openings: [opening],
        material: 'plaster'
    });
    if (level > 0) {
        plan.panes.push({
            minX: cx - INTERIOR.STAIR_WINDOW.WIDTH / 2,
            maxX: cx + INTERIOR.STAIR_WINDOW.WIDTH / 2,
            minY: y + INTERIOR.STAIR_WINDOW.SILL,
            maxY: y + INTERIOR.STAIR_WINDOW.SILL + INTERIOR.STAIR_WINDOW.HEIGHT,
            z: INTERIOR.PANE_Z,
            facing: -1
        });
    }

    // Spine wall between the flights.
    pushSolid(
        plan,
        {
            minX: cx - INTERIOR.WALL.SPINE / 2,
            maxX: cx + INTERIOR.WALL.SPINE / 2,
            minZ: STAIR.FLIGHT_BACK,
            maxZ: STAIR.FLIGHT_FRONT,
            minY: y,
            maxY: y + INTERIOR.CEILING
        },
        'plaster',
        true
    );

    // Railing of the entrance storey only: there the right half of the landing
    // opens over the space under the stairs. Higher up that edge is the arrival
    // of the flight from below, so a guard would fence off the way down.
    if (level === plan.levels[0]) {
        pushSolid(
            plan,
            {
                minX: cx + INTERIOR.WALL.SPINE / 2,
                maxX: cx + innerHalf,
                minZ: STAIR.FLIGHT_FRONT - INTERIOR.WALL.RAIL,
                maxZ: STAIR.FLIGHT_FRONT,
                minY: y,
                maxY: y + 1.0
            },
            'iron',
            true
        );
    }

    if (isTop) {
        // No storey above the last landing: the next flight is boarded up, which
        // is the in-world answer to "the upper floors are out of reach".
        pushSolid(
            plan,
            {
                minX: cx - innerHalf,
                maxX: cx - INTERIOR.WALL.SPINE / 2,
                minZ: STAIR.FLIGHT_FRONT - 0.06,
                maxZ: STAIR.FLIGHT_FRONT,
                minY: y,
                maxY: y + INTERIOR.CEILING
            },
            'plaster',
            true
        );
        for (let plank = 0; plank < 3; plank += 1) {
            const bottom = y + 0.45 + plank * 0.55;
            pushSolid(
                plan,
                {
                    minX: cx - innerHalf + 0.15,
                    maxX: cx - INTERIOR.WALL.SPINE / 2 - 0.05,
                    minZ: STAIR.FLIGHT_FRONT - 0.10,
                    maxZ: STAIR.FLIGHT_FRONT - 0.06,
                    minY: bottom,
                    maxY: bottom + 0.22
                },
                'wood',
                false
            );
        }
        // Cap the stairwell: nothing above means nothing to see above.
        pushPlate(
            plan,
            { minX: cx - innerHalf, maxX: cx + innerHalf, minZ: CORE.BACK, maxZ: STAIR.FLIGHT_FRONT },
            ceilingY(level),
            'whitewash',
            false
        );
    }

    // The flights belong to the storey they leave. The top landing has none above
    // it; a porch with a single storey climbs to its half landing and stops at a
    // boarded return flight.
    if (!isTop) addFlights(plan, cx, level, true);
    else if (plan.levels.length === 1) addFlights(plan, cx, level, false);

    // Threshold of the flat door: the landing plate ends at the inner face of the
    // flank wall and the flat's floor starts at its outer face, so the 0.24 m in
    // between is walked on a plate of its own.
    const flatAtLevel = flats.find((flat) => flat.level === level);
    if (flatAtLevel) {
        const near = cx + plan.side * CORE.INNER_HALF;
        const far = plan.side > 0 ? flatAtLevel.x0 : flatAtLevel.x1;
        const threshold: InteriorRect = {
            minX: Math.min(near, far),
            maxX: Math.max(near, far),
            minZ: DOOR_OPENING.at - DOOR_OPENING.width / 2,
            maxZ: DOOR_OPENING.at + DOOR_OPENING.width / 2
        };
        pushPlate(plan, threshold, y, 'lino', true);
        pushWalk(plan, threshold, y);
    }

    // The landing bulb of the storey the porch is entered from. It is a static
    // fixture of the district, not a light switched on by the player: the porch
    // has to read as the one place in the block that still has a live battery.
    if (level === plan.levels[0]) plan.lights.push({ x: cx, y: y + 2.40, z: 4.10 });
}

// --- flat --------------------------------------------------------------------

function addFlat(plan: StairPlan, flat: StairPlanInput['flats'][number]): void {
    const flatPlan: FlatPlan = buildFlatPlan(flat.type);
    const dir: 1 | -1 = flat.side;
    const y = floorY(flat.level);
    const mapX = (u: number): number => (dir > 0 ? flat.x0 + u : flat.x1 - u);
    const minX = Math.min(flat.x0, flat.x1);
    const maxX = Math.max(flat.x0, flat.x1);

    // One weak bulb of the flat itself, over the hall by the entrance: a room
    // behind three walls gets no moon, and a battery lamp is what a squatter
    // would have left. It is static, like the one on the landing.
    plan.lights.push({ x: mapX(0.75), y: y + 2.30, z: FLAT_DOORWAY.AT - 0.9 });

    pushPlate(plan, { minX, maxX, minZ: INTERIOR.INNER_BACK, maxZ: INTERIOR.INNER_FRONT }, y, 'lino', true);
    pushWalk(plan, { minX, maxX, minZ: INTERIOR.INNER_BACK, maxZ: INTERIOR.INNER_FRONT }, y);
    pushPlate(plan, { minX, maxX, minZ: INTERIOR.INNER_BACK, maxZ: INTERIOR.INNER_FRONT }, ceilingY(flat.level), 'whitewash', false);

    flatPlan.walls.forEach((wall) => {
        if (wall.axis === 'x') {
            pushWall(plan, {
                axis: 'x',
                at: wall.at,
                from: mapX(wall.from),
                to: mapX(wall.to),
                thickness: wall.thickness,
                y0: y,
                height: INTERIOR.CEILING,
                openings: wall.openings.map((opening) => ({ ...opening, at: mapX(opening.at) })),
                material: 'plaster'
            });
        } else {
            pushWall(plan, {
                axis: 'z',
                at: mapX(wall.at),
                from: wall.from,
                to: wall.to,
                thickness: wall.thickness,
                y0: y,
                height: INTERIOR.CEILING,
                openings: wall.openings,
                material: 'plaster'
            });
        }
    });

    flatPlan.windows.forEach((window) => {
        const centre = mapX(window.u);
        const front = window.side === 'front';
        const z = front ? INTERIOR.PANE_Z : -INTERIOR.PANE_Z;
        plan.panes.push({
            minX: centre - window.width / 2,
            maxX: centre + window.width / 2,
            minY: y + INTERIOR.WINDOW.SILL,
            maxY: y + INTERIOR.WINDOW.SILL + INTERIOR.WINDOW.HEIGHT,
            z,
            facing: front ? -1 : 1
        });
        // Window board on the room side: the only "furniture" of the flat, and it
        // belongs to the opening, not to the room.
        const boardZ = front ? z - 0.07 : z + 0.07;
        pushSolid(
            plan,
            {
                minX: centre - window.width / 2 - 0.04,
                maxX: centre + window.width / 2 + 0.04,
                minZ: boardZ - 0.06,
                maxZ: boardZ + 0.06,
                minY: y + INTERIOR.WINDOW.SILL - INTERIOR.WINDOW.SILL_BOARD,
                maxY: y + INTERIOR.WINDOW.SILL
            },
            'wood',
            false
        );
    });

    flatPlan.rooms.forEach((room) => {
        const x0 = mapX(room.minU);
        const x1 = mapX(room.maxU);
        plan.rooms.push({
            level: flat.level,
            id: room.id,
            kind: room.kind,
            rect: { minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minZ: room.minZ, maxZ: room.maxZ }
        });
    });

    plan.flats.push({ level: flat.level, type: flat.type, x0: flat.x0, x1: flat.x1, side: dir });
}

// --- assembly ----------------------------------------------------------------

export function buildStairPlan(input: StairPlanInput): StairPlan {
    const plan = emptyPlan(input);
    const cx = input.porchX;
    const top = plan.levels[plan.levels.length - 1];

    plan.levels.forEach((level) => {
        addCore(plan, cx, level, level === top, input.flats);
    });

    input.flats.forEach((flat) => addFlat(plan, flat));

    // The shared wall behind the core: the flat's own wall continues to the rear
    // facade, the core's flank covers the rest.
    input.flats.forEach((flat) => {
        const dir: 1 | -1 = flat.side;
        pushWall(plan, {
            axis: 'z',
            at: cx + dir * CORE.HALF,
            from: INTERIOR.INNER_BACK,
            to: CORE.BACK,
            thickness: INTERIOR.WALL.BEARING,
            y0: floorY(flat.level),
            height: INTERIOR.CEILING,
            openings: [],
            material: 'plaster'
        });
    });

    return plan;
}
