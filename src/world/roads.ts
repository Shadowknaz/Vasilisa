// Carriageway, pavement, pedestrian links, paved zones and kerbs. Every quad comes
// from the validated masks on the shared compression grid, so neighbouring quads
// share identical vertices and the layers never overlap in the same plane
// (TZ §6.1–§6.3). One merged mesh per surface class.
//
// Winter dressing ported from code_artifact.html §5.3: the kerbs are laid as
// separate blocks with alternating whitewash and a couple of sunken ones, and the
// street keeps a worn centre line. Neither touches the plan — kerbs carry no
// collider and the markings are flat decals 6 mm above the asphalt.
import { COLORS } from '../config/colors.js';
import { SURFACE } from '../config/world.js';
import { createQuadBuilder } from '../core/geometryBuilder.js';
import { makePS1Material } from '../core/ps1Material.js';
import { createSeededRandom } from '../core/random.js';
import { TEXTURE_TILES, textures } from '../core/textures.js';
import type { Group, Mesh, Texture } from 'three';
import type { Mask, MaskGrid } from './layout/maskGrid.js';
import type { CurbSegment, Layout, Masks } from './layout/createLayout.js';
import type { Crossing } from './layout/pedestrian.js';
import type { RoadEdge } from './layout/roadGraph.js';

// Kerb profile: low enough that the planar controller never notices it, wide
// enough to read at the iso camera distance. No collider — a real kerb would wall
// off the mandatory routes (TZ §6.3).
const CURB = {
    WIDTH: 0.14,
    HEIGHT: SURFACE.CURB_TOP,
    BURY: 0.02,
    // Sectional laying: 0.75 m blocks with an ice-filled joint, every second one
    // whitewashed (the old courtyard habit), a few knocked down by the frost.
    BLOCK: 0.75,
    JOINT: 0.02,
    WHITEWASH_STEP: 2,
    SUNKEN_STEP: 7,
    SUNKEN_INDEX: 3,
    SUNKEN_DROP: 0.06,
    // A block whose nose has been hit by a plough: lower and slightly spalled.
    CHIP_STEP: 11,
    CHIP_INDEX: 6,
    CHIP_DROP: 0.045,
    JITTER: 0.02,
    // The block overhangs a narrower, darker foot, so every kerb keeps a shadow
    // line at the asphalt instead of reading as a flat wall.
    HAUNCH: { HEIGHT: 0.05, INSET: 0.02, GAP: 0.002 },
    // Dropped kerb at the crossings: the blocks either side of the opening step
    // down, so the walk onto the zebra reads as a ramp and not as a wall.
    RAMP: { TOP: 0.055, REACH: 1.9 },
    SEED: 0x4b1d
};

// Worn centre line of the street only: the ring is a courtyard drive and never
// carried markings.
const MARKING = {
    WIDTH: 0.16,
    DASH: 3.0,
    GAP: 3.6,
    LIFT: 0.006,
    MISSING_RATIO: 0.22,
    SEED: 0x3c11,
    TILE: 2.4
};

const SURFACE_STYLES = {
    asphalt: {
        name: 'surface-asphalt',
        height: SURFACE.ASPHALT,
        tile: TEXTURE_TILES.ROAD,
        map: textures.roadWinter,
        color: 0x8f949a
    },
    sidewalk: {
        name: 'surface-sidewalk',
        height: SURFACE.PAVING,
        tile: TEXTURE_TILES.SIDEWALK,
        map: textures.sidewalkConcrete,
        color: 0x9aa0a6
    },
    pedestrian: {
        name: 'surface-pedestrian',
        height: SURFACE.PAVING,
        tile: TEXTURE_TILES.SIDEWALK,
        map: textures.sidewalkConcrete,
        color: 0xb0b6bc
    },
    paving: {
        name: 'surface-paving',
        height: SURFACE.PAVING,
        tile: TEXTURE_TILES.PAVING,
        map: textures.sidewalkConcrete,
        color: 0x7e848a
    }
};

interface SurfaceStyle {
    name: string;
    height: number;
    tile: number;
    map: Texture;
    color: number;
}

function buildLayer(group: Group, grid: MaskGrid, mask: Mask, style: SurfaceStyle): Mesh | null {
    const builder = createQuadBuilder();
    grid.forEachCell(mask, (rect) => builder.addPlane(rect, style.height, style.tile));
    if (builder.isEmpty()) return null;

    // Plates sit 2-4 cm above the terrain: they must share the unsnapped plane
    // with it (see core/ps1Material.ts).
    const mesh = builder.buildMesh(
        makePS1Material({ map: style.map, color: style.color }, { vertexSnap: false }),
        style.name
    );
    group.add(mesh);
    return mesh;
}

// One kerb block. `side` is the sign of the outward normal along the axis, so the
// block always grows away from the carriageway. `inset` shrinks the block on the
// carriageway side only, which is what turns the haunch into a shadow line.
function addCurbBlock(
    builder: ReturnType<typeof createQuadBuilder>,
    segment: CurbSegment,
    from: number,
    to: number,
    minY: number,
    maxY: number,
    inset: number,
    tile: number
): void {
    if (segment.axis === 'z') {
        const inner = segment.x + segment.side * inset;
        const edge = segment.x + segment.side * CURB.WIDTH;
        builder.addBox(
            {
                minX: Math.min(inner, edge),
                maxX: Math.max(inner, edge),
                minZ: from,
                maxZ: to,
                minY,
                maxY
            },
            tile
        );
        return;
    }

    const inner = segment.z + segment.side * inset;
    const edge = segment.z + segment.side * CURB.WIDTH;
    builder.addBox(
        {
            minX: from,
            maxX: to,
            minZ: Math.min(inner, edge),
            maxZ: Math.max(inner, edge),
            minY,
            maxY
        },
        tile
    );
}

// Distance from a kerb block to the nearest crossing opening that this segment
// actually opens onto: a crossing walked along z cuts the kerbs of a road that
// runs along x, and vice versa.
function rampTop(segment: CurbSegment, along: number, crossings: Crossing[]): number | null {
    let nearest = Number.POSITIVE_INFINITY;
    crossings.forEach((crossing) => {
        const cutsThisSegment = segment.axis === 'x' ? crossing.axis === 'z' : crossing.axis === 'x';
        if (!cutsThisSegment) return;
        const coordinate = segment.axis === 'x' ? crossing.x : crossing.z;
        nearest = Math.min(nearest, Math.abs(along - coordinate));
    });
    return nearest <= CURB.RAMP.REACH ? CURB.RAMP.TOP : null;
}

function buildCurbs(
    group: Group,
    segments: CurbSegment[],
    crossings: Crossing[]
): { grey: Mesh | null; whitewash: Mesh | null; haunch: Mesh | null } {
    const grey = createQuadBuilder();
    const whitewash = createQuadBuilder();
    const haunch = createQuadBuilder();
    const random = createSeededRandom(CURB.SEED);
    const tile = TEXTURE_TILES.CURB;
    const haunchTop = CURB.HAUNCH.HEIGHT;

    segments.forEach((segment) => {
        const start = segment.axis === 'z' ? segment.z0 : segment.x0;
        const end = segment.axis === 'z' ? segment.z1 : segment.x1;
        const count = Math.max(1, Math.round((end - start) / CURB.BLOCK));
        const blockLength = (end - start) / count;

        for (let index = 0; index < count; index++) {
            const from = start + index * blockLength + CURB.JOINT / 2;
            const to = start + (index + 1) * blockLength - CURB.JOINT / 2;
            const sunken = index % CURB.SUNKEN_STEP === CURB.SUNKEN_INDEX ? CURB.SUNKEN_DROP : 0;
            const chipped = index % CURB.CHIP_STEP === CURB.CHIP_INDEX ? CURB.CHIP_DROP : 0;
            const jitter = (random() - 0.5) * CURB.JITTER;
            const ramp = rampTop(segment, (from + to) / 2, crossings);
            const top = ramp !== null ? ramp + jitter : CURB.HEIGHT - sunken - chipped + jitter;
            const target = index % CURB.WHITEWASH_STEP === 0 ? whitewash : grey;

            addCurbBlock(haunch, segment, from, to, -CURB.BURY, haunchTop, CURB.HAUNCH.INSET, tile);
            addCurbBlock(target, segment, from, to, haunchTop + CURB.HAUNCH.GAP, top, 0, tile);
        }
    });

    const greyMesh = grey.isEmpty() ? null : grey.buildMesh(makePS1Material({ color: COLORS.CURB }), 'surface-curbs');
    const whitewashMesh = whitewash.isEmpty()
        ? null
        : whitewash.buildMesh(makePS1Material({ color: COLORS.FENCE_WHITEWASH }), 'surface-curbs-whitewash');
    const haunchMesh = haunch.isEmpty()
        ? null
        : haunch.buildMesh(makePS1Material({ color: COLORS.CONCRETE }), 'surface-curbs-haunch');

    [greyMesh, whitewashMesh, haunchMesh].forEach((mesh) => {
        if (!mesh) return;
        mesh.userData.height = CURB.HEIGHT;
        group.add(mesh);
    });

    return { grey: greyMesh, whitewash: whitewashMesh, haunch: haunchMesh };
}

// Faded dashes down the middle of the street. They are flat quads at
// SURFACE.ASPHALT + 6 mm, so no plane is ever duplicated.
function buildMarkings(group: Group, edges: RoadEdge[]): Mesh | null {
    const builder = createQuadBuilder();
    const random = createSeededRandom(MARKING.SEED);
    const height = SURFACE.ASPHALT + MARKING.LIFT;

    edges
        .filter((edge) => edge.kind === 'street')
        .forEach((edge) => {
            const [from, to] = edge.centerline;
            const start = Math.min(edge.axis === 'x' ? from.x : from.z, edge.axis === 'x' ? to.x : to.z);
            const end = Math.max(edge.axis === 'x' ? from.x : from.z, edge.axis === 'x' ? to.x : to.z);
            const cross = edge.axis === 'x' ? from.z : from.x;
            const step = MARKING.DASH + MARKING.GAP;
            const count = Math.floor((end - start) / step);

            for (let index = 0; index < count; index++) {
                if (random() < MARKING.MISSING_RATIO) continue;
                const dashStart = start + index * step;
                const dashEnd = dashStart + MARKING.DASH;
                builder.addPlane(
                    edge.axis === 'x'
                        ? {
                              minX: dashStart,
                              maxX: dashEnd,
                              minZ: cross - MARKING.WIDTH / 2,
                              maxZ: cross + MARKING.WIDTH / 2
                          }
                        : {
                              minX: cross - MARKING.WIDTH / 2,
                              maxX: cross + MARKING.WIDTH / 2,
                              minZ: dashStart,
                              maxZ: dashEnd
                          },
                    height,
                    MARKING.TILE
                );
            }
        });

    if (builder.isEmpty()) return null;
    const mesh = builder.buildMesh(
        makePS1Material({ color: COLORS.ROAD_MARKING }, { vertexSnap: false }),
        'surface-markings'
    );
    group.add(mesh);
    return mesh;
}

export function buildRoads(group: Group, { layout, masks, grid }: { layout: Layout; masks: Masks; grid: MaskGrid }) {
    const asphalt = buildLayer(group, grid, masks.asphalt, SURFACE_STYLES.asphalt);
    const sidewalk = buildLayer(group, grid, masks.sidewalk, SURFACE_STYLES.sidewalk);
    const pedestrian = buildLayer(group, grid, masks.pedestrian, SURFACE_STYLES.pedestrian);
    const paving = buildLayer(group, grid, masks.paving, SURFACE_STYLES.paving);
    const curbs = buildCurbs(group, layout.curbs, layout.crossings);
    const markings = buildMarkings(group, layout.roadGraph.edges);

    return { asphalt, sidewalk, pedestrian, paving, curbs, markings };
}
