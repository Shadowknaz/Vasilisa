// Functional zones and reserved areas: playground, transformer yard, kiosk apron,
// service pads, dynamic reserves, spawn circle and road-node clear disks.
// TZ §6.2, §6.4. A reservation never adds geometry — it only constrains what may
// be placed where, and the validator measures every solid footprint against it.
import { FUNCTIONAL_ZONES, ROAD, SPAWN } from '../../config/layout.js';
import { gateRect, servicePathRects, type ObjectDescriptor } from './footprints.js';
import type { Rect } from './rect.js';
import type { Crossing } from './pedestrian.js';

export interface RectReservation {
    id: string;
    kind: string;
    rect: Rect;
    owner: string | null;
    sourceId?: string;
    zoneKind?: string;
    strict: boolean;
}

export interface CircleReservation {
    id: string;
    kind: string;
    circle: { x: number; z: number; radius: number };
    owner?: string;
}

export interface Reservations {
    zones: RectReservation[];
    objectReservations: RectReservation[];
    service: RectReservation[];
    gate: RectReservation;
    spawn: CircleReservation;
    nodeClear: CircleReservation[];
    rects: RectReservation[];
    list: Array<RectReservation | CircleReservation>;
}

interface CrossingClearRect {
    id: string;
    kind: string;
    crossingId: string;
    rect: Rect;
}

// TZ §6.4: crossings keep a free rectangle ±6 along the road and ±4.25 across it;
// B/C/L/R nodes keep a free disk of radius 6 from new standalone solid objects.
const CROSSING_CLEAR = { TANGENT: 6, NORMAL: 4.25 };
const NODE_CLEAR_RADIUS = 6;

export function createReservations(objects: ObjectDescriptor[]): Reservations {
    const zones: RectReservation[] = FUNCTIONAL_ZONES.map((zone) => ({
        id: zone.id,
        kind: 'zone',
        zoneKind: zone.kind,
        rect: { ...zone.rect },
        owner: zone.owner,
        strict: false
    }));

    const objectReservations: RectReservation[] = [];
    objects.forEach((object) => {
        object.reservations.forEach((reservation) => {
            objectReservations.push({
                id: reservation.id,
                kind: reservation.kind,
                rect: { ...reservation.rect },
                owner: object.ownerZone,
                sourceId: object.id,
                strict: reservation.strict === true
            });
        });
    });

    const service: RectReservation[] = servicePathRects().map((rect, index) => ({
        id: `TP-SERVICE-${index + 1}`,
        kind: 'service',
        rect,
        owner: 'transformer',
        sourceId: 'TP',
        strict: true
    }));

    const gate: RectReservation = {
        id: 'TP-GATE',
        kind: 'access',
        rect: gateRect(),
        owner: 'transformer',
        sourceId: 'TP',
        strict: true
    };

    const spawn: CircleReservation = {
        id: 'SPAWN',
        kind: 'spawn',
        circle: { x: SPAWN.x, z: SPAWN.z, radius: SPAWN.radius },
        owner: 'spawn'
    };

    const nodeClear: CircleReservation[] = (Object.keys(ROAD.NODES) as Array<keyof typeof ROAD.NODES>)
        .filter((id) => ['B', 'C', 'L', 'R'].includes(id))
        .map((id) => ({
            id: `NODE-${id}`,
            kind: 'node',
            circle: { x: ROAD.NODES[id][0], z: ROAD.NODES[id][1], radius: NODE_CLEAR_RADIUS }
        }));

    const rectReservations: RectReservation[] = [...zones, ...objectReservations, ...service, gate];

    return {
        zones,
        objectReservations,
        service,
        gate,
        spawn,
        nodeClear,
        rects: rectReservations,
        list: [...rectReservations, spawn, ...nodeClear]
    };
}

// Reservations that apply to an object: its own reserves and the zone it belongs
// to are exempt; every other zone and strict reserve may not be entered.
export function reservationsFor(reservations: Reservations, object: ObjectDescriptor): RectReservation[] {
    return reservations.rects.filter((reservation) => {
        if (reservation.sourceId === object.id) return false;
        if (reservation.owner && reservation.owner === object.ownerZone) return false;
        return true;
    });
}

// Clear rectangles of a pedestrian crossing: ±6 along the road, ±4.25 across it.
export function crossingClearRects(crossings: Crossing[]): CrossingClearRect[] {
    return crossings.map((crossing) => {
        // A crossing whose walk axis is z spans a road that runs along x.
        const along = crossing.axis === 'z' ? 'x' : 'z';
        const tangent = CROSSING_CLEAR.TANGENT;
        const normal = CROSSING_CLEAR.NORMAL;
        return {
            id: `CLEAR-${crossing.id}`,
            kind: 'crossing',
            crossingId: crossing.id,
            rect:
                along === 'x'
                    ? {
                          minX: crossing.x - tangent,
                          maxX: crossing.x + tangent,
                          minZ: crossing.z - normal,
                          maxZ: crossing.z + normal
                      }
                    : {
                          minX: crossing.x - normal,
                          maxX: crossing.x + normal,
                          minZ: crossing.z - tangent,
                          maxZ: crossing.z + tangent
                      }
        };
    });
}
