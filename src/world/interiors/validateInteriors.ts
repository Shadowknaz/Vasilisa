// Interior rules of the plan. They measure the same pure plan the builders mesh,
// so a doorway the eye can see but the body cannot pass is a hard error instead
// of a screenshot nobody took.
//
// The probe radius is the pilot's own collider (0.42): a passage that fails here
// is a place where the walk sticks, and the walk is the whole feature.
import { PILOT_CONTROL } from '../../config/controls.js';
import { KHRUSHCHYOVKA, transformPoint, type ObjectDescriptor } from '../layout/footprints.js';
import { areInteriorsEnabled, interiorPlanFor, type InteriorDescriptor } from './interiorSelection.js';
import { INTERIOR, floorY, roomIsLit, type InteriorRect } from './interiorProfile.js';
import { buildFlatPlan, type FlatRoom } from './flatPlans.js';
import { createInteriorCollision, type InteriorCollision } from './interiorCollision.js';
import { FLAT_DOORWAY, type StairPlan } from './stairwell.js';

const PILOT_RADIUS = PILOT_CONTROL.COLLIDER_RADIUS;
// The doorway minus the two 5 cm jambs has to pass the body with a margin.
const DOOR_MARGIN = 0.06;

interface ValidationHooks {
    check: (id: string, passed: boolean, detail: string) => void;
    measure: (key: string, value: number) => void;
}

interface Planned {
    object: ObjectDescriptor;
    descriptor: InteriorDescriptor;
    plan: StairPlan;
}

function roomsOverlap(a: FlatRoom, b: FlatRoom): boolean {
    return a.minU < b.maxU - 1e-6 && b.minU < a.maxU - 1e-6 && a.minZ < b.maxZ - 1e-6 && b.minZ < a.maxZ - 1e-6;
}

function contains(outer: InteriorRect, inner: InteriorRect, margin = 0.05): boolean {
    return (
        inner.minX >= outer.minX + margin - 1e-6 &&
        inner.maxX <= outer.maxX - margin + 1e-6 &&
        inner.minZ >= outer.minZ + margin - 1e-6 &&
        inner.maxZ <= outer.maxZ - margin + 1e-6
    );
}

// Circle vs a set of world-space AABBs, the same test the courtyard collision
// world runs. Used for the piece of the walk that is still outdoors.
function circleFree(boxes: { minX: number; maxX: number; minZ: number; maxZ: number }[], x: number, z: number, radius: number): boolean {
    const radiusSquared = radius * radius;
    for (let index = 0; index < boxes.length; index += 1) {
        const box = boxes[index];
        const closestX = Math.min(Math.max(x, box.minX), box.maxX);
        const closestZ = Math.min(Math.max(z, box.minZ), box.maxZ);
        const dx = x - closestX;
        const dz = z - closestZ;
        if (dx * dx + dz * dz < radiusSquared) return false;
    }
    return true;
}

function walkOutdoors(
    boxes: { minX: number; maxX: number; minZ: number; maxZ: number }[],
    from: { x: number; z: number },
    to: { x: number; z: number },
    radius: number
): boolean {
    const length = Math.hypot(to.x - from.x, to.z - from.z);
    const steps = Math.max(1, Math.ceil(length / 0.08));
    for (let index = 0; index <= steps; index += 1) {
        const t = index / steps;
        if (!circleFree(boxes, from.x + (to.x - from.x) * t, from.z + (to.z - from.z) * t, radius)) return false;
    }
    return true;
}

// Walks a straight line the way the pilot does: test the body at the current feet
// height, then adopt the floor under the new spot.
function walkSegment(collision: InteriorCollision, from: { x: number; z: number; y: number }, to: { x: number; z: number }): boolean {
    const length = Math.hypot(to.x - from.x, to.z - from.z);
    const steps = Math.max(1, Math.ceil(length / 0.08));
    let y = from.y;
    for (let index = 1; index <= steps; index += 1) {
        const t = index / steps;
        const x = from.x + (to.x - from.x) * t;
        const z = from.z + (to.z - from.z) * t;
        if (!collision.isFree(x, z, PILOT_RADIUS, y)) return false;
        const ground = collision.groundAt(x, z, y);
        if (ground === null) return false;
        y = ground;
    }
    return true;
}

function planFits(plan: StairPlan, halfWidth: number): boolean {
    const limitX = halfWidth + 1e-6;
    const limitZ = KHRUSHCHYOVKA.DEPTH / 2 + 1e-6;
    const inside = (rect: InteriorRect): boolean =>
        rect.minX >= -limitX && rect.maxX <= limitX && rect.minZ >= -limitZ && rect.maxZ <= limitZ;
    // Walk surfaces are a lookup, not geometry: the doorway stoop plate reaches
    // past the facade on purpose, the visible slabs never do.
    return (
        plan.solids.every((solid) => inside(solid.box)) &&
        plan.plates.every((plate) => inside(plate.rect)) &&
        plan.ramps.every((ramp) => inside(ramp.rect))
    );
}

function checkFlat(entry: Planned, hooks: ValidationHooks): void {
    const { descriptor } = entry;
    const plan = entry.plan;

    descriptor.flats.forEach((flat) => {
        const flatPlan = buildFlatPlan(flat.type);
        const level = flat.level;
        const floor = floorY(level);

        // (a) Every opening of the flat sits inside its wall and no two overlap:
        // a doorway that runs past the end of a wall is a hole in the collider.
        flatPlan.walls.forEach((wall, index) => {
            const start = Math.min(wall.from, wall.to);
            const end = Math.max(wall.from, wall.to);
            const sorted = wall.openings.slice().sort((left, right) => left.at - right.at);
            let previousEnd = start;
            let ok = true;
            sorted.forEach((opening) => {
                const a0 = opening.at - opening.width / 2;
                const a1 = opening.at + opening.width / 2;
                if (a0 < start - 1e-6 || a1 > end + 1e-6 || a0 < previousEnd - 1e-6) ok = false;
                if (opening.width < 0.90) ok = false;
                previousEnd = a1;
            });
            hooks.check(
                'INTERIOR_OPENING',
                ok,
                `${descriptor.buildingId} L${level} ${flat.type} wall ${index}: ${sorted.length} openings within [${start}, ${end}]`
            );
        });

        // (b) Every room is inside the flat and no two rooms overlap: the plan is
        // a tiling, not a sketch.
        let tiled = true;
        flatPlan.rooms.forEach((room, index) => {
            if (room.minU < -1e-6 || room.maxU > flatPlan.width + 1e-6) tiled = false;
            if (room.minZ < INTERIOR.INNER_BACK - 1e-6 || room.maxZ > INTERIOR.INNER_FRONT + 1e-6) tiled = false;
            flatPlan.rooms.slice(index + 1).forEach((other) => {
                if (roomsOverlap(room, other)) tiled = false;
            });
        });
        hooks.check(
            'INTERIOR_ROOMS',
            tiled,
            `${descriptor.buildingId} L${level} ${flat.type}: ${flatPlan.rooms.length} rooms tile the flat without overlap`
        );

        // (c) Every room that needs daylight has a pane of its own on the facade.
        // Panes live in building-local X, rooms in the flat's own u axis: the two
        // are compared through the side of the flat, never directly.
        const panes = plan.panes.filter((pane) => pane.minY >= floor && pane.maxY <= floor + INTERIOR.CEILING + 1e-6);
        const paneU = panes.map((pane) =>
            flat.side > 0 ? { min: pane.minX - flat.x0, max: pane.maxX - flat.x0 } : { min: flat.x1 - pane.maxX, max: flat.x1 - pane.minX }
        );
        flatPlan.rooms.forEach((room) => {
            if (!roomIsLit(room.kind)) return;
            const hasWindow = flatPlan.windows.some(
                (window) => window.roomId === room.id && paneU.some((span) => span.max > room.minU && span.min < room.maxU)
            );
            hooks.check('INTERIOR_ROOM_LIGHT', hasWindow, `${descriptor.buildingId} L${level} ${flat.type}/${room.id}: lit room has a window`);
        });

        // (d) The entrance of the flat is a plain doorway and is walkable from the
        // landing: nobody opens anything by hand, so the opening has to pass the
        // body square on.
        hooks.check(
            'INTERIOR_DOOR_WIDTH',
            FLAT_DOORWAY.WIDTH > 2 * PILOT_RADIUS + DOOR_MARGIN,
            `${descriptor.buildingId} L${level}: clear opening ${FLAT_DOORWAY.WIDTH.toFixed(2)} m for a ${(2 * PILOT_RADIUS).toFixed(2)} m body`
        );

        const side = descriptor.side;
        const porchX = descriptor.porchX;
        const closed = createInteriorCollision(plan, () => false);
        const doorway = { x: porchX + side * 0.9, z: FLAT_DOORWAY.AT, y: floor };
        const hallInside = { x: porchX + side * 2.4, z: FLAT_DOORWAY.AT };
        hooks.check(
            'INTERIOR_FLAT_PASSAGE',
            walkSegment(closed, { x: porchX + side * 0.4, z: FLAT_DOORWAY.AT, y: floor }, doorway) &&
                walkSegment(closed, doorway, hallInside),
            `${descriptor.buildingId} L${level}: landing → ${flat.type} hall is walkable through the open doorway`
        );
    });
}

function checkCore(entry: Planned, hooks: ValidationHooks): void {
    const { descriptor, plan } = entry;
    const closed = createInteriorCollision(plan, () => false);

    // (e) The way in, in two halves: the stoop is still the courtyard world (its
    // collision is the footprints of the block), the doorway onwards is the
    // interior world. Both halves are walked at the pilot's own radius.
    const stoop = transformPoint(entry.object.transform, descriptor.porchX, 6.6);
    const doorwayWorld = transformPoint(entry.object.transform, descriptor.porchX, 5.4);
    const outward = walkOutdoors(entry.object.worldFootprints, stoop, doorwayWorld, PILOT_RADIUS);
    const inward = walkSegment(
        closed,
        { x: descriptor.porchX, z: INTERIOR.FACADE_Z, y: INTERIOR.FLOOR },
        { x: descriptor.porchX, z: INTERIOR.CORE.LANDING_BACK + 0.5 }
    );
    hooks.check(
        'INTERIOR_ENTRY_PASSAGE',
        outward && inward,
        `${descriptor.buildingId}: porch → doorway → landing is walkable (stoop ${outward ? 'clear' : 'blocked'}, inside ${inward ? 'clear' : 'blocked'})`
    );

    // (f) The stair connects the storeys, one flight at a time. The waypoints are
    // read off the plan constants, so a change of the flight length cannot leave
    // this check walking a route that no longer exists.
    const stair = INTERIOR.STAIR;
    const core = INTERIOR.CORE;
    for (let index = 0; index < descriptor.levels.length - 1; index += 1) {
        const level = descriptor.levels[index];
        const y = floorY(level);
        const left = descriptor.porchX - 0.70;
        const right = descriptor.porchX + 0.70;
        const midZ = (core.BACK + stair.FLIGHT_BACK) / 2;
        const route = [
            { x: left, z: core.LANDING_BACK - 0.5, y },
            { x: left, z: midZ },
            { x: right, z: midZ },
            { x: right, z: core.LANDING_BACK + 0.5 }
        ];
        let ok = true;
        let from = { x: route[0].x, z: route[0].z, y };
        route.slice(1).forEach((point) => {
            if (!ok) return;
            if (!walkSegment(closed, from, point)) ok = false;
            const ground = closed.groundAt(point.x, point.z, from.y + INTERIOR.STOREY);
            from = { x: point.x, z: point.z, y: ground ?? from.y };
        });
        hooks.check(
            'INTERIOR_STAIR_PASSAGE',
            ok && Math.abs(from.y - floorY(level + 1)) < 0.05,
            `${descriptor.buildingId}: storey ${level} → ${level + 1} stair is walkable (arrived at ${from.y.toFixed(2)}, expected ${floorY(level + 1)})`
        );
    }

    // (g) The interior never leaves the block it belongs to.
    const sections = Number(entry.object.parameters.sections) || Math.max(1, Math.ceil((descriptor.bbox.maxX - descriptor.bbox.minX) / KHRUSHCHYOVKA.SECTION_WIDTH));
    hooks.check(
        'INTERIOR_FITS',
        planFits(plan, (sections * KHRUSHCHYOVKA.SECTION_WIDTH) / 2),
        `${descriptor.buildingId}: interior stays inside the ${sections * KHRUSHCHYOVKA.SECTION_WIDTH} × ${KHRUSHCHYOVKA.DEPTH} m body`
    );

    // (h) Nothing of the interior digs into the plinth or the roof.
    const top = floorY(descriptor.levels[descriptor.levels.length - 1]) + INTERIOR.CEILING;
    const vertical =
        plan.solids.every((solid) => solid.box.minY >= INTERIOR.FLOOR - 1e-6 && solid.box.maxY <= top + 1e-6) &&
        plan.plates.every((plate) => plate.y >= INTERIOR.FLOOR - 1e-6 && plate.y <= top + 1e-6);
    hooks.check('INTERIOR_STOREY_BAND', vertical, `${descriptor.buildingId}: every solid sits between ${INTERIOR.FLOOR} and ${top.toFixed(2)} m`);

    // (i) The exit point is outside the body, on the stoop, and the entry point
    // is inside the lobby: no door that opens into a wall.
    const outside = descriptor.exit.z > KHRUSHCHYOVKA.DEPTH / 2 + 0.5;
    const inside = descriptor.entry.z < INTERIOR.INNER_FRONT && Math.abs(descriptor.entry.x - descriptor.porchX) < 1.2;
    hooks.check('INTERIOR_ENTRY_OUTSIDE', outside, `${descriptor.buildingId}: exit stands ${descriptor.exit.z} m in front of the facade`);
    hooks.check('INTERIOR_ENTRY_INSIDE', inside, `${descriptor.buildingId}: entry stands ${descriptor.entry.z} m behind the panel`);

    // (j) The bounding box of the descriptor really contains the visible plan.
    // Walk surfaces are a query, not geometry: the stoop plate of the doorway
    // deliberately reaches past the facade.
    const box: InteriorRect = { minX: descriptor.bbox.minX, maxX: descriptor.bbox.maxX, minZ: descriptor.bbox.minZ, maxZ: descriptor.bbox.maxZ };
    const contained = plan.solids.every((solid) => contains(box, solid.box, 0)) && plan.plates.every((plate) => contains(box, plate.rect, 0));
    hooks.check('INTERIOR_BBOX', contained, `${descriptor.buildingId}: plan stays inside its declared bounding box`);
}

export function validateInteriors(objects: ObjectDescriptor[], hooks: ValidationHooks): void {
    // The interior profile mirrors the frozen building profile. If either moves,
    // the floor of a room stops landing on the storey of the facade: hard error.
    const profileOk =
        Math.abs(INTERIOR.FLOOR - KHRUSHCHYOVKA.PLINTH_HEIGHT) < 1e-9 &&
        Math.abs(INTERIOR.STOREY - KHRUSHCHYOVKA.FLOOR_HEIGHT) < 1e-9 &&
        Math.abs(INTERIOR.INNER_FRONT - (KHRUSHCHYOVKA.DEPTH / 2 - 0.06 - INTERIOR.EXTERIOR_WALL)) < 1e-9 &&
        Math.abs(INTERIOR.INNER_BACK + INTERIOR.INNER_FRONT) < 1e-9 &&
        INTERIOR.CORE.HALF * 2 < KHRUSHCHYOVKA.SECTION_WIDTH &&
        INTERIOR.PANE_Z < KHRUSHCHYOVKA.DEPTH / 2 - 0.10;
    hooks.check(
        'INTERIOR_PROFILE',
        profileOk,
        `floor ${INTERIOR.FLOOR}, storey ${INTERIOR.STOREY}, inner front ${INTERIOR.INNER_FRONT} mirror KHRUSHCHYOVKA`
    );

    if (!areInteriorsEnabled()) {
        hooks.check('INTERIOR_SWITCH', true, 'interior layer disabled by ?interior=off: no porch is opened');
        return;
    }

    const planned: Planned[] = [];
    objects.forEach((object) => {
        if (object.type !== 'khrushchyovka') return;
        const descriptor = object.parameters.interior as InteriorDescriptor | null | undefined;
        if (!descriptor || !descriptor.enabled) return;
        planned.push({ object, descriptor, plan: interiorPlanFor(descriptor) });
    });

    const towers = planned.length;
    const modes = new Set(planned.map((entry) => entry.descriptor.mode));
    const closed = objects.filter(
        (object) => object.type === 'khrushchyovka' && !(object.parameters.interior as InteriorDescriptor | null)
    ).length;

    hooks.check('INTERIOR_PRESENT', towers >= 1, `${towers} block(s) can be entered, ${closed} stay sealed`);
    hooks.check(
        'INTERIOR_VARIETY',
        modes.has('full') && (modes.has('partial') || modes.has('stairwell-only')) && closed >= 1,
        `modes ${Array.from(modes).join('/') || 'none'}, ${closed} closed block(s)`
    );

    planned.forEach((entry) => {
        const { descriptor } = entry;
        hooks.check(
            'INTERIOR_LEVELS',
            descriptor.levels.length >= 1 && descriptor.levels.every((level, index) => index === 0 || level === descriptor.levels[index - 1] + 1),
            `${descriptor.buildingId}: storeys ${descriptor.levels.join(', ')}`
        );

        // Two accessible flats of one block must not claim the same air, and no
        // flat may sit inside another porch's stair core.
        let clear = true;
        descriptor.flats.forEach((flat, index) => {
            descriptor.flats.slice(index + 1).forEach((other) => {
                if (flat.level === other.level && flat.x0 < other.x1 && other.x0 < flat.x1) clear = false;
            });
        });
        planned.forEach((other) => {
            if (other === entry) return;
            const coreMin = other.descriptor.porchX - INTERIOR.CORE.HALF;
            const coreMax = other.descriptor.porchX + INTERIOR.CORE.HALF;
            descriptor.flats.forEach((flat) => {
                if (flat.x1 > coreMin && flat.x0 < coreMax) clear = false;
            });
        });
        hooks.check('INTERIOR_FLATS_CLEAR', clear, `${descriptor.buildingId}: ${descriptor.flats.length} flat(s) clear of each other and of the other cores`);

        checkCore(entry, hooks);
        checkFlat(entry, hooks);

        hooks.measure(`${descriptor.buildingId}_interiorBoxes`, entry.plan.solids.filter((solid) => solid.collide).length + entry.plan.doors.length);
        hooks.measure(`${descriptor.buildingId}_interiorRooms`, entry.plan.rooms.length);
    });
}
