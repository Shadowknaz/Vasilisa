// Prefab footprint profiles and the descriptor factory. Local parts are declared
// once here; every world collider, access point and validator measurement
// is derived from the single transform of the descriptor (TZ §9).
import {
    BOOTH,
    BUILDINGS,
    DECOR,
    FENCE_RUNS,
    FUNCTIONAL_ZONES,
    KIOSK,
    PIPELINE,
    PLAY_FENCES,
    PLAYGROUND,
    POLES,
    TREES,
    YARD
} from '../../config/layout.js';
import { createRect, expandRect, type Rect } from './rect.js';
import { interiorSelectionFor, type InteriorDescriptor } from '../interiors/interiorSelection.js';
import { INTERIOR } from '../interiors/interiorProfile.js';

// A local axis-aligned box: a Rect plus the vertical extent (minY/maxY).
export interface Box extends Rect {
    minY: number;
    maxY: number;
}

export interface ObjectTransform {
    x: number;
    y: number;
    z: number;
    rotY: number;
}

interface AccessPointLocal {
    x: number;
    z: number;
    yaw: number;
}

interface AccessPointInput {
    id: string;
    local: AccessPointLocal;
    world?: AccessPointLocal;
    porchX?: number;
}

export interface AccessPoint {
    id: string;
    local: AccessPointLocal;
    world: AccessPointLocal;
    porchX?: number;
}

export interface ObjectReservation {
    id: string;
    kind: string;
    rect: Rect;
    strict?: boolean;
}

export interface ObjectDescriptor {
    id: string;
    type: string;
    transform: ObjectTransform;
    parameters: Record<string, any>;
    physicalFootprints: Box[];
    visualFootprint: Box | null;
    worldFootprints: Box[];
    worldVisualFootprint: Box | null;
    accessPoints: AccessPoint[];
    reservations: ObjectReservation[];
    ownerZone: string | null;
}

interface ObjectInput {
    id: string;
    type: string;
    transform: ObjectTransform;
    parameters?: Record<string, any>;
    parts?: Box[];
    visual?: Box | null;
    accessPoints?: AccessPointInput[];
    reservations?: ObjectReservation[];
    ownerZone?: string | null;
}

interface WorldFootprintRecord {
    objectId: string;
    type: string;
    index: number;
    rect: Box;
    ownerZone: string | null;
}

export type YardFenceRun =
    | { id: string; axis: 'x'; x0: number; x1: number; z: number }
    | { id: string; axis: 'z'; z0: number; z1: number; x: number };

const YARD_ZONE = FUNCTIONAL_ZONES.find((zone) => zone.id === 'TP_YARD')!;

const PRECISION = 1e6;

// Yaw step of the tree models: a decorative rotation, never a plan value.
const TREE_ROTATION_STEP = 0.9;

function round(value: number): number {
    return Math.round(value * PRECISION) / PRECISION;
}

export const KHRUSHCHYOVKA = {
    SECTION_WIDTH: 6.0,
    DEPTH: 10.5,
    FLOORS: 5,
    // Storey height of the current art direction: the ported 1-464 block stood
    // 5 × 3.0 m, the district now stands 30 % taller (3.0 × 1.3). No plan
    // coordinate moves — the footprint, the plinth (interior floor and porch
    // threshold) and the porches keep their authored values, so the whole
    // difference lands in the storey: every window row, balcony, slab band and
    // the roof follow floorBaseY() / createBodyShape() off this one number.
    FLOOR_HEIGHT: 3.9,
    PLINTH_HEIGHT: 0.1,
    PORCH: {
        SECTION_STEP: 2,
        OFFSET_X: -1.3,
        STEPS_WIDTH: 2.8,
        STEPS_DEPTH: 1.8,
        STEPS_Z_OFFSET: 0.85,
        CANOPY_WIDTH: 3.06,
        CANOPY_DEPTH: 2.15,
        CANOPY_Z_OFFSET: 0.95,
        // Solid part = steps + support pillar. The canopy hangs at y 2.78 and must
        // not block the pilot, so it stays out of the physical footprint.
        HALF_WIDTH: 1.4,
        MIN_Z: 5.2,
        MAX_Z: 7.0,
        HEIGHT: 3.0
    },
    // TZ §6.2 conservative silhouette: local X ±15.8, Z −5.5…7.4, up to 22.5
    // high — the stair bulkhead and its lid on top of the taller roof slab
    // (plinth 1.1 + 5 × 3.9 = 20.6, + tar 0.14, + bulkhead 1.6, + lid 0.12).
    VISUAL_MARGIN_X: 0.8,
    VISUAL_MIN_Z: -5.5,
    VISUAL_MAX_Z: 7.4,
    VISUAL_MAX_Y: 22.5,
    // Safe stand line in front of the porch (pilot radius + margin), TZ §6.4.6.
    ENTRANCE_LOCAL_Z: 8.0
};

export const KIOSK_PROFILE = {
    PLINTH: { WIDTH: 3.4, DEPTH: 4.4, HEIGHT: 0.18 },
    BODY: { WIDTH: 3.2, DEPTH: 4.2, HEIGHT: 2.55, Y: 1.455 },
    ROOF: {
        WIDTH: 3.5,
        DEPTH: 4.7,
        HEIGHT: 0.14,
        FRONT_OVERHANG: 0.4,
        BACK_OVERHANG: 0.2,
        RISE: 0.26,
        Y: 2.94
    },
    SHUTTER: { WIDTH: 3.0, HEIGHT: 1.15, DEPTH: 0.07, Y: 1.35, Z: 2.14 },
    SIGN: { WIDTH: 2.5, HEIGHT: 0.4, DEPTH: 0.05, Y: 2.62, Z: 2.12 },
    COUNTER: { WIDTH: 2.6, HEIGHT: 0.16, DEPTH: 0.3, Y: 1.05, Z: 2.16 },
    DOOR: { WIDTH: 0.8, HEIGHT: 2.0, DEPTH: 0.06, X: 1.05, Y: 1.18, Z: -2.11 },
    SHUTTER_RESERVE: 0.6
};

export const BOOTH_PROFILE = {
    PLINTH: { WIDTH: 3.5, HEIGHT: 0.45, DEPTH: 3.1 },
    BODY: { WIDTH: 3.4, HEIGHT: 2.8, DEPTH: 3.0, Y: 1.8 },
    ROOF: { WIDTH: 3.75, HEIGHT: 0.28, DEPTH: 3.35, Y: 3.35 },
    DOOR: { WIDTH: 1.4, HEIGHT: 2.1, DEPTH: 0.16, Y: 1.15, Z: -1.52 },
    VENT: { WIDTH: 1.5, HEIGHT: 0.9, DEPTH: 0.08, Y: 2.35, Z: -1.52 },
    PLATE: { WIDTH: 0.5, HEIGHT: 0.32, DEPTH: 0.04, X: 1.1, Y: 2.5, Z: -1.52 }
};

export const PLAYGROUND_PROFILE = {
    SANDBOX: { SIZE: 5.8, CURB_LENGTH: 5.2, CURB_HEIGHT: 0.32, CURB_THICKNESS: 0.35, CURB_RADIUS: 2.5 },
    ROCKET: { VISUAL_RADIUS: 1.5, COLLIDER_RADIUS: 1.4 },
    SWING: { VISUAL_HALF_WIDTH: 1.6, VISUAL_HALF_DEPTH: 0.85, COLLIDER_HALF_WIDTH: 1.6, COLLIDER_HALF_DEPTH: 0.9 }
};

export const TREE_PROFILE = {
    COLLIDER_RADIUS: 0.45,
    // Crown cap and trunk height are the plan's budget, not the model's: the
    // builder fits both bare crowns inside them so the clearance checks stay
    // honest (TZ §6.5).
    CROWN_RADIUS: 3.2,
    TRUNK_HEIGHT: 9.0,
    // Winter dressing: the lime-washed bottom of the trunk and the trunk radius
    // the snow mound is built around. Both are measured by nothing — they are
    // here because trees.ts and the snow fields share them.
    TRUNK_RADIUS: 0.26,
    WHITEWASH_HEIGHT: 1.8
};

export type WinterTreeType = 'poplar' | 'spreading';

// Low welded lawn fence around the playground. Low enough to read as a border,
// solid enough that the pilot walks around it (TZ §6.4 keeps the link open).
export const LAWN_FENCE_PROFILE = {
    HEIGHT: 0.44,
    THICKNESS: 0.12,
    BAY: 0.8
};

// Wind-blown snow on a lawn: a scatter of drifts, no plate. The height is what
// the descriptor reserves for the surface field.
const SNOW_PATCH_PROFILE = {
    VISUAL_HEIGHT: 0.46
};

// Cast-iron manhole: a rim ring and a cover plate, both flush with the asphalt.
// Sized up from the reference so the lid still reads as a lid at the iso distance.
export const MANHOLE_PROFILE = {
    RING_RADIUS: 0.5,
    COVER_RADIUS: 0.36,
    COVER_HEIGHT: 0.035,
    VISUAL_HEIGHT: 0.09
};

// PAG-14 plate field: 1.05 x 0.9 m slabs with a frozen joint between them.
export const PAG_SLAB_PROFILE = {
    PLATE_WIDTH: 1.05,
    PLATE_DEPTH: 0.9,
    GAP: 0.03,
    THICKNESS: 0.07
};

export function pagSlabSize(cols: number, rows: number): { width: number; depth: number } {
    return {
        width: cols * PAG_SLAB_PROFILE.PLATE_WIDTH + Math.max(0, cols - 1) * PAG_SLAB_PROFILE.GAP,
        depth: rows * PAG_SLAB_PROFILE.PLATE_DEPTH + Math.max(0, rows - 1) * PAG_SLAB_PROFILE.GAP
    };
}

export const POLE_PROFILE = {
    RADIUS_TOP: 0.14,
    RADIUS_BOTTOM: 0.22,
    COLLIDER_RADIUS: 0.35,
    ARM: { WIDTH: 1.4, HEIGHT: 0.1, DEPTH: 0.1, X_OFFSET: 0.6, Y_OFFSET: -0.4 }
};

export const PIPELINE_PROFILE = {
    PIPE_RADIUS: 0.25,
    PIPE_SEGMENTS: 6,
    PIPE_Z_OFFSET: 0.28,
    UNDER_BEAM: { HEIGHT: 0.16, DEPTH: 0.38 },
    PILLAR: { WIDTH: 0.58, DEPTH: 0.95 },
    BLOCKER_HALF_DEPTH: 0.55
};

// PO-2 concrete fence. HEIGHT is the post top; the collider envelope adds half
// of it to Y so the snow cap is inside the solid the pilot walks around.
export const FENCE_PROFILE = {
    SECTION: {
        WIDTH: 2.5,
        HEIGHT: 2.0,
        THICKNESS: 0.16,
        Y: 1.15
    },
    YARD_HEIGHT: 1.55,
    YARD_THICKNESS: 0.16,
    YARD_POST: { WIDTH: 0.2, DEPTH: 0.2, HEIGHT: 1.7 }
};

export const FBS_PROFILE = {
    WIDTH: 2.4,
    HEIGHT: 0.82,
    DEPTH: 0.8
};

export const BARREL_PROFILE = {
    RADIUS: 0.36,
    HEIGHT: 1.05,
    SEGMENTS: 7,
    STANDING_Y: 0.52,
    TILTED_Y: 0.36,
    TILT_ROT_Y: 0.6,
    COLLIDER_RADIUS: 0.45
};

// Laundry frame: two posts carrying three sagging wires. The posts are the only
// solid part; the wires hang high enough to be walked under but the whole frame
// still stays off every mech corridor (MECH_PASSAGE).
export const LAUNDRY_PROFILE = {
    POST: { WIDTH: 0.12, DEPTH: 0.12, HEIGHT: 2.2 },
    SPAN: 3.2,
    WIRES: 3,
    ANCHOR_Y: 2.0,
    SAG: 0.25,
    RUG: { WIDTH: 1.5, HEIGHT: 1.0, TOP: 1.95 }
};

// Galvanised refuse container: a box with a lid, wide enough to read at the iso
// distance and to hold its own collider.
export const BIN_PROFILE = {
    WIDTH: 1.05,
    DEPTH: 0.75,
    HEIGHT: 1.1,
    LID_HEIGHT: 0.06
};

// Storm-water grate: a recessed frame with cross bars, flush with the asphalt.
export const GRATE_PROFILE = {
    WIDTH: 0.72,
    DEPTH: 0.46,
    HEIGHT: 0.04,
    BARS: 6
};

// --- transform helpers -------------------------------------------------------

function rotateLocal(localX: number, localZ: number, rotY: number): { x: number; z: number } {
    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);
    // TZ convention: xw = xo + xl·cos + zl·sin, zw = zo − xl·sin + zl·cos.
    return {
        x: localX * cos + localZ * sin,
        z: -localX * sin + localZ * cos
    };
}

export function transformPoint(transform: ObjectTransform, localX: number, localZ: number): { x: number; z: number } {
    const offset = rotateLocal(localX, localZ, transform.rotY);
    return { x: round(transform.x + offset.x), z: round(transform.z + offset.z) };
}

function transformYaw(transform: ObjectTransform, localYaw: number): number {
    return localYaw + transform.rotY;
}

// Axis-aligned world bounds of a rotated local rectangle. All plan rotations are
// multiples of π/2, so the result is exact rather than a loose envelope.
function transformRect(transform: ObjectTransform, rect: Rect): Rect {
    const corners = [
        transformPoint(transform, rect.minX, rect.minZ),
        transformPoint(transform, rect.maxX, rect.minZ),
        transformPoint(transform, rect.maxX, rect.maxZ),
        transformPoint(transform, rect.minX, rect.maxZ)
    ];
    return createRect(
        Math.min(...corners.map((corner) => corner.x)),
        Math.min(...corners.map((corner) => corner.z)),
        Math.max(...corners.map((corner) => corner.x)),
        Math.max(...corners.map((corner) => corner.z))
    );
}

function transformFootprint(transform: ObjectTransform, footprint: Box): Box {
    const rect = transformRect(transform, footprint);
    return {
        ...rect,
        minY: (transform.y || 0) + footprint.minY,
        maxY: (transform.y || 0) + footprint.maxY
    };
}

// --- khrushchyovka profile ---------------------------------------------------

export function porchLocalXs(sections: number): number[] {
    const xs: number[] = [];
    for (let section = 0; section < sections; section += KHRUSHCHYOVKA.PORCH.SECTION_STEP) {
        const panelX = (section - (sections - 1) / 2) * KHRUSHCHYOVKA.SECTION_WIDTH;
        xs.push(round(panelX + KHRUSHCHYOVKA.PORCH.OFFSET_X));
    }
    return xs;
}

function khrushchyovkaParts(sections: number, openPorchX: number | null): Box[] {
    const halfWidth = (sections * KHRUSHCHYOVKA.SECTION_WIDTH) / 2;
    const halfDepth = KHRUSHCHYOVKA.DEPTH / 2;
    const height = KHRUSHCHYOVKA.PLINTH_HEIGHT + KHRUSHCHYOVKA.FLOORS * KHRUSHCHYOVKA.FLOOR_HEIGHT;
    const porch = KHRUSHCHYOVKA.PORCH;
    const doorHalf = INTERIOR.PORCH_DOOR.WIDTH / 2;
    // The notch is deeper than the panel: the pilot's 0.42 m collider has to be
    // able to stand in the doorway before the interior world takes over.
    const notch = 0.60;

    const parts: Box[] = [];
    if (openPorchX === null) {
        parts.push({ minX: -halfWidth, maxX: halfWidth, minZ: -halfDepth, maxZ: halfDepth, minY: 0, maxY: height });
    } else {
        // The block, notched at the doorway: the pilot walks through the panel
        // into the interior world instead of bouncing off one solid AABB.
        parts.push({ minX: -halfWidth, maxX: openPorchX - doorHalf, minZ: -halfDepth, maxZ: halfDepth, minY: 0, maxY: height });
        parts.push({ minX: openPorchX + doorHalf, maxX: halfWidth, minZ: -halfDepth, maxZ: halfDepth, minY: 0, maxY: height });
        parts.push({
            minX: openPorchX - doorHalf,
            maxX: openPorchX + doorHalf,
            minZ: -halfDepth,
            maxZ: halfDepth - notch,
            minY: 0,
            maxY: height
        });
    }

    porchLocalXs(sections).forEach((porchX) => {
        if (openPorchX !== null && Math.abs(porchX - openPorchX) < 1e-6) {
            // The stoop of the opened porch keeps its two flanks; the walkway
            // between them is what the pilot climbs to reach the door.
            [-1, 1].forEach((side) => {
                parts.push({
                    minX: side < 0 ? porchX - porch.HALF_WIDTH : porchX + doorHalf,
                    maxX: side < 0 ? porchX - doorHalf : porchX + porch.HALF_WIDTH,
                    minZ: porch.MIN_Z,
                    maxZ: porch.MAX_Z,
                    minY: 0,
                    maxY: porch.HEIGHT
                });
            });
            return;
        }
        parts.push({
            minX: porchX - porch.HALF_WIDTH,
            maxX: porchX + porch.HALF_WIDTH,
            minZ: porch.MIN_Z,
            maxZ: porch.MAX_Z,
            minY: 0,
            maxY: porch.HEIGHT
        });
    });
    return parts;
}

function khrushchyovkaVisual(sections: number): Box {
    const halfWidth = (sections * KHRUSHCHYOVKA.SECTION_WIDTH) / 2 + KHRUSHCHYOVKA.VISUAL_MARGIN_X;
    return {
        minX: -halfWidth,
        maxX: halfWidth,
        minZ: KHRUSHCHYOVKA.VISUAL_MIN_Z,
        maxZ: KHRUSHCHYOVKA.VISUAL_MAX_Z,
        minY: 0,
        maxY: KHRUSHCHYOVKA.VISUAL_MAX_Y
    };
}

// Walkable line in front of every porch, in world coordinates.
function khrushchyovkaEntrances(id: string, transform: ObjectTransform, sections: number): AccessPoint[] {
    return porchLocalXs(sections).map((porchX, index) => {
        const world = transformPoint(transform, porchX, KHRUSHCHYOVKA.ENTRANCE_LOCAL_Z);
        return {
            id: `${id}-ENTRY-${index + 1}`,
            local: { x: porchX, z: KHRUSHCHYOVKA.ENTRANCE_LOCAL_Z, yaw: Math.PI },
            world: { x: world.x, z: world.z, yaw: transformYaw(transform, Math.PI) },
            porchX
        };
    });
}

// --- descriptor factory ------------------------------------------------------

function unionOfBoxes(boxes: Box[]): Box {
    return boxes.reduce<Box>(
        (acc, box) => ({
            minX: Math.min(acc.minX, box.minX),
            maxX: Math.max(acc.maxX, box.maxX),
            minZ: Math.min(acc.minZ, box.minZ),
            maxZ: Math.max(acc.maxZ, box.maxZ),
            minY: Math.min(acc.minY, box.minY),
            maxY: Math.max(acc.maxY, box.maxY)
        }),
        { ...boxes[0] }
    );
}

function createObject({
    id,
    type,
    transform,
    parameters = {},
    parts = [],
    visual = null,
    accessPoints = [],
    reservations = [],
    ownerZone = null
}: ObjectInput): ObjectDescriptor {
    const worldTransform = {
        x: transform.x,
        y: transform.y || 0,
        z: transform.z,
        rotY: transform.rotY || 0
    };
    const localVisual = visual || (parts.length > 0 ? unionOfBoxes(parts) : null);

    return {
        id,
        type,
        transform: worldTransform,
        parameters,
        physicalFootprints: parts,
        visualFootprint: localVisual,
        worldFootprints: parts.map((part) => transformFootprint(worldTransform, part)),
        worldVisualFootprint: localVisual ? transformFootprint(worldTransform, localVisual) : null,
        accessPoints: accessPoints.map((point) => ({
            ...point,
            world: {
                x: transformPoint(worldTransform, point.local.x, point.local.z).x,
                z: transformPoint(worldTransform, point.local.x, point.local.z).z,
                yaw: transformYaw(worldTransform, point.local.yaw)
            }
        })),
        reservations,
        ownerZone
    };
}

// --- object catalogue --------------------------------------------------------

function khrushchyovkaObjects() {
    return BUILDINGS.map((placement) => {
        const transform = { x: placement.x, y: 0, z: placement.z, rotY: placement.rotY };
        const porchXs = porchLocalXs(placement.sections);
        // The interior is chosen from the block id alone, before anything is
        // measured: the porch walkway and the doorway cut of the layout below are
        // derived from it, so the plan and the opening can never disagree.
        const interior: InteriorDescriptor | null = interiorSelectionFor(placement.id, porchXs);
        return createObject({
            id: placement.id,
            type: 'khrushchyovka',
            transform,
            parameters: {
                sections: placement.sections,
                porchXs,
                interior
            },
            parts: khrushchyovkaParts(placement.sections, interior ? interior.porchX : null),
            visual: khrushchyovkaVisual(placement.sections),
            accessPoints: khrushchyovkaEntrances(placement.id, transform, placement.sections),
            ownerZone: placement.ownerZone
        });
    });
}

function playgroundObjects() {
    const origin = PLAYGROUND;
    const objectFor = (
        id: string,
        type: string,
        local: { x: number; z: number },
        extra: Partial<Omit<ObjectInput, 'id' | 'type' | 'transform'>>
    ): ObjectInput => ({
        id,
        type,
        transform: { x: origin.origin.x + local.x, y: 0, z: origin.origin.z + local.z, rotY: 0 },
        ...extra
    });

    const swingReserveRect = { ...origin.swingReserve };

    return [
        createObject(
            objectFor('PLAY-SANDBOX', 'sandbox', origin.sandbox, {
                parameters: { size: PLAYGROUND_PROFILE.SANDBOX.SIZE },
                parts: [],
                visual: {
                    minX: -PLAYGROUND_PROFILE.SANDBOX.SIZE / 2,
                    maxX: PLAYGROUND_PROFILE.SANDBOX.SIZE / 2,
                    minZ: -PLAYGROUND_PROFILE.SANDBOX.SIZE / 2,
                    maxZ: PLAYGROUND_PROFILE.SANDBOX.SIZE / 2,
                    minY: 0,
                    maxY: PLAYGROUND_PROFILE.SANDBOX.CURB_HEIGHT
                },
                ownerZone: 'playground'
            })
        ),
        createObject(
            objectFor('PLAY-ROCKET', 'rocket', origin.rocket, {
                parts: [
                    {
                        minX: -PLAYGROUND_PROFILE.ROCKET.COLLIDER_RADIUS,
                        maxX: PLAYGROUND_PROFILE.ROCKET.COLLIDER_RADIUS,
                        minZ: -PLAYGROUND_PROFILE.ROCKET.COLLIDER_RADIUS,
                        maxZ: PLAYGROUND_PROFILE.ROCKET.COLLIDER_RADIUS,
                        minY: 0,
                        maxY: 5.7
                    }
                ],
                visual: {
                    minX: -PLAYGROUND_PROFILE.ROCKET.VISUAL_RADIUS,
                    maxX: PLAYGROUND_PROFILE.ROCKET.VISUAL_RADIUS,
                    minZ: -PLAYGROUND_PROFILE.ROCKET.VISUAL_RADIUS,
                    maxZ: PLAYGROUND_PROFILE.ROCKET.VISUAL_RADIUS,
                    minY: 0,
                    maxY: 5.7
                },
                ownerZone: 'playground'
            })
        ),
        createObject(
            objectFor('PLAY-SWING', 'swing', origin.swing, {
                parts: [
                    {
                        minX: -PLAYGROUND_PROFILE.SWING.COLLIDER_HALF_WIDTH,
                        maxX: PLAYGROUND_PROFILE.SWING.COLLIDER_HALF_WIDTH,
                        minZ: -PLAYGROUND_PROFILE.SWING.COLLIDER_HALF_DEPTH,
                        maxZ: PLAYGROUND_PROFILE.SWING.COLLIDER_HALF_DEPTH,
                        minY: 0,
                        maxY: 2.8
                    }
                ],
                visual: {
                    minX: -PLAYGROUND_PROFILE.SWING.VISUAL_HALF_WIDTH,
                    maxX: PLAYGROUND_PROFILE.SWING.VISUAL_HALF_WIDTH,
                    minZ: -PLAYGROUND_PROFILE.SWING.VISUAL_HALF_DEPTH,
                    maxZ: PLAYGROUND_PROFILE.SWING.VISUAL_HALF_DEPTH,
                    minY: 0,
                    maxY: 2.8
                },
                reservations: [
                    { id: 'SWING-RESERVE', kind: 'dynamic', rect: swingReserveRect, strict: true }
                ],
                ownerZone: 'playground'
            })
        )
    ];
}

function kioskObject() {
    const profile = KIOSK_PROFILE;
    const frontZ = profile.BODY.DEPTH / 2;
    const visual = {
        minX: -profile.ROOF.WIDTH / 2,
        maxX: profile.ROOF.WIDTH / 2,
        minZ: -frontZ - profile.ROOF.BACK_OVERHANG,
        maxZ: frontZ + profile.ROOF.FRONT_OVERHANG,
        minY: 0,
        maxY: profile.ROOF.Y + profile.ROOF.HEIGHT / 2 + profile.ROOF.RISE
    };
    const transform = { x: KIOSK.x, y: 0, z: KIOSK.z, rotY: KIOSK.rotY };

    const shutterReserveLocal = {
        minX: -profile.BODY.WIDTH / 2,
        maxX: profile.BODY.WIDTH / 2,
        minZ: frontZ,
        maxZ: frontZ + profile.SHUTTER_RESERVE
    };

    return createObject({
        id: KIOSK.id,
        type: 'kiosk',
        transform,
        parameters: {},
        parts: [
            {
                minX: -profile.ROOF.WIDTH / 2,
                maxX: profile.ROOF.WIDTH / 2,
                minZ: -frontZ - profile.ROOF.BACK_OVERHANG,
                maxZ: frontZ + profile.ROOF.FRONT_OVERHANG,
                minY: 0,
                maxY: visual.maxY
            }
        ],
        visual,
        accessPoints: [
            {
                id: 'KIOSK-WINDOW',
                local: { x: 0, z: frontZ + 0.5, yaw: 0 }
            }
        ],
        reservations: [
            {
                id: 'KIOSK-SHUTTER',
                kind: 'service',
                rect: transformRect(transform, shutterReserveLocal),
                strict: true
            }
        ],
        ownerZone: KIOSK.ownerZone
    });
}

function boothObject() {
    const profile = BOOTH_PROFILE;
    return createObject({
        id: BOOTH.id,
        type: 'booth',
        transform: { x: BOOTH.x, y: 0, z: BOOTH.z, rotY: BOOTH.rotY },
        parts: [
            {
                minX: -profile.ROOF.WIDTH / 2,
                maxX: profile.ROOF.WIDTH / 2,
                minZ: -profile.ROOF.DEPTH / 2,
                maxZ: profile.ROOF.DEPTH / 2,
                minY: 0,
                maxY: profile.ROOF.Y + profile.ROOF.HEIGHT / 2
            }
        ],
        accessPoints: [
            {
                id: 'TP-DOOR',
                local: { x: 0, z: -profile.ROOF.DEPTH / 2 - 0.5, yaw: Math.PI }
            }
        ],
        reservations: [
            { id: 'TP-DOOR-RESERVE', kind: 'service', rect: { ...YARD.doorReserve }, strict: true }
        ],
        ownerZone: BOOTH.ownerZone
    });
}

// Perimeter fence of the transformer yard: four sides with a 2.4 m gate on the
// east run. Each run is a thin solid part, so the gate posts are the only
// colliders at the opening.
function yardFenceRuns(): YardFenceRun[] {
    const rect = YARD_ZONE.rect;
    const gate = YARD.gate;
    const gateMin = gate.z - gate.width / 2;
    const gateMax = gate.z + gate.width / 2;
    return [
        { id: 'TP-YARD-NORTH', axis: 'x', x0: rect.minX, x1: rect.maxX, z: rect.minZ },
        { id: 'TP-YARD-SOUTH', axis: 'x', x0: rect.minX, x1: rect.maxX, z: rect.maxZ },
        { id: 'TP-YARD-WEST', axis: 'z', z0: rect.minZ, z1: rect.maxZ, x: rect.minX },
        { id: 'TP-YARD-EAST-N', axis: 'z', z0: rect.minZ, z1: gateMin, x: rect.maxX },
        { id: 'TP-YARD-EAST-S', axis: 'z', z0: gateMax, z1: rect.maxZ, x: rect.maxX }
    ];
}

function yardFenceObject() {
    const halfThickness = FENCE_PROFILE.YARD_THICKNESS / 2;
    const leaf = yardGateLeaf();
    return createObject({
        id: 'TP-YARD-FENCE',
        type: 'yard-fence',
        transform: { x: 0, y: 0, z: 0, rotY: 0 },
        parameters: { runs: yardFenceRuns(), gate: { ...YARD.gate }, gateLeaf: leaf },
        parts: [
            ...yardFenceRuns().map((run) =>
                run.axis === 'x'
                    ? {
                          minX: run.x0,
                          maxX: run.x1,
                          minZ: run.z - halfThickness,
                          maxZ: run.z + halfThickness,
                          minY: 0,
                          maxY: FENCE_PROFILE.YARD_HEIGHT
                      }
                    : {
                          minX: run.x - halfThickness,
                          maxX: run.x + halfThickness,
                          minZ: run.z0,
                          maxZ: run.z1,
                          minY: 0,
                          maxY: FENCE_PROFILE.YARD_HEIGHT
                      }
            ),
            // The leaf is open, so it is its own solid: a pilot walking to the gate
            // sees the frame as one object with two legs of collision.
            {
                minX: Math.min(leaf.hinge.x, leaf.tip.x),
                maxX: Math.max(leaf.hinge.x, leaf.tip.x),
                minZ: Math.min(leaf.hinge.z, leaf.tip.z) - halfThickness,
                maxZ: Math.max(leaf.hinge.z, leaf.tip.z) + halfThickness,
                minY: 0,
                maxY: leaf.height
            }
        ],
        ownerZone: BOOTH.ownerZone
    });
}

// Gate leaf of the transformer yard: hinged on the south post, swung into the
// yard by the angle the plan declares. Both the collider above and the geometry
// in fence.ts are built from these two points, so the leaf and its collision can
// never disagree.
function yardGateLeaf() {
    const gate = YARD.gate;
    const hinge = { x: gate.x, z: gate.z + gate.width / 2 };
    const ajar = (gate.leaf.ajarDeg * Math.PI) / 180;
    const length = gate.width;
    // Closed, the leaf lies along -Z from the hinge; it opens towards -X (the yard).
    return {
        hinge,
        tip: {
            x: round(hinge.x - Math.sin(ajar) * length),
            z: round(hinge.z - Math.cos(ajar) * length)
        },
        height: FENCE_PROFILE.YARD_HEIGHT,
        ajarDeg: gate.leaf.ajarDeg
    };
}

interface Po2Run {
    id: string;
    x: number;
    fromZ: number;
    toZ: number;
    step: number;
    rotY: number;
    leans?: readonly number[];
    missing?: readonly number[];
    gate?: { index: number; ajarDeg: number };
}

// Solid segments of a PO-2 run: the knocked-out sections are real holes in both
// the geometry and the collision set, so a missing panel is never a wall the
// pilot bumps into.
function po2SolidSegments(run: Po2Run): Array<{ fromZ: number; toZ: number }> {
    const half = FENCE_PROFILE.SECTION.WIDTH / 2;
    const start = run.fromZ - half;
    const end = run.toZ + half;
    const holes = (run.missing || [])
        .map((index) => ({ from: run.fromZ + index * run.step - half, to: run.fromZ + index * run.step + half }))
        .sort((left, right) => left.from - right.from);

    const segments: Array<{ fromZ: number; toZ: number }> = [];
    let cursor = start;
    holes.forEach((hole) => {
        if (hole.from > cursor) segments.push({ fromZ: round(cursor), toZ: round(Math.min(hole.from, end)) });
        cursor = Math.max(cursor, hole.to);
    });
    if (cursor < end) segments.push({ fromZ: round(cursor), toZ: round(end) });
    return segments.filter((segment) => segment.toZ - segment.fromZ > 1e-6);
}

// A panel that came off its posts lies flat in front of the run: no collider (it
// is a 16 cm slab the pilot steps over), only a read that the fence was hit.
function po2FallenPanel(run: Po2Run) {
    const missing = run.missing || [];
    if (missing.length === 0) return null;
    const centerZ = run.fromZ + missing[0] * run.step;
    const half = FENCE_PROFILE.SECTION.WIDTH / 2;
    const gap = 0.25;
    const side = run.x < 0 ? 1 : -1;
    const inner = run.x + side * (gap + FENCE_PROFILE.SECTION.THICKNESS / 2);
    return {
        minX: round(Math.min(inner, inner + side * FENCE_PROFILE.SECTION.HEIGHT)),
        maxX: round(Math.max(inner, inner + side * FENCE_PROFILE.SECTION.HEIGHT)),
        minZ: round(centerZ - half),
        maxZ: round(centerZ + half),
        height: FENCE_PROFILE.SECTION.THICKNESS
    };
}

function po2FenceObjects() {
    const runs = FENCE_RUNS as readonly Po2Run[];
    const halfThickness = FENCE_PROFILE.SECTION.THICKNESS / 2;
    const panelHeight = FENCE_PROFILE.SECTION.HEIGHT + FENCE_PROFILE.SECTION.Y - FENCE_PROFILE.SECTION.HEIGHT / 2;

    return runs.map((run) =>
        createObject({
            id: run.id,
            type: 'po2-fence',
            transform: { x: 0, y: 0, z: 0, rotY: 0 },
            parameters: { ...run, fallen: po2FallenPanel(run) },
            parts: po2SolidSegments(run).map((segment) => ({
                minX: run.x - halfThickness,
                maxX: run.x + halfThickness,
                minZ: segment.fromZ,
                maxZ: segment.toZ,
                minY: 0,
                maxY: panelHeight
            })),
            ownerZone: null
        })
    );
}

function treeObjects() {
    return TREES.map((tree, index) => {
        const crownRadius = TREE_PROFILE.CROWN_RADIUS * tree.scale;
        return createObject({
            id: tree.id,
            type: 'winter-tree',
            transform: { x: tree.x, y: 0, z: tree.z, rotY: 0 },
            parameters: {
                scale: tree.scale,
                crownRadius,
                type: tree.type,
                height: TREE_PROFILE.TRUNK_HEIGHT * tree.scale,
                // Decorative yaw: the crown is symmetric, so rotation never moves
                // the reserved footprint — it only breaks the "six clones" read.
                rotation: index * TREE_ROTATION_STEP
            },
            parts: [
                {
                    minX: -TREE_PROFILE.COLLIDER_RADIUS,
                    maxX: TREE_PROFILE.COLLIDER_RADIUS,
                    minZ: -TREE_PROFILE.COLLIDER_RADIUS,
                    maxZ: TREE_PROFILE.COLLIDER_RADIUS,
                    minY: 0,
                    maxY: TREE_PROFILE.TRUNK_HEIGHT * tree.scale
                }
            ],
            visual: {
                minX: -crownRadius,
                maxX: crownRadius,
                minZ: -crownRadius,
                maxZ: crownRadius,
                minY: 0,
                maxY: TREE_PROFILE.TRUNK_HEIGHT * tree.scale
            },
            ownerZone: null
        });
    });
}

// Low welded fences around the playground. Each run is one thin solid: the gate
// opening is the gap between the runs, exactly like the transformer yard gate.
function lawnFenceObjects() {
    const half = LAWN_FENCE_PROFILE.THICKNESS / 2;
    return PLAY_FENCES.map((run) =>
        createObject({
            id: run.id,
            type: 'lawn-fence',
            transform: { x: 0, y: 0, z: 0, rotY: 0 },
            parameters: { ...run },
            parts: [
                run.axis === 'x'
                    ? {
                          minX: run.x0,
                          maxX: run.x1,
                          minZ: run.z - half,
                          maxZ: run.z + half,
                          minY: 0,
                          maxY: LAWN_FENCE_PROFILE.HEIGHT
                      }
                    : {
                          minX: run.x - half,
                          maxX: run.x + half,
                          minZ: run.z0,
                          maxZ: run.z1,
                          minY: 0,
                          maxY: LAWN_FENCE_PROFILE.HEIGHT
                      }
            ],
            ownerZone: 'playground'
        })
    );
}

function poleObjects() {
    return POLES.z.map((z, index) =>
        createObject({
            id: `POLE-${index + 1}`,
            type: 'utility-pole',
            transform: { x: POLES.x, y: 0, z, rotY: 0 },
            // Spans travel with the pole so the wire builder never has to guess a
            // neighbour: the last pole of the line simply owns no outgoing span.
            parameters: { index, height: POLES.height, anchorY: POLES.anchorY, sag: POLES.sag, spans: POLES.spans },
            parts: [
                {
                    minX: -POLE_PROFILE.COLLIDER_RADIUS,
                    maxX: POLE_PROFILE.COLLIDER_RADIUS,
                    minZ: -POLE_PROFILE.COLLIDER_RADIUS,
                    maxZ: POLE_PROFILE.COLLIDER_RADIUS,
                    minY: 0,
                    maxY: POLES.height
                }
            ],
            ownerZone: null
        })
    );
}

function pipelineObject() {
    const halfDepth = PIPELINE_PROFILE.BLOCKER_HALF_DEPTH;
    return createObject({
        id: PIPELINE.id,
        type: 'heating-pipeline',
        transform: { x: 0, y: 0, z: 0, rotY: 0 },
        parameters: { ...PIPELINE },
        parts: [
            {
                minX: PIPELINE.fromX,
                maxX: PIPELINE.toX,
                minZ: PIPELINE.z - halfDepth,
                maxZ: PIPELINE.z + halfDepth,
                minY: 0,
                maxY: PIPELINE.height + PIPELINE_PROFILE.PIPE_RADIUS
            }
        ],
        ownerZone: null
    });
}

function decorObjects() {
    const fbs = DECOR.fbs.map((block) => {
        const transform = { x: block.x, y: 0, z: block.z, rotY: block.rotY };
        const stack = 'stack' in block ? block.stack : 1;
        const lean = 'lean' in block ? block.lean : 0;
        return createObject({
            id: block.id,
            type: 'fbs',
            transform,
            parameters: { stack, lean },
            parts: [
                {
                    minX: -FBS_PROFILE.WIDTH / 2,
                    maxX: FBS_PROFILE.WIDTH / 2,
                    minZ: -FBS_PROFILE.DEPTH / 2,
                    maxZ: FBS_PROFILE.DEPTH / 2,
                    minY: 0,
                    maxY: FBS_PROFILE.HEIGHT * stack
                }
            ],
            ownerZone: null
        });
    });

    const barrelOwners = ['transformer', 'transformer', 'kiosk'];
    const barrels = DECOR.barrels.map((barrel, index) =>
        createObject({
            id: barrel.id,
            type: 'barrel',
            transform: { x: barrel.x, y: 0, z: barrel.z, rotY: 0 },
            parameters: { tilted: barrel.tilted },
            parts: [
                {
                    minX: -BARREL_PROFILE.COLLIDER_RADIUS,
                    maxX: BARREL_PROFILE.COLLIDER_RADIUS,
                    minZ: -BARREL_PROFILE.COLLIDER_RADIUS,
                    maxZ: BARREL_PROFILE.COLLIDER_RADIUS,
                    minY: 0,
                    maxY: BARREL_PROFILE.HEIGHT
                }
            ],
            ownerZone: barrelOwners[index] || null
        })
    );

    return [...fbs, ...barrels, ...shrubObjects(), ...snowPatchObjects(), ...manholeObjects(), ...grateObjects(), ...laundryObjects(), ...binObjects(), pagSlabObject()];
}

// Non-solid winter decor: no collider, so the validator measures it with the
// DECOR_PLACEMENT policy instead of the solid-footprint rules.
function shrubObjects() {
    return DECOR.shrubs.map((shrub) =>
        createObject({
            id: shrub.id,
            type: 'shrub',
            transform: { x: shrub.x, y: 0, z: shrub.z, rotY: shrub.ry },
            parameters: { width: shrub.w, height: shrub.h, depth: shrub.d },
            parts: [],
            visual: {
                minX: -shrub.w / 2,
                maxX: shrub.w / 2,
                minZ: -shrub.d / 2,
                maxZ: shrub.d / 2,
                minY: 0,
                maxY: shrub.h * 1.15
            },
            ownerZone: null
        })
    );
}

function snowPatchObjects() {
    return DECOR.snowPatches.map((patch) =>
        createObject({
            id: patch.id,
            type: 'snow-patch',
            transform: { x: patch.x, y: 0, z: patch.z, rotY: 0 },
            parameters: {
                width: patch.width,
                depth: patch.depth,
                mounds: patch.mounds,
                seed: patch.seed
            },
            parts: [],
            visual: {
                minX: -patch.width / 2,
                maxX: patch.width / 2,
                minZ: -patch.depth / 2,
                maxZ: patch.depth / 2,
                minY: 0,
                maxY: SNOW_PATCH_PROFILE.VISUAL_HEIGHT
            },
            ownerZone: null
        })
    );
}

function manholeObjects() {
    return DECOR.manholes.map((manhole) =>
        createObject({
            id: manhole.id,
            type: 'manhole',
            transform: { x: manhole.x, y: 0, z: manhole.z, rotY: manhole.rotY },
            parameters: {},
            parts: [],
            visual: {
                minX: -MANHOLE_PROFILE.RING_RADIUS,
                maxX: MANHOLE_PROFILE.RING_RADIUS,
                minZ: -MANHOLE_PROFILE.RING_RADIUS,
                maxZ: MANHOLE_PROFILE.RING_RADIUS,
                minY: 0,
                maxY: MANHOLE_PROFILE.VISUAL_HEIGHT
            },
            ownerZone: null
        })
    );
}

// Storm-water grates: flat decor on the carriageway, measured by the 'on-asphalt'
// decor policy instead of the solid-footprint rules.
function grateObjects() {
    const halfWidth = GRATE_PROFILE.WIDTH / 2;
    const halfDepth = GRATE_PROFILE.DEPTH / 2;
    return DECOR.grates.map((grate) =>
        createObject({
            id: grate.id,
            type: 'grate',
            transform: { x: grate.x, y: 0, z: grate.z, rotY: grate.rotY },
            parameters: { bars: GRATE_PROFILE.BARS },
            parts: [],
            visual: {
                minX: -halfWidth,
                maxX: halfWidth,
                minZ: -halfDepth,
                maxZ: halfDepth,
                minY: 0,
                maxY: GRATE_PROFILE.HEIGHT
            },
            ownerZone: null
        })
    );
}

// Laundry frames: two posts are solid, the wires are not. The frame carries its
// own wire profile so the builder never guesses a sag or an anchor height.
function laundryObjects() {
    const halfSpan = LAUNDRY_PROFILE.SPAN / 2;
    const halfPost = LAUNDRY_PROFILE.POST.WIDTH / 2;
    const halfDepth = LAUNDRY_PROFILE.POST.DEPTH / 2;
    return DECOR.laundry.map((frame) =>
        createObject({
            id: frame.id,
            type: 'laundry-frame',
            transform: { x: frame.x, y: 0, z: frame.z, rotY: frame.rotY },
            parameters: {
                span: LAUNDRY_PROFILE.SPAN,
                height: LAUNDRY_PROFILE.POST.HEIGHT,
                anchorY: LAUNDRY_PROFILE.ANCHOR_Y,
                sag: LAUNDRY_PROFILE.SAG,
                wires: LAUNDRY_PROFILE.WIRES,
                rug: frame.rug
            },
            parts: [-1, 1].map((side) => ({
                minX: side * halfSpan - halfPost,
                maxX: side * halfSpan + halfPost,
                minZ: -halfDepth,
                maxZ: halfDepth,
                minY: 0,
                maxY: LAUNDRY_PROFILE.POST.HEIGHT
            })),
            visual: {
                minX: -halfSpan - halfPost,
                maxX: halfSpan + halfPost,
                minZ: -halfDepth,
                maxZ: halfDepth,
                minY: 0,
                maxY: LAUNDRY_PROFILE.POST.HEIGHT
            },
            ownerZone: null
        })
    );
}

// Refuse containers: one box each, so the pair can be placed by the plan.
function binObjects() {
    const halfWidth = BIN_PROFILE.WIDTH / 2;
    const halfDepth = BIN_PROFILE.DEPTH / 2;
    const height = BIN_PROFILE.HEIGHT + BIN_PROFILE.LID_HEIGHT;
    return DECOR.bins.map((bin) =>
        createObject({
            id: bin.id,
            type: 'bin',
            transform: { x: bin.x, y: 0, z: bin.z, rotY: bin.rotY },
            parameters: {},
            parts: [
                {
                    minX: -halfWidth,
                    maxX: halfWidth,
                    minZ: -halfDepth,
                    maxZ: halfDepth,
                    minY: 0,
                    maxY: height
                }
            ],
            ownerZone: null
        })
    );
}

function pagSlabObject() {
    const slab = DECOR.pagSlab;
    const size = pagSlabSize(slab.cols, slab.rows);
    return createObject({
        id: slab.id,
        type: 'pag-slab',
        transform: { x: slab.x, y: 0, z: slab.z, rotY: 0 },
        parameters: { cols: slab.cols, rows: slab.rows, seed: slab.seed },
        parts: [],
        visual: {
            minX: -size.width / 2,
            maxX: size.width / 2,
            minZ: -size.depth / 2,
            maxZ: size.depth / 2,
            minY: 0,
            maxY: PAG_SLAB_PROFILE.THICKNESS + PAG_SLAB_PROFILE.GAP
        },
        ownerZone: null
    });
}

export function createObjectDescriptors() {
    return [
        ...khrushchyovkaObjects(),
        ...playgroundObjects(),
        kioskObject(),
        boothObject(),
        yardFenceObject(),
        ...po2FenceObjects(),
        ...lawnFenceObjects(),
        ...treeObjects(),
        ...poleObjects(),
        pipelineObject(),
        ...decorObjects()
    ];
}

export function findObject(objects: ObjectDescriptor[], id: string): ObjectDescriptor | null {
    return objects.find((object) => object.id === id) || null;
}

// Solid world footprints of every object, flattened for the validator.
export function collectWorldFootprints(objects: ObjectDescriptor[]): WorldFootprintRecord[] {
    const result: WorldFootprintRecord[] = [];
    objects.forEach((object) => {
        object.worldFootprints.forEach((footprint, index) => {
            result.push({ objectId: object.id, type: object.type, index, rect: footprint, ownerZone: object.ownerZone });
        });
    });
    return result;
}

// Reservation of the yard service path: a 2 m wide strip along the polyline
// (35,−9) → (32,−9) → (29,−9), expressed as its axis-aligned segments.
export function servicePathRects(): Rect[] {
    const { width, points } = YARD.servicePath;
    const half = width / 2;
    const rects: Rect[] = [];
    for (let index = 0; index < points.length - 1; index++) {
        const [x1, z1] = points[index];
        const [x2, z2] = points[index + 1];
        rects.push(
            createRect(
                Math.min(x1, x2) - half,
                Math.min(z1, z2) - half,
                Math.max(x1, x2) + half,
                Math.max(z1, z2) + half
            )
        );
    }
    return rects;
}

export function gateRect(): Rect {
    const half = YARD.gate.width / 2;
    return expandRect(
        createRect(YARD.gate.x, YARD.gate.z - half, YARD.gate.x, YARD.gate.z + half),
        FENCE_PROFILE.YARD_THICKNESS
    );
}
