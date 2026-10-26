// Which porch of which block was opened up, and how much of it is walkable.
//
// The catalogue is authored, not sampled: a building id selects its row, and the
// row is the same on every boot, in the browser and in the Node planner. The ids
// are the decay profiles of khrushchyovkaDecay.ts, so the porch a block can be
// entered through is the porch its history tore the steel leaf off.
//
// The district is deliberately uneven:
//   H1 — full interior: two storeys of a stair core, a one-room flat under a
//        three-room flat;
//   H2 — partial: one storey, one two-room flat, the other flat locked;
//   H3 — closed corpus: no interior at all, the breached porch leads nowhere;
//   H4 — stairwell only: the flights and the landing, every flat door shut.
import { FLAT_LABEL, FLAT_WIDTH, buildFlatPlan, type FlatPlan, type FlatType, type FlatRoom } from './flatPlans.js';
import { INTERIOR, floorY } from './interiorProfile.js';
import { buildStairPlan, type StairPlan } from './stairwell.js';

export type InteriorMode = 'full' | 'partial' | 'stairwell-only';

interface InteriorRoomDescriptor {
    id: string;
    kind: FlatRoom['kind'];
    minU: number;
    maxU: number;
    minZ: number;
    maxZ: number;
}

export interface InteriorFlatDescriptor {
    id: string;
    level: number;
    type: FlatType;
    label: string;
    side: 1 | -1;
    // Clear rectangle of the flat in building-local X.
    x0: number;
    x1: number;
    width: number;
    rooms: InteriorRoomDescriptor[];
}

export interface InteriorDoorwayDescriptor {
    id: string;
    level: number;
    kind: 'flat' | 'locked';
    // Centre of the opening, building-local.
    x: number;
    z: number;
    width: number;
}

export interface InteriorDescriptor {
    buildingId: string;
    enabled: boolean;
    mode: InteriorMode;
    // The one porch of this block that is open, and its local axis.
    porchIndex: number;
    porchX: number;
    side: 1 | -1;
    levels: number[];
    flats: InteriorFlatDescriptor[];
    doorways: InteriorDoorwayDescriptor[];
    entry: { x: number; z: number; yaw: number };
    exit: { x: number; z: number; yaw: number };
    bbox: { minX: number; maxX: number; minZ: number; maxZ: number; minY: number; maxY: number };
    // Number of internal door openings of the whole interior (walls, not leaves).
    openings: number;
}

interface PorchSpec {
    index: number;
    flats: { level: number; type: FlatType; side: 1 | -1 }[];
}

const CATALOGUE: Record<string, PorchSpec[]> = {
    H1: [
        {
            index: 1,
            flats: [
                { level: 0, type: 'one-room', side: 1 },
                { level: 1, type: 'three-room', side: 1 }
            ]
        }
    ],
    H2: [{ index: 2, flats: [{ level: 0, type: 'two-room', side: -1 }] }],
    H3: [],
    H4: [{ index: 1, flats: [] }]
};

// Global switch (?interior=off). It has to be read before the plan is built,
// because the porch walkways and the doorway cuts of the layout depend on it.
let interiorsEnabled = true;

export function setInteriorsEnabled(enabled: boolean): void {
    interiorsEnabled = enabled;
}

export function areInteriorsEnabled(): boolean {
    return interiorsEnabled;
}

// Clear X range of a flat that hangs off the stair core at `porchX`.
function flatSpan(porchX: number, side: 1 | -1, width: number): { x0: number; x1: number } {
    const wall = INTERIOR.CORE.HALF + INTERIOR.CORE.WALL / 2;
    return side > 0
        ? { x0: porchX + wall, x1: porchX + wall + width }
        : { x0: porchX - wall - width, x1: porchX - wall };
}

function describeFlat(porchX: number, level: number, type: FlatType, side: 1 | -1): InteriorFlatDescriptor {
    const plan = buildFlatPlan(type);
    const span = flatSpan(porchX, side, plan.width);
    return {
        id: `${type}-L${level}`,
        level,
        type,
        label: FLAT_LABEL[type],
        side,
        x0: Math.round(span.x0 * 1000) / 1000,
        x1: Math.round(span.x1 * 1000) / 1000,
        width: FLAT_WIDTH[type],
        rooms: plan.rooms.map((entry) => ({ ...entry }))
    };
}

function buildDescriptor(buildingId: string, porch: PorchSpec, porchX: number): InteriorDescriptor {
    const flats = porch.flats.map((entry) => describeFlat(porchX, entry.level, entry.type, entry.side));
    const levels = Array.from(new Set<number>([0, ...flats.map((entry) => entry.level)])).sort((left, right) => left - right);
    // The porch side the flats live on; a stairwell-only porch still owns both
    // flanks, so the default is the courtyard-facing right bay.
    const side: 1 | -1 = flats.length > 0 ? flats[0].side : 1;
    const topLevel = levels[levels.length - 1];
    const topPlan: FlatPlan | null = flats.length > 0 ? buildFlatPlan(flats[flats.length - 1].type) : null;

    const doorways: InteriorDoorwayDescriptor[] = [];
    levels.forEach((level) => {
        const flatHere = flats.find((entry) => entry.level === level);
        doorways.push({
            id: `${buildingId}-D${level}-FLAT`,
            level,
            kind: flatHere ? 'flat' : 'locked',
            x: porchX + side * INTERIOR.CORE.HALF,
            z: 4.05,
            width: INTERIOR.DOOR.ENTRY
        });
        doorways.push({
            id: `${buildingId}-D${level}-LOCKED`,
            level,
            kind: 'locked',
            x: porchX - side * INTERIOR.CORE.HALF,
            z: 4.05,
            width: INTERIOR.DOOR.ENTRY
        });
    });

    // A little over the flank wall: the door leaf and its frame sit on that
    // centreline, and the bounding box has to hold the collider of a shut door.
    const coreOuter = INTERIOR.CORE.HALF + INTERIOR.CORE.WALL / 2 + 0.06;
    const flatOuter = topPlan ? topPlan.width + INTERIOR.WALL.BEARING : 0;
    const xLeft = side > 0 ? porchX - coreOuter : porchX - coreOuter - flatOuter;
    const xRight = side > 0 ? porchX + coreOuter + flatOuter : porchX + coreOuter;

    return {
        buildingId,
        enabled: true,
        mode: flats.length === 0 ? 'stairwell-only' : levels.length > 1 ? 'full' : 'partial',
        porchIndex: porch.index,
        porchX,
        side,
        levels,
        flats,
        doorways,
        entry: { x: porchX, z: INTERIOR.INNER_FRONT - 0.35, yaw: 0 },
        exit: { x: porchX, z: 6.3, yaw: Math.PI },
        bbox: {
            minX: Math.round(xLeft * 1000) / 1000,
            maxX: Math.round(xRight * 1000) / 1000,
            minZ: INTERIOR.INNER_BACK - INTERIOR.SKIN,
            maxZ: INTERIOR.FACADE_Z,
            minY: floorY(0),
            maxY: floorY(topLevel) + INTERIOR.CEILING
        },
        openings: flats.reduce((total, entry) => total + buildFlatPlan(entry.type).walls.reduce((count, wall) => count + wall.openings.filter((opening) => opening.sill === 0).length, 0), 0)
    };
}

// The interior of a block, or null when the block never had one opened.
export function interiorSelectionFor(buildingId: string, porchXs: number[]): InteriorDescriptor | null {
    if (!interiorsEnabled) return null;
    const rows = CATALOGUE[buildingId];
    if (!rows || rows.length === 0) return null;
    const porch = rows[0];
    const porchX = porchXs[porch.index];
    if (porchX === undefined) return null;
    return buildDescriptor(buildingId, porch, porchX);
}

// Full drawing of one interior: every wall, slab, flight and door leaf. Pure
// data, so the validator and the runtime walk the same plan the builder meshes.
export function interiorPlanFor(descriptor: InteriorDescriptor): StairPlan {
    return buildStairPlan({
        id: `${descriptor.buildingId}-${descriptor.porchIndex}-I`,
        porchX: descriptor.porchX,
        side: descriptor.side,
        levels: descriptor.levels,
        flats: descriptor.flats
    });
}
