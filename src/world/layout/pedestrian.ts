// Pedestrian network of the fixed plan (TZ §6.4): one courtyard path, two marked
// crossings of the ring, links to the playground, kiosk and transformer gate, a
// service loop inside the yard and one 1.5 m approach per entrance.
// Nothing here invents routes — every link is declared and measured.
import { FUNCTIONAL_ZONES, SPAWN } from '../../config/layout.js';
import { expandRect, type Rect } from './rect.js';
import { KHRUSHCHYOVKA, transformPoint, type ObjectDescriptor } from './footprints.js';
import type { RoadEdge, RoadGraph } from './roadGraph.js';

export interface Crossing {
    id: string;
    x: number;
    z: number;
    axis: 'x' | 'z';
}

interface CrossingDef extends Crossing {
    rect: Rect;
}

export interface PedestrianRect {
    id: string;
    kind: string;
    width: number;
    rect: Rect;
    ownerId?: string;
    accessId?: string;
}

type Side = 'north' | 'south';

const MAIN_PATH_X = -18;
const MAIN_PATH_WIDTH = 2;
const APPROACH_WIDTH = 1.5;
const PLAY_RECT = FUNCTIONAL_ZONES.find((zone) => zone.id === 'PLAY')!.rect;

function ringEdge(graph: RoadGraph, id: string): RoadEdge | null {
    return graph.edges.find((edge) => edge.id === id) || null;
}

function shellOf(edge: RoadEdge): Rect {
    return expandRect(edge.strip, edge.sidewalk);
}

// Edge of the carriageway that faces the courtyard: the path and the crossings
// start here, so no pedestrian quad is ever laid on top of the asphalt twice.
function asphaltInnerEdge(graph: RoadGraph, side: Side): number {
    const edge = ringEdge(graph, side === 'north' ? 'L-R' : 'S-T')!;
    return side === 'north' ? edge.strip.maxZ : edge.strip.minZ;
}

// Outer edge of the ring pavement on the housing side: the approach stops here so
// it joins the sidewalk band without a second coplanar polygon.
function sidewalkOuterEdge(graph: RoadGraph, side: Side): number {
    const edge = ringEdge(graph, side === 'north' ? 'L-R' : 'S-T')!;
    const shell = shellOf(edge);
    return side === 'north' ? shell.minZ : shell.maxZ;
}

function entranceApproaches(graph: RoadGraph, objects: ObjectDescriptor[]): PedestrianRect[] {
    const approaches: PedestrianRect[] = [];

    objects
        .filter((object) => object.type === 'khrushchyovka')
        .forEach((object) => {
            const side = object.transform.z < 0 ? 'north' : 'south';
            const edgeZ = sidewalkOuterEdge(graph, side);

            object.accessPoints.forEach((point) => {
                const porchFront = transformPoint(object.transform, point.porchX!, KHRUSHCHYOVKA.PORCH.MAX_Z);
                const half = APPROACH_WIDTH / 2;
                approaches.push({
                    id: `APPROACH-${point.id}`,
                    kind: 'approach',
                    width: APPROACH_WIDTH,
                    ownerId: object.id,
                    accessId: point.id,
                    rect: {
                        minX: point.world.x - half,
                        maxX: point.world.x + half,
                        minZ: Math.min(porchFront.z, edgeZ),
                        maxZ: Math.max(porchFront.z, edgeZ)
                    }
                });
            });
        });

    return approaches;
}

export function createPedestrianNetwork({ graph, objects }: { graph: RoadGraph; objects: ObjectDescriptor[] }) {
    const northEdge = asphaltInnerEdge(graph, 'north');
    const southEdge = asphaltInnerEdge(graph, 'south');
    const northShell = shellOf(ringEdge(graph, 'L-R')!);
    const southShell = shellOf(ringEdge(graph, 'S-T')!);

    const mainPath = {
        id: 'PATH-MAIN',
        kind: 'path',
        width: MAIN_PATH_WIDTH,
        rect: {
            minX: MAIN_PATH_X - MAIN_PATH_WIDTH / 2,
            maxX: MAIN_PATH_X + MAIN_PATH_WIDTH / 2,
            minZ: northEdge,
            maxZ: southEdge
        }
    };

    const crossings: CrossingDef[] = [
        {
            id: 'CROSS-N',
            x: MAIN_PATH_X,
            z: -22,
            axis: 'z',
            rect: {
                minX: mainPath.rect.minX,
                maxX: mainPath.rect.maxX,
                minZ: northShell.minZ,
                maxZ: northEdge
            }
        },
        {
            id: 'CROSS-S',
            x: MAIN_PATH_X,
            z: 22,
            axis: 'z',
            rect: {
                minX: mainPath.rect.minX,
                maxX: mainPath.rect.maxX,
                minZ: southEdge,
                maxZ: southShell.maxZ
            }
        }
    ];

    const playLink = {
        id: 'LINK-PLAY',
        kind: 'link',
        width: MAIN_PATH_WIDTH,
        rect: {
            minX: mainPath.rect.minX,
            maxX: PLAY_RECT.minX,
            minZ: 3,
            maxZ: 5
        }
    };

    const kioskLink = {
        id: 'LINK-KIOSK',
        kind: 'link',
        width: MAIN_PATH_WIDTH,
        rect: { minX: -37.75, maxX: -35, minZ: -8, maxZ: -6 }
    };

    // Southern detour of the kiosk: (35,−9)-style straight run shifted to z=−16.5 so
    // the reserved tree crown at (−24,−13) keeps its 0.5 m clearance.
    const bypass = [
        {
            id: 'LINK-KIOSK-BYPASS-W',
            kind: 'link',
            width: MAIN_PATH_WIDTH,
            rect: { minX: -34, maxX: -32, minZ: -17.75, maxZ: -10 }
        },
        {
            id: 'LINK-KIOSK-BYPASS-S',
            kind: 'link',
            width: MAIN_PATH_WIDTH,
            rect: { minX: -34, maxX: mainPath.rect.minX + 1, minZ: -17.75, maxZ: -15.75 }
        }
    ];

    const gateApproach = {
        id: 'LINK-TP-GATE',
        kind: 'link',
        width: MAIN_PATH_WIDTH,
        rect: { minX: 35, maxX: 37.75, minZ: -10, maxZ: -8 }
    };

    const yardService = {
        id: 'LINK-TP-SERVICE',
        kind: 'service',
        width: 2,
        rect: { minX: 29, maxX: 35, minZ: -10, maxZ: -8 }
    };

    const approaches = entranceApproaches(graph, objects);
    const rects: PedestrianRect[] = [
        mainPath,
        ...crossings.map((crossing) => ({
            id: crossing.id,
            kind: 'crossing',
            width: MAIN_PATH_WIDTH,
            rect: crossing.rect
        })),
        playLink,
        kioskLink,
        ...bypass,
        gateApproach,
        yardService,
        ...approaches
    ];

    return {
        rects,
        crossings: crossings.map((crossing) => ({
            id: crossing.id,
            x: crossing.x,
            z: crossing.z,
            axis: crossing.axis
        })),
        approaches,
        links: {
            mainPath,
            playLink,
            kioskLink,
            bypass,
            gateApproach,
            yardService
        },
        spawn: {
            x: SPAWN.x,
            z: SPAWN.z,
            yaw: SPAWN.yaw,
            radius: SPAWN.radius,
            pilot: {
                x: SPAWN.x + Math.sin(SPAWN.yaw) * SPAWN.pilotOffset,
                z: SPAWN.z + Math.cos(SPAWN.yaw) * SPAWN.pilotOffset,
                yaw: SPAWN.yaw
            }
        }
    };
}

export type PedestrianNetwork = ReturnType<typeof createPedestrianNetwork>;
