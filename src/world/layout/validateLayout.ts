// Hard validation of the fixed plan (TZ §12). Every rule is measured on the real
// footprints and masks; a single failure means no scene geometry may be built.
import { CLEARANCE, FUNCTIONAL_ZONES, MECH_PLAN, PIPELINE, POLES, WORLD } from '../../config/layout.js';
import { expandRect, pointRectDistance, rectDepth, rectDistance, rectWidth, type PointXZ, type Rect } from './rect.js';
import { collectWorldFootprints, TREE_PROFILE, type ObjectDescriptor } from './footprints.js';
import { crossingClearRects, reservationsFor, type CircleReservation, type Reservations } from './reservations.js';
import { createNavigationWorld, isFreeAt, polylineFree, type NavTarget } from './pathPlanner.js';
import { validateInteriors } from '../interiors/validateInteriors.js';
import type { RoadGraph } from './roadGraph.js';
import type { Crossing, PedestrianRect } from './pedestrian.js';

const AREA_TOLERANCE = 0.02;
const PILOT_RADIUS = 0.42;
const EXEMPT_FROM_RESERVES = new Set(['yard-fence', 'po2-fence']);
const OBJECT_TYPES_WITH_VISUAL = new Set(['khrushchyovka', 'kiosk', 'booth', 'winter-tree', 'lawn-fence', 'sandbox', 'rocket', 'swing']);

// Non-solid winter decor (shrubs, snow fields, plates, manholes) has no collider,
// so the solid-footprint rules cannot see it. Each type declares how it may sit
// on the plan instead of being waved through:
//   on-asphalt  — the footprint must lie inside a carriageway rect;
//   on-paving   — inside a paved functional zone, off the carriageway and paths;
//   off-asphalt — off the carriageway and the pedestrian links, but allowed on
//                 the pavement band (ploughed snow along the kerb);
//   off-routes  — nowhere on asphalt, pedestrian links or pavement shells.
const DECOR_POLICY: Record<string, 'on-asphalt' | 'on-paving' | 'off-asphalt' | 'off-routes'> = {
    manhole: 'on-asphalt',
    grate: 'on-asphalt',
    'pag-slab': 'on-paving',
    'snow-patch': 'off-asphalt',
    shrub: 'off-routes'
};

function containsRect(outer: Rect, inner: Rect): boolean {
    return inner.minX >= outer.minX && inner.maxX <= outer.maxX && inner.minZ >= outer.minZ && inner.maxZ <= outer.maxZ;
}

// Paved functional zones come from the plan constants: the layout carries the
// zone rectangles but not what they are surfaced with.
const PAVED_ZONE_RECTS: Rect[] = FUNCTIONAL_ZONES.filter((zone) => zone.paved).map((zone) => ({ ...zone.rect }));

export interface ValidationCheck {
    id: string;
    passed: boolean;
    detail: string;
}

export interface MechMetrics {
    visualRadius: number;
    visualHeight: number;
}

export interface Validation {
    ok: boolean;
    errors: string[];
    checks: ValidationCheck[];
    measurements: Record<string, number>;
    mechRadius: number;
    targets: { pilot: NavTarget[]; mech: NavTarget[] };
}

// Only the parts of the frozen layout the validator reads; structurally satisfied
// by the planner's `layout` object without importing it (avoids a type cycle).
interface LayoutInput {
    world: { size: number; bounds: number };
    objects: ObjectDescriptor[];
    zones: { id: string; rect: Rect }[];
    pedestrian: { rects: PedestrianRect[] };
    crossings: Crossing[];
    reservations: Reservations;
    spawn: { x: number; z: number; radius: number; pilot: { x: number; z: number } };
    mechRoute: { routes: { id: string; points: PointXZ[] }[] };
}

// The validator only reads mask areas; the full mask bundle lives in createLayout.
interface MaskAreas {
    areas: { asphalt: number; sidewalk: number; pedestrian: number; paving: number; crossing: number };
}

function distanceToRects(rect: Rect, rects: Rect[]): number {
    return rects.reduce(
        (best, candidate) => Math.min(best, rectDistance(rect, candidate)),
        Number.POSITIVE_INFINITY
    );
}

function pointDistanceToRects(x: number, z: number, rects: Rect[]): number {
    return rects.reduce((best, candidate) => Math.min(best, pointRectDistance(x, z, candidate)), Number.POSITIVE_INFINITY);
}

function round(value: number, digits = 3): number {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

export function validateLayout({
    layout,
    graph,
    masks,
    mech
}: {
    layout: LayoutInput;
    graph: RoadGraph;
    masks: MaskAreas;
    mech: MechMetrics;
}): Validation {
    const checks: ValidationCheck[] = [];
    const errors: string[] = [];
    const measurements: Record<string, number> = {};

    const check = (id: string, passed: boolean, detail: string): void => {
        checks.push({ id, passed, detail });
        if (!passed) errors.push(`${id}: ${detail}`);
    };

    const bounds = layout.world.bounds;
    const objects = layout.objects;
    const solids = collectWorldFootprints(objects);
    const asphaltRects = graph.asphaltRects;
    const courtyardRects = [
        ...graph.edges.filter((edge) => edge.kind === 'courtyard').map((edge) => edge.strip),
        ...graph.pads.map((pad) => pad.rect)
    ];
    const streetRects = graph.edges.filter((edge) => edge.kind === 'street').map((edge) => edge.strip);

    // --- world and graph -----------------------------------------------------
    const side = layout.world.size;
    check(
        'WORLD_SIZE',
        side === 108 && Math.abs((side * side) / (54 * 54) - 4) < 1e-9,
        `side ${side}, area ratio ${round((side * side) / (54 * 54), 6)} (expected 108 / 4)`
    );

    graph.errors.forEach((message) => check('ROAD_GRAPH', false, message));
    check(
        'ROAD_GRAPH',
        graph.components === 1 && graph.cycles === 2 && graph.nodes.length === 8 && graph.edges.length === 9,
        `V=${graph.nodes.length} E=${graph.edges.length} components=${graph.components} cycles=${graph.cycles} length=${graph.axisLength}`
    );

    const asphaltArea = masks.areas.asphalt;
    check(
        'ROAD_AREA',
        Math.abs(asphaltArea - graph.expectedAsphaltArea) <= graph.expectedAsphaltArea * AREA_TOLERANCE,
        `union ${round(asphaltArea, 3)} m² vs ${graph.expectedAsphaltArea} ±${AREA_TOLERANCE * 100}%`
    );
    measurements.asphaltArea = round(asphaltArea, 3);
    measurements.sidewalkArea = round(masks.areas.sidewalk, 3);
    measurements.pedestrianArea = round(masks.areas.pedestrian, 3);
    measurements.pavingArea = round(masks.areas.paving, 3);

    // --- buildings -----------------------------------------------------------
    const buildings = objects.filter((object) => object.type === 'khrushchyovka');
    buildings.forEach((building) => {
        const footprint = building.worldVisualFootprint!;
        const toCourtyard = distanceToRects(footprint, courtyardRects);
        const toStreet = distanceToRects(footprint, streetRects);
        const edge = WORLD.HALF - Math.max(Math.abs(footprint.minX), Math.abs(footprint.maxX), Math.abs(footprint.minZ), Math.abs(footprint.maxZ));

        check(
            'BUILDING_TO_COURTYARD_ASPHALT',
            toCourtyard >= CLEARANCE.BUILDING_TO_COURTYARD_ASPHALT,
            `${building.id} ${round(toCourtyard)} m (min ${CLEARANCE.BUILDING_TO_COURTYARD_ASPHALT})`
        );
        check(
            'BUILDING_TO_STREET_ASPHALT',
            toStreet >= CLEARANCE.BUILDING_TO_STREET_ASPHALT,
            `${building.id} ${round(toStreet)} m (min ${CLEARANCE.BUILDING_TO_STREET_ASPHALT})`
        );
        check(
            'BUILDING_TO_EDGE',
            edge >= CLEARANCE.BUILDING_TO_EDGE,
            `${building.id} ${round(edge)} m (min ${CLEARANCE.BUILDING_TO_EDGE})`
        );
        measurements[`${building.id}_courtyard`] = round(toCourtyard);
        measurements[`${building.id}_street`] = round(toStreet);
    });

    const northRow = buildings.filter((building) => building.transform.z < 0);
    const southRow = buildings.filter((building) => building.transform.z > 0);
    [northRow, southRow].forEach((row) => {
        for (let left = 0; left < row.length; left++) {
            for (let right = left + 1; right < row.length; right++) {
                const gap = rectDistance(row[left].worldVisualFootprint!, row[right].worldVisualFootprint!);
                check(
                    'BUILDING_GABLE_GAP',
                    gap >= CLEARANCE.BUILDING_GABLE_GAP,
                    `${row[left].id}/${row[right].id} ${round(gap)} m (min ${CLEARANCE.BUILDING_GABLE_GAP})`
                );
                measurements[`gap_${row[left].id}_${row[right].id}`] = round(gap);
            }
        }
    });

    // --- functional zones and equipment --------------------------------------
    const byId = new Map(objects.map((object) => [object.id, object]));
    const playRect = layout.zones.find((zone) => zone.id === 'PLAY')!.rect;
    const yardRect = layout.zones.find((zone) => zone.id === 'TP_YARD')!.rect;
    const apronRect = layout.zones.find((zone) => zone.id === 'KIOSK_APRON')!.rect;
    const kiosk = byId.get('KIOSK')!;
    const booth = byId.get('TP')!;

    check(
        'PLAY_TO_ASPHALT',
        distanceToRects(playRect, asphaltRects) >= CLEARANCE.PLAY_TO_ASPHALT,
        `${round(distanceToRects(playRect, asphaltRects))} m (min ${CLEARANCE.PLAY_TO_ASPHALT})`
    );
    check(
        'PLAY_TO_TP_YARD',
        rectDistance(playRect, yardRect) >= CLEARANCE.PLAY_TO_TP_YARD,
        `${round(rectDistance(playRect, yardRect))} m (min ${CLEARANCE.PLAY_TO_TP_YARD})`
    );
    check(
        'PLAY_TO_KIOSK',
        rectDistance(playRect, kiosk.worldVisualFootprint!) >= CLEARANCE.PLAY_TO_KIOSK,
        `${round(rectDistance(playRect, kiosk.worldVisualFootprint!))} m (min ${CLEARANCE.PLAY_TO_KIOSK})`
    );
    check(
        'KIOSK_TO_ASPHALT',
        distanceToRects(kiosk.worldVisualFootprint!, asphaltRects) >= CLEARANCE.KIOSK_TO_ASPHALT,
        `${round(distanceToRects(kiosk.worldVisualFootprint!, asphaltRects))} m (min ${CLEARANCE.KIOSK_TO_ASPHALT})`
    );
    check(
        'BOOTH_TO_ASPHALT',
        distanceToRects(booth.worldVisualFootprint!, asphaltRects) >= CLEARANCE.BOOTH_TO_ASPHALT,
        `${round(distanceToRects(booth.worldVisualFootprint!, asphaltRects))} m (min ${CLEARANCE.BOOTH_TO_ASPHALT})`
    );
    measurements.kioskToApron = round(rectDistance(kiosk.worldVisualFootprint!, apronRect));
    check(
        'KIOSK_APRON_CONTACT',
        rectDistance(kiosk.worldVisualFootprint!, apronRect) <= 0.1,
        `kiosk window ${round(rectDistance(kiosk.worldVisualFootprint!, apronRect))} m from the visitor area`
    );

    // --- trees ---------------------------------------------------------------
    const trees = objects.filter((object) => object.type === 'winter-tree');
    const buildingFootprints = buildings.map((building) => building.worldVisualFootprint!);
    const kioskFootprints = [kiosk.worldVisualFootprint!, booth.worldVisualFootprint!];
    const pavedRects = [
        ...layout.pedestrian.rects.map((entry) => entry.rect),
        ...layout.zones.filter((zone) => zone.id !== 'PLAY').map((zone) => zone.rect),
        ...graph.sidewalkShells
    ];

    trees.forEach((tree) => {
        const x = tree.transform.x;
        const z = tree.transform.z;
        const crown = tree.parameters.crownRadius;
        const toBuilding = pointDistanceToRects(x, z, buildingFootprints);
        const toStreetFurniture = pointDistanceToRects(x, z, kioskFootprints);
        const toAsphalt = pointDistanceToRects(x, z, asphaltRects);
        const toPaving = pointDistanceToRects(x, z, pavedRects) - crown;

        check(
            'TREE_CENTER_TO_BUILDING',
            Math.min(toBuilding, toStreetFurniture) >= CLEARANCE.TREE_CENTER_TO_BUILDING,
            `${tree.id} ${round(Math.min(toBuilding, toStreetFurniture))} m (min ${CLEARANCE.TREE_CENTER_TO_BUILDING})`
        );
        check(
            'TREE_CENTER_TO_ASPHALT',
            toAsphalt >= CLEARANCE.TREE_CENTER_TO_ASPHALT,
            `${tree.id} ${round(toAsphalt)} m (min ${CLEARANCE.TREE_CENTER_TO_ASPHALT})`
        );
        check(
            'TREE_BRANCHES_TO_PAVING',
            toPaving >= CLEARANCE.TREE_BRANCHES_TO_PAVING,
            `${tree.id} branches ${round(toPaving)} m (min ${CLEARANCE.TREE_BRANCHES_TO_PAVING})`
        );
        measurements[`${tree.id}_branches_to_paving`] = round(toPaving);
    });

    for (let first = 0; first < trees.length; first++) {
        for (let second = first + 1; second < trees.length; second++) {
            const gap = Math.hypot(
                trees[first].transform.x - trees[second].transform.x,
                trees[first].transform.z - trees[second].transform.z
            );
            check(
                'TREE_TO_TREE',
                gap >= CLEARANCE.TREE_TO_TREE,
                `${trees[first].id}/${trees[second].id} ${round(gap)} m (min ${CLEARANCE.TREE_TO_TREE})`
            );
        }
    }

    check(
        'TREE_CROWN_CAP',
        trees.every((tree) => tree.parameters.crownRadius <= TREE_PROFILE.CROWN_RADIUS + 1e-9),
        `max crown radius ${round(Math.max(...trees.map((tree) => tree.parameters.crownRadius)))} m (cap ${TREE_PROFILE.CROWN_RADIUS})`
    );
    measurements.maxCrownRadius = round(Math.max(...trees.map((tree) => tree.parameters.crownRadius)));

    // --- winter decor and lawn fences ---------------------------------------
    const lawnFences = objects.filter((object) => object.type === 'lawn-fence');
    const fenceFootprints = objects
        .filter((object) => object.type === 'lawn-fence' || object.type === 'po2-fence')
        .flatMap((object) => object.worldFootprints);

    trees.forEach((tree) => {
        const crown = tree.worldVisualFootprint!;
        const gap = fenceFootprints.reduce(
            (best, footprint) => Math.min(best, rectDistance(crown, footprint)),
            Number.POSITIVE_INFINITY
        );
        check(
            'TREE_CLEAR_OF_FENCE',
            gap >= CLEARANCE.TREE_TO_FENCE,
            `${tree.id} crown ${round(gap)} m from the nearest fence (min ${CLEARANCE.TREE_TO_FENCE})`
        );
    });

    // The lawn fences must leave the playground link open: a solid run across it
    // would cut the pilot off from the only declared entrance to the PLAY zone.
    const playLink = layout.pedestrian.rects.find((entry) => entry.id === 'LINK-PLAY');
    if (playLink) {
        const opening = expandRect(playLink.rect, PILOT_RADIUS);
        lawnFences.forEach((fence) => {
            const gap = fence.worldFootprints.reduce(
                (best, footprint) => Math.min(best, rectDistance(opening, footprint)),
                Number.POSITIVE_INFINITY
            );
            check('PLAY_FENCE_OPENING', gap > 0, `${fence.id} ${round(gap)} m from the playground link`);
        });
    }

    // Decor has no collider, so the solid rules never see it. Its footprint is
    // measured against the surfaces it must not punch through instead.
    const routeRects: Rect[] = [
        ...asphaltRects,
        ...layout.pedestrian.rects.map((entry) => entry.rect),
        ...graph.sidewalkShells
    ];

    objects.forEach((object) => {
        const policy = DECOR_POLICY[object.type];
        const footprint = object.worldVisualFootprint;
        if (!policy || !footprint) return;

        if (policy === 'on-asphalt') {
            const inside = asphaltRects.some((rect) => containsRect(rect, footprint));
            check(
                'DECOR_PLACEMENT',
                inside,
                `${object.id} (${object.type}) must sit fully inside a carriageway`
            );
            return;
        }

        if (policy === 'on-paving') {
            const onPaving = PAVED_ZONE_RECTS.some((rect) => containsRect(rect, footprint));
            const clearOfRoutes = routeRects.every((rect) => rectDistance(rect, footprint) > 0);
            check(
                'DECOR_PLACEMENT',
                onPaving && clearOfRoutes,
                `${object.id} (${object.type}) must stay inside a paved zone, off the routes`
            );
            return;
        }

        if (policy === 'off-asphalt') {
            const hardRects: Rect[] = [...asphaltRects, ...layout.pedestrian.rects.map((entry) => entry.rect)];
            const clear = hardRects.every((rect) => rectDistance(rect, footprint) > 0);
            check(
                'DECOR_PLACEMENT',
                clear,
                `${object.id} (${object.type}) overlaps the carriageway or a pedestrian link`
            );
            return;
        }

        const clearOfRoutes = routeRects.every((rect) => rectDistance(rect, footprint) > 0);
        check('DECOR_PLACEMENT', clearOfRoutes, `${object.id} (${object.type}) overlaps a route surface`);
    });

    // --- reserved areas ------------------------------------------------------
    objects.forEach((object) => {
        if (EXEMPT_FROM_RESERVES.has(object.type)) return;
        const applicable = reservationsFor(layout.reservations, object);
        object.worldFootprints.forEach((footprint) => {
            applicable.forEach((reservation) => {
                const gap = rectDistance(footprint, reservation.rect);
                check(
                    'OBJECT_TO_FUNCTIONAL_RESERVE',
                    gap >= CLEARANCE.OBJECT_TO_RESERVATION,
                    `${object.id} vs ${reservation.id} ${round(gap)} m (min ${CLEARANCE.OBJECT_TO_RESERVATION})`
                );
            });
        });
    });

    layout.crossings.forEach((crossing) => {
        const clear = crossingClearRects([crossing])[0];
        solids.forEach((solid) => {
            const gap = rectDistance(clear.rect, solid.rect);
            check(
                'CROSSING_CLEAR',
                gap > 0,
                `${solid.objectId} inside ${clear.id} (${round(gap)} m)`
            );
        });
    });

    layout.reservations.list
        .filter((reservation): reservation is CircleReservation => reservation.kind === 'node')
        .forEach((reservation) => {
            solids.forEach((solid) => {
                const gap = pointRectDistance(reservation.circle.x, reservation.circle.z, solid.rect) - reservation.circle.radius;
                check(
                    'ROAD_NODE_CLEAR',
                    gap >= 0,
                    `${solid.objectId} inside the ${reservation.id} disk (${round(gap)} m)`
                );
            });
        });

    // --- pedestrian network --------------------------------------------------
    layout.pedestrian.rects.forEach((entry) => {
        const narrow = Math.min(rectWidth(entry.rect), rectDepth(entry.rect));
        const expected = entry.kind === 'approach' ? CLEARANCE.ENTRANCE_APPROACH_WIDTH : CLEARANCE.PEDESTRIAN_WIDTH;
        check(
            entry.kind === 'approach' ? 'ENTRANCE_APPROACH' : 'PEDESTRIAN_WIDTH',
            Math.abs(narrow - expected) < 1e-6 && Math.abs(entry.width - expected) < 1e-6,
            `${entry.id} ${round(narrow)} m (expected ${expected})`
        );
    });
    const approaches = layout.pedestrian.rects.filter((entry) => entry.kind === 'approach');
    check('ENTRANCE_APPROACH_COUNT', approaches.length === 12, `${approaches.length} approaches (expected 12)`);

    approaches.forEach((approach) => {
        const access = layout.objects
            .flatMap((object) => object.accessPoints)
            .find((point) => point.id === approach.accessId)!;
        const owner = byId.get(approach.ownerId!)!;
        const porchParts = owner.worldFootprints.slice(1);
        const setback = pointDistanceToRects(access.world.x, access.world.z, porchParts);
        check(
            'ENTRANCE_STANDOFF',
            setback >= PILOT_RADIUS,
            `${approach.id} stands ${round(setback)} m from the steps (min ${PILOT_RADIUS})`
        );
    });

    // --- mech passage --------------------------------------------------------
    const corridors = graph.edges.map((edge) => ({
        id: `CORRIDOR-${edge.id}`,
        rect: expandRect(edge.strip, edge.sidewalk),
        width: edge.width + edge.sidewalk * 2
    }));

    corridors.forEach((corridor) => {
        check(
            'MECH_CORRIDOR_WIDTH',
            corridor.width >= 8.5 - 1e-9,
            `${corridor.id} ${round(corridor.width)} m wide (min 8.5)`
        );
        solids.forEach((solid) => {
            const gap = rectDistance(corridor.rect, solid.rect);
            check(
                'MECH_PASSAGE',
                gap > 0,
                `${solid.objectId} intrudes into ${corridor.id} (gap ${round(gap)} m)`
            );
        });
    });

    // --- spawn, wires, world edge -------------------------------------------
    const spawnCircle = layout.spawn;
    solids.forEach((solid) => {
        const gap = pointRectDistance(spawnCircle.x, spawnCircle.z, solid.rect) - spawnCircle.radius;
        check('SPAWN_CLEAR', gap >= 0, `${solid.objectId} ${round(gap)} m inside the spawn circle`);
    });
    check(
        'SPAWN_EXIT_FREE',
        isFreeAt(spawnCircle.pilot.x, spawnCircle.pilot.z, PILOT_RADIUS, solids.map((solid) => solid.rect), bounds),
        `pilot exit (${round(spawnCircle.pilot.x)}, ${round(spawnCircle.pilot.z)}) must be free at r=${PILOT_RADIUS}`
    );

    const wireMinY = POLES.anchorY - POLES.sag;
    check(
        'WIRE_CLEARANCE',
        wireMinY >= mech.visualHeight + CLEARANCE.CLEAR_HEADROOM,
        `wire sag ${round(wireMinY)} m vs mech ${round(mech.visualHeight)} + ${CLEARANCE.CLEAR_HEADROOM}`
    );
    measurements.wireMinY = round(wireMinY);

    // The line of poles runs outside the eastern buildings; the wire never spans
    // the courtyard itself (TZ §6.5).
    const wireBuildingGap = Math.min(...buildings.map((building) => POLES.x - building.worldVisualFootprint!.maxX));
    check('WIRE_CLEAR_OF_BUILDINGS', wireBuildingGap >= 1, `pole line ${round(wireBuildingGap)} m from the nearest building`);

    objects.forEach((object) => {
        if (!OBJECT_TYPES_WITH_VISUAL.has(object.type)) return;
        const footprint = object.worldVisualFootprint!;
        const edge = WORLD.HALF - Math.max(Math.abs(footprint.minX), Math.abs(footprint.maxX), Math.abs(footprint.minZ), Math.abs(footprint.maxZ));
        check('OBJECT_TO_EDGE', edge >= CLEARANCE.BUILDING_TO_EDGE, `${object.id} ${round(edge)} m from the cut edge`);
    });

    check(
        'PIPELINE_BLOCKER',
        Math.abs(PIPELINE.z - 48.5) < 1e-9 && rectDistance(byId.get(PIPELINE.id)!.worldFootprints[0], { minX: -30, minZ: 46, maxX: 30, maxZ: 51 }) === 0,
        'pipeline blocker must stay inside the reserved southern strip X[−30;30] Z[46;51]'
    );

    // --- navigation ----------------------------------------------------------
    const barriers = solids.map((solid) => solid.rect);
    const navigation = createNavigationWorld({ barriers, bounds, step: 0.5 });

    const entranceTargets = layout.objects
        .flatMap((object) => object.accessPoints)
        .map((point) => ({ id: point.id, x: point.world.x, z: point.world.z }));
    const pilotTargets = [
        ...entranceTargets,
        { id: 'PLAY', x: playRect.minX - 0.5, z: 4 },
        { id: 'KIOSK', x: apronRect.minX + 1, z: -7 },
        { id: 'TP_GATE', x: 35, z: -9 }
    ];

    const pilotReach = navigation.reachable({
        from: { x: spawnCircle.x, z: spawnCircle.z },
        targets: pilotTargets,
        radius: PILOT_RADIUS
    });
    check(
        'ACCESS_REACHABILITY',
        pilotReach.ok,
        pilotReach.ok ? `pilot reaches ${pilotTargets.length} targets` : `unreachable: ${pilotReach.unreachable.join(', ')}`
    );

    const mechRadius = Math.max(MECH_PLAN.COLLIDER_RADIUS, mech.visualRadius);
    measurements.mechRadius = round(mechRadius);
    layout.mechRoute.routes.forEach((route) => {
        const clear = polylineFree(route.points, mechRadius, barriers, bounds);
        check(
            'MECH_ROUTE',
            clear,
            clear ? `${route.id} free at r=${round(mechRadius)}` : `${route.id} blocked at r=${round(mechRadius)}`
        );
    });

    const mechFrom = { x: spawnCircle.x, z: spawnCircle.z };
    const mechTargets = layout.mechRoute.routes
        .flatMap((route) => route.points)
        .filter((point, index, all) => all.findIndex((other) => other.x === point.x && other.z === point.z) === index)
        .map((point) => ({ id: `NODE-${point.x}_${point.z}`, x: point.x, z: point.z }));
    const mechReach = navigation.reachable({ from: mechFrom, targets: mechTargets, radius: MECH_PLAN.COLLIDER_RADIUS });
    check(
        'MECH_REACHABILITY',
        mechReach.ok,
        mechReach.ok ? `${mechTargets.length} road nodes reachable at r=${MECH_PLAN.COLLIDER_RADIUS}` : `unreachable: ${mechReach.unreachable.join(', ')}`
    );

    // Continuous re-check of the pilot route from the spawn to the furthest porch.
    const firstEntrance = entranceTargets[0];
    if (firstEntrance) {
        const path = navigation.findPath({ from: mechFrom, to: firstEntrance, radius: PILOT_RADIUS });
        const clear = path ? polylineFree([mechFrom, ...path, firstEntrance], PILOT_RADIUS, barriers, bounds) : false;
        check(
            'PILOT_SEGMENT_CHECK',
            clear,
            clear ? `spawn → ${firstEntrance.id} sampled clear` : `spawn → ${firstEntrance.id} crosses a collider`
        );
    }

    // --- interiors -----------------------------------------------------------
    // The plan of every opened porch is re-derived from its descriptor and walked
    // at the pilot's own radius: a doorway the body cannot pass is a hard error.
    validateInteriors(objects, {
        check,
        measure: (key, value) => {
            measurements[key] = round(value, 3);
        }
    });

    return {
        ok: errors.length === 0,
        errors,
        checks,
        measurements,
        mechRadius,
        targets: { pilot: pilotTargets, mech: mechTargets }
    };
}
