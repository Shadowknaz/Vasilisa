// Settled snow on the diorama: continuous snow blanket decor with rounded,
// volumetric snowdrifts (сугробы), layered lawn cushions, ploughed roadside banks,
// wall drifts and dry winter stems.
//
// Winter dressing is decorative decor within the diorama. Drifts use rounded,
// multi-facet chamfered/domed geometry that eliminates sharp razor-edge ridges,
// naturally billowing and undulating across the winter courtyard.
import { COLORS } from '../config/colors.js';
import { createQuadBuilder } from '../core/geometryBuilder.js';
import { snowCapMat, snowSoilMat } from '../core/materials.js';
import { makePS1Material } from '../core/ps1Material.js';
import { createSeededRandom } from '../core/random.js';
import { objectsOfType } from './placement.js';
import type { Layout, CurbSegment } from './layout/createLayout.js';
import type { SurfaceField } from './surfaceField.js';
import type { ObjectDescriptor } from './layout/footprints.js';
import * as THREE from 'three';

const PATCH = {
    LIFT: 0.003,
    TILE: 1.6,
    STEM: { WIDTH: 0.032, HEIGHT: 0.28, TILT: 0.35 },
    DRIFT: {
        DIRTY_RATIO: 0.0,
        ROADSIDE_DIRTY_RATIO: 0.22,
        WALL_DIRTY_RATIO: 0.0,
        WIND_YAW: 0.28, // Prevailing winter wind angle (~16 deg)
        YAW_JITTER: 0.22
    }
};

// Dry winter stems poking through snowdrifts: crossed vertical quads.
function addStem(
    builder: ReturnType<typeof createQuadBuilder>,
    x: number,
    base: number,
    z: number,
    tiltX: number,
    tiltZ: number
): void {
    const half = PATCH.STEM.WIDTH / 2;
    const top = base + PATCH.STEM.HEIGHT;
    const uvs = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1]
    ];

    builder.addQuad(
        [
            [x - half, base, z],
            [x + half, base, z],
            [x + half + tiltX, top, z + tiltZ],
            [x - half + tiltX, top, z + tiltZ]
        ],
        [0, 0, 1],
        uvs
    );
    builder.addQuad(
        [
            [x, base, z - half],
            [x, base, z + half],
            [x + tiltX, top, z + half + tiltZ],
            [x + tiltX, top, z - half + tiltZ]
        ],
        [1, 0, 0],
        uvs
    );
}

interface DriftSpec {
    x: number;
    z: number;
    yaw: number;
    length: number;
    width: number;
    height: number;
    asymmetry?: number;
    isBank?: boolean;
    bankSide?: number;
    topWidthRatio?: number;
    topLengthRatio?: number;
    twoTier?: boolean;
    isDirty?: boolean;
    stems?: number;
}

function addCurvedDrift(
    builder: ReturnType<typeof createQuadBuilder>,
    surface: SurfaceField,
    spec: DriftSpec
): void {
    const {
        x: cx,
        z: cz,
        yaw,
        length,
        width,
        height,
        asymmetry = 0,
        isBank = false,
        bankSide = 1
    } = spec;

    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);

    // Dynamic tessellation: smooth curve along length and width
    const segsU = length > 6 ? 8 : 6;
    const segsV = width > 2.2 ? 5 : 4;

    const halfL = length / 2;
    const halfW = width / 2;
    const crestV = Math.max(-0.4, Math.min(0.4, asymmetry));

    const points: [number, number, number][][] = [];

    for (let i = 0; i <= segsU; i++) {
        points[i] = [];
        const u = -1 + (2 * i) / segsU;
        // Smooth cosine dome along length tapering to 0 at ends
        const fu = Math.max(0, Math.cos((u * Math.PI) / 2));

        for (let j = 0; j <= segsV; j++) {
            const v = -1 + (2 * j) / segsV;

            let fv = 0;
            if (isBank) {
                // Banked against wall or curb on bankSide:
                // bankSide > 0: v = 1 is the wall (high), v = -1 is the open ground (low)
                // bankSide < 0: v = -1 is the wall (high), v = 1 is the open ground (low)
                const normV = bankSide > 0 ? (v + 1) / 2 : (1 - v) / 2;
                fv = Math.sin(Math.max(0, Math.min(1, normV)) * (Math.PI / 2));
            } else {
                // Natural wind dune / lawn cushion
                if (v <= crestV) {
                    const t = (v - (-1)) / (crestV - (-1));
                    fv = Math.sin(Math.max(0, Math.min(1, t)) * (Math.PI / 2));
                } else {
                    const t = (1 - v) / (1 - crestV);
                    fv = Math.sin(Math.max(0, Math.min(1, t)) * (Math.PI / 2));
                }
                fv = Math.pow(Math.max(0, fv), 1.25);
            }

            const localX = u * halfL;
            const localZ = v * halfW;

            // Transform local point to world coordinates
            const wx = cx + localX * cos + localZ * sin;
            const wz = cz - localX * sin + localZ * cos;

            // Authoritative ground elevation at this exact vertex
            const groundY = surface.elevationAt(wx, wz);

            // Granular snow profile height
            const thickness = height * Math.pow(fu, 1.15) * fv;

            // Lift slightly above ground to prevent coplanar z-fighting with diorama base
            const lift = (i === 0 || i === segsU || (!isBank && (j === 0 || j === segsV)))
                ? 0.002
                : 0.003;

            const wy = groundY + thickness + lift;
            points[i][j] = [wx, wy, wz];
        }
    }

    // Compute mathematically smooth surface normals across the grid
    const normals: [number, number, number][][] = [];
    for (let i = 0; i <= segsU; i++) {
        normals[i] = [];
        for (let j = 0; j <= segsV; j++) {
            const prevU = points[Math.max(0, i - 1)][j];
            const nextU = points[Math.min(segsU, i + 1)][j];
            const prevV = points[i][Math.max(0, j - 1)];
            const nextV = points[i][Math.min(segsV, j + 1)];

            const du: [number, number, number] = [
                nextU[0] - prevU[0],
                nextU[1] - prevU[1],
                nextU[2] - prevU[2]
            ];
            const dv: [number, number, number] = [
                nextV[0] - prevV[0],
                nextV[1] - prevV[1],
                nextV[2] - prevV[2]
            ];

            let nx = du[1] * dv[2] - du[2] * dv[1];
            let ny = du[2] * dv[0] - du[0] * dv[2];
            let nz = du[0] * dv[1] - du[1] * dv[0];
            if (ny < 0) {
                nx = -nx;
                ny = -ny;
                nz = -nz;
            }
            const len = Math.hypot(nx, ny, nz) || 1;
            normals[i][j] = [nx / len, ny / len, nz / len];
        }
    }

    // Build quads with smooth corner normals
    const tile = PATCH.TILE;
    for (let i = 0; i < segsU; i++) {
        for (let j = 0; j < segsV; j++) {
            const p0 = points[i][j];
            const p1 = points[i + 1][j];
            const p2 = points[i + 1][j + 1];
            const p3 = points[i][j + 1];

            const n0 = normals[i][j];
            const n1 = normals[i + 1][j];
            const n2 = normals[i + 1][j + 1];
            const n3 = normals[i][j + 1];

            const uv0 = [p0[0] / tile, p0[2] / tile];
            const uv1 = [p1[0] / tile, p1[2] / tile];
            const uv2 = [p2[0] / tile, p2[2] / tile];
            const uv3 = [p3[0] / tile, p3[2] / tile];

            builder.addSmoothQuad(
                [p0, p1, p2, p3],
                [n0, n1, n2, n3],
                [uv0, uv1, uv2, uv3]
            );
        }
    }

    // For banked drifts against obstacles, seal the back face against the curb/wall
    if (isBank) {
        const wallJ = bankSide > 0 ? segsV : 0;
        const normZ = bankSide > 0 ? 1 : -1;
        const backNormal: [number, number, number] = [-sin * normZ, 0, cos * normZ];
        for (let i = 0; i < segsU; i++) {
            const top0 = points[i][wallJ];
            const top1 = points[i + 1][wallJ];
            const base0: [number, number, number] = [top0[0], surface.elevationAt(top0[0], top0[2]) - 0.04, top0[2]];
            const base1: [number, number, number] = [top1[0], surface.elevationAt(top1[0], top1[2]) - 0.04, top1[2]];

            builder.addQuad(
                [base0, base1, top1, top0],
                backNormal,
                [
                    [base0[0] / tile, base0[1] / tile],
                    [base1[0] / tile, base1[1] / tile],
                    [top1[0] / tile, top1[1] / tile],
                    [top0[0] / tile, top0[1] / tile]
                ]
            );
        }
    }
}

function addDrift(
    snow: ReturnType<typeof createQuadBuilder>,
    soil: ReturnType<typeof createQuadBuilder>,
    stems: ReturnType<typeof createQuadBuilder>,
    surface: SurfaceField,
    random: () => number,
    spec: DriftSpec
): void {
    const builder = spec.isDirty ? soil : snow;
    addCurvedDrift(builder, surface, spec);

    const stemCount = spec.stems ?? 0;
    if (stemCount > 0) {
        const halfL = spec.length / 2;
        const halfW = spec.width / 2;
        const cos = Math.cos(spec.yaw);
        const sin = Math.sin(spec.yaw);
        for (let i = 0; i < stemCount; i++) {
            const relU = (random() - 0.5) * 1.3;
            const relV = (random() - 0.5) * 0.8;
            const localX = relU * halfL;
            const localZ = relV * halfW;
            const sx = spec.x + localX * cos + localZ * sin;
            const sz = spec.z - localX * sin + localZ * cos;
            const sGround = surface.elevationAt(sx, sz);
            const sThick = spec.height * Math.max(0, Math.cos((relU * Math.PI) / 2)) * Math.max(0, Math.cos((relV * Math.PI) / 2));
            const sy = sGround + Math.max(0.015, sThick * 0.45);
            addStem(
                stems,
                sx,
                sy,
                sz,
                (random() - 0.5) * PATCH.STEM.TILT,
                (random() - 0.5) * PATCH.STEM.TILT
            );
        }
    }
}

// 1. Ploughed roadside banks along kerbs with gaps at pedestrian crossings.
function buildRoadsideDrifts(
    snow: ReturnType<typeof createQuadBuilder>,
    soil: ReturnType<typeof createQuadBuilder>,
    stems: ReturnType<typeof createQuadBuilder>,
    layout: Layout,
    surface: SurfaceField,
    random: () => number
): void {
    const crossings = layout.crossings || [];

    layout.curbs.forEach((curb: CurbSegment) => {
        const isXAxis = curb.axis === 'x';
        const start = isXAxis ? Math.min(curb.x0, curb.x1) : Math.min(curb.z0, curb.z1);
        const end = isXAxis ? Math.max(curb.x0, curb.x1) : Math.max(curb.z0, curb.z1);
        const span = end - start;
        if (span < 2.0) return;

        const count = Math.max(1, Math.round(span / 3.4));
        const step = span / count;

        for (let i = 0; i < count; i++) {
            const along = start + (i + 0.5) * step + (random() - 0.5) * 0.5;

            // Check if near any pedestrian crossing opening
            let nearCrossing = false;
            for (const crossing of crossings) {
                const crossCoord = isXAxis ? crossing.x : crossing.z;
                if (Math.abs(along - crossCoord) < 2.2) {
                    nearCrossing = true;
                    break;
                }
            }
            if (nearCrossing) continue;

            const driftWidth = 0.9 + random() * 0.4;
            const driftLength = Math.min(step * 1.15, 4.8) * (0.9 + random() * 0.25);
            const driftHeight = 0.22 + random() * 0.12;

            // Offset to the lawn side away from the carriageway
            const offset = curb.side * (0.14 + driftWidth / 2 + 0.04);
            const cx = isXAxis ? along : curb.x + offset;
            const cz = isXAxis ? curb.z + offset : along;
            const baseYaw = isXAxis ? 0 : Math.PI / 2;
            const yaw = baseYaw + (random() - 0.5) * 0.14;

            const isDirty = random() < PATCH.DRIFT.ROADSIDE_DIRTY_RATIO;
            const stemCount = random() < 0.25 ? 1 : 0;

            addDrift(snow, soil, stems, surface, random, {
                x: cx,
                z: cz,
                yaw,
                length: driftLength,
                width: driftWidth,
                height: driftHeight,
                asymmetry: curb.side * 0.12,
                isBank: true,
                bankSide: -curb.side,
                isDirty,
                stems: stemCount
            });
        }
    });
}

// 2. Deep rounded snowdrifts banked against building plinths (Khrushchyovkas) with porch clearance.
function buildBuildingPlinthDrifts(
    snow: ReturnType<typeof createQuadBuilder>,
    soil: ReturnType<typeof createQuadBuilder>,
    stems: ReturnType<typeof createQuadBuilder>,
    layout: Layout,
    surface: SurfaceField,
    random: () => number
): void {
    const buildings = objectsOfType(layout, 'khrushchyovka');

    buildings.forEach((building) => {
        const footprint = building.worldVisualFootprint;
        if (!footprint) return;

        const accessPoints = building.accessPoints;
        const halfWidth = (footprint.maxX - footprint.minX) / 2;
        const halfDepth = (footprint.maxZ - footprint.minZ) / 2;
        const centerZ = (footprint.minZ + footprint.maxZ) / 2;

        // Front facade (courtyard side)
        const frontZ = building.transform.rotY === 0 ? footprint.maxZ : footprint.minZ;
        const frontSide = building.transform.rotY === 0 ? 1 : -1;
        const frontSteps = Math.floor(halfWidth * 2 / 4.2);

        for (let i = 0; i < frontSteps; i++) {
            const x = footprint.minX + 2.0 + i * 4.2 + (random() - 0.5) * 0.8;
            if (x >= footprint.maxX - 1.5) break;

            // Clear porch access
            let nearAccess = false;
            for (const pt of accessPoints) {
                if (Math.abs(x - pt.world.x) < 2.2) {
                    nearAccess = true;
                    break;
                }
            }
            if (nearAccess) continue;

            const driftWidth = 1.25 + random() * 0.4;
            const driftLength = 3.8 + random() * 1.6;
            const driftHeight = 0.30 + random() * 0.15;
            const cz = frontZ + frontSide * (driftWidth / 2 - 0.1);

            addDrift(snow, soil, stems, surface, random, {
                x,
                z: cz,
                yaw: (random() - 0.5) * 0.1,
                length: driftLength,
                width: driftWidth,
                height: driftHeight,
                asymmetry: frontSide * 0.15,
                isBank: true,
                bankSide: -frontSide,
                isDirty: false,
                stems: random() < 0.35 ? 1 + Math.floor(random() * 2) : 0
            });
        }

        // Rear facade
        const rearZ = building.transform.rotY === 0 ? footprint.minZ : footprint.maxZ;
        const rearSide = -frontSide;
        const rearSteps = Math.floor(halfWidth * 2 / 5.0);

        for (let i = 0; i < rearSteps; i++) {
            const x = footprint.minX + 2.5 + i * 5.0 + (random() - 0.5) * 1.0;
            if (x >= footprint.maxX - 2.0) break;

            const driftWidth = 1.35 + random() * 0.45;
            const driftLength = 4.4 + random() * 1.8;
            const driftHeight = 0.32 + random() * 0.16;
            const cz = rearZ + rearSide * (driftWidth / 2 - 0.1);

            addDrift(snow, soil, stems, surface, random, {
                x,
                z: cz,
                yaw: (random() - 0.5) * 0.1,
                length: driftLength,
                width: driftWidth,
                height: driftHeight,
                asymmetry: rearSide * 0.15,
                isBank: true,
                bankSide: -rearSide,
                isDirty: false,
                stems: random() < 0.25 ? 1 : 0
            });
        }

        // Gable ends
        [-1, 1].forEach((endSign) => {
            const endX = endSign < 0 ? footprint.minX : footprint.maxX;
            const driftWidth = 1.15 + random() * 0.35;
            const driftLength = halfDepth * 1.6;
            const driftHeight = 0.28 + random() * 0.14;
            const cx = endX + endSign * (driftWidth / 2 - 0.1);

            addDrift(snow, soil, stems, surface, random, {
                x: cx,
                z: centerZ,
                yaw: Math.PI / 2 + (random() - 0.5) * 0.1,
                length: driftLength,
                width: driftWidth,
                height: driftHeight,
                asymmetry: endSign * 0.12,
                isBank: true,
                bankSide: -endSign,
                isDirty: false,
                stems: 1
            });
        });
    });
}

// 3. Natural sweeping snowdrifts, dunes, and layered broad cushions across courtyard lawns.
function buildCourtyardLawnDrifts(
    snow: ReturnType<typeof createQuadBuilder>,
    soil: ReturnType<typeof createQuadBuilder>,
    stems: ReturnType<typeof createQuadBuilder>,
    surface: SurfaceField,
    random: () => number
): void {
    void random;
    // Defined major open courtyard and lawn areas
    const lawnZones = [
        // North-West courtyard quad (near kiosk approach & trees)
        { minX: -36, maxX: -15, minZ: -18, maxZ: -4, count: 9, cushions: 3, seed: 101 },
        // North-East courtyard quad (between transformer yard & ring)
        { minX: 14, maxX: 36, minZ: -18, maxZ: -4, count: 8, cushions: 2, seed: 102 },
        // South-West courtyard quad
        { minX: -36, maxX: -15, minZ: 4, maxZ: 18, count: 9, cushions: 3, seed: 103 },
        // South-East courtyard quad
        { minX: 14, maxX: 36, minZ: 4, maxZ: 18, count: 8, cushions: 2, seed: 104 },
        // Central area north of playground
        { minX: -14, maxX: 14, minZ: -18, maxZ: -13, count: 5, cushions: 1, seed: 105 },
        // North street lawn strip (between northern street and northern buildings)
        { minX: -38, maxX: 38, minZ: -44, maxZ: -38, count: 12, cushions: 4, seed: 106 },
        // South strip behind southern buildings
        { minX: -38, maxX: 38, minZ: 38, maxZ: 45, count: 12, cushions: 4, seed: 107 },
        // Western outer margin
        { minX: -50, maxX: -43, minZ: -38, maxZ: 38, count: 8, cushions: 2, seed: 108 },
        // Eastern outer margin
        { minX: 43, maxX: 50, minZ: -38, maxZ: 38, count: 8, cushions: 2, seed: 109 }
    ];

    lawnZones.forEach((zone) => {
        const zoneRandom = createSeededRandom(zone.seed);
        const spanX = zone.maxX - zone.minX;
        const spanZ = zone.maxZ - zone.minZ;

        // A. Broad layered snow cushions / swells: gives the lawn visible undulating topography
        for (let c = 0; c < zone.cushions; c++) {
            const cx = zone.minX + (c + 0.5) * (spanX / zone.cushions) + (zoneRandom() - 0.5) * 3.0;
            const cz = zone.minZ + zoneRandom() * spanZ;
            const cushionLength = 8.0 + zoneRandom() * 6.0;
            const cushionWidth = 4.0 + zoneRandom() * 3.0;
            const cushionHeight = 0.10 + zoneRandom() * 0.08;
            const yaw = PATCH.DRIFT.WIND_YAW + (zoneRandom() - 0.5) * 0.2;

            addDrift(snow, soil, stems, surface, zoneRandom, {
                x: cx,
                z: cz,
                yaw,
                length: cushionLength,
                width: cushionWidth,
                height: cushionHeight,
                topWidthRatio: 0.46,
                topLengthRatio: 0.70,
                twoTier: false,
                isDirty: false,
                stems: 0
            });
        }

        // B. Sculpted rounded wind-drifts with soft shoulders and crowns
        for (let i = 0; i < zone.count; i++) {
            const cx = zone.minX + (i + 0.5) * (spanX / zone.count) + (zoneRandom() - 0.5) * (spanX / zone.count * 0.7);
            const cz = zone.minZ + zoneRandom() * spanZ;

            const isSecondary = i % 3 === 2;
            const length = isSecondary ? 3.8 + zoneRandom() * 2.6 : 5.2 + zoneRandom() * 4.2;
            const width = 1.4 + zoneRandom() * 1.2;
            const height = isSecondary ? 0.20 + zoneRandom() * 0.12 : 0.26 + zoneRandom() * 0.16;

            // Wind direction with subtle crossing patterns
            const yaw = isSecondary
                ? PATCH.DRIFT.WIND_YAW + Math.PI / 2 + (zoneRandom() - 0.5) * 0.28
                : PATCH.DRIFT.WIND_YAW + (zoneRandom() - 0.5) * PATCH.DRIFT.YAW_JITTER;

            const isDirty = zoneRandom() < PATCH.DRIFT.DIRTY_RATIO;
            const stemCount = zoneRandom() < 0.5 ? 1 + Math.floor(zoneRandom() * 3) : 0;

            addDrift(snow, soil, stems, surface, zoneRandom, {
                x: cx,
                z: cz,
                yaw,
                length,
                width,
                height,
                topWidthRatio: 0.32,
                topLengthRatio: 0.72,
                asymmetry: (zoneRandom() - 0.5) * 0.15,
                twoTier: height > 0.22 && width > 1.3,
                isDirty,
                stems: stemCount
            });
        }
    });
}

// 4. Tree base snow mounds with dry weeds around trunks.
function buildTreeMounds(
    snow: ReturnType<typeof createQuadBuilder>,
    soil: ReturnType<typeof createQuadBuilder>,
    stems: ReturnType<typeof createQuadBuilder>,
    layout: Layout,
    surface: SurfaceField,
    random: () => number
): void {
    const trees = objectsOfType(layout, 'winter-tree');

    trees.forEach((tree) => {
        const { x, z } = tree.transform;
        // Shift drift slightly upwind
        const cx = x - 0.35 + (random() - 0.5) * 0.2;
        const cz = z - 0.18 + (random() - 0.5) * 0.2;
        const length = 2.2 + random() * 0.8;
        const width = 1.6 + random() * 0.6;
        const height = 0.22 + random() * 0.10;
        const yaw = PATCH.DRIFT.WIND_YAW + (random() - 0.5) * 0.25;

        addDrift(snow, soil, stems, surface, random, {
            x: cx,
            z: cz,
            yaw,
            length,
            width,
            height,
            topWidthRatio: 0.38,
            topLengthRatio: 0.68,
            twoTier: false,
            isDirty: false,
            stems: 2 + Math.floor(random() * 3)
        });
    });
}

// 5. Fence drifts along PO-2 and lawn fence runs.
function buildFenceDrifts(
    snow: ReturnType<typeof createQuadBuilder>,
    soil: ReturnType<typeof createQuadBuilder>,
    stems: ReturnType<typeof createQuadBuilder>,
    layout: Layout,
    surface: SurfaceField,
    random: () => number
): void {
    const lawnFences = objectsOfType(layout, 'lawn-fence');

    lawnFences.forEach((fence) => {
        const { x, z, rotY } = fence.transform;
        const length: number = fence.parameters.length || 6;
        const driftLength = length * 0.88;
        const driftWidth = 0.85 + random() * 0.35;
        const driftHeight = 0.24 + random() * 0.12;

        addDrift(snow, soil, stems, surface, random, {
            x,
            z,
            yaw: rotY,
            length: driftLength,
            width: driftWidth,
            height: driftHeight,
            topWidthRatio: 0.35,
            topLengthRatio: 0.75,
            twoTier: false,
            isDirty: false,
            stems: 1
        });
    });
}

// 6. Courtyard props and playground drifts (sandbox, rocket, kiosk, TP yard).
function buildPropDrifts(
    snow: ReturnType<typeof createQuadBuilder>,
    soil: ReturnType<typeof createQuadBuilder>,
    stems: ReturnType<typeof createQuadBuilder>,
    surface: SurfaceField,
    random: () => number
): void {
    const props = [
        // Sandbox frame drift
        { x: -5, z: -4.3, yaw: 0, length: 3.6, width: 1.3, height: 0.24, stems: 1 },
        // Rocket base drift
        { x: 4.8, z: -5.8, yaw: 0.4, length: 3.0, width: 1.4, height: 0.28, stems: 2 },
        // Swing frame drift
        { x: 4, z: 4.2, yaw: 0, length: 3.4, width: 1.1, height: 0.22, stems: 1 },
        // Kiosk back and side wall drifts
        { x: -28.2, z: -8.8, yaw: 0, length: 3.8, width: 1.4, height: 0.32, stems: 1 },
        { x: -30.4, z: -7, yaw: Math.PI / 2, length: 3.2, width: 1.3, height: 0.30, stems: 0 },
        // Transformer booth perimeter drifts
        { x: 27.5, z: -6.5, yaw: 0, length: 3.8, width: 1.4, height: 0.34, stems: 1 },
        { x: 30.5, z: -3.8, yaw: 0, length: 3.4, width: 1.3, height: 0.30, stems: 0 },
        // Slab yard drift
        { x: 18, z: 9, yaw: 0.3, length: 5.4, width: 1.8, height: 0.34, stems: 2 }
    ];

    props.forEach((prop) => {
        addDrift(snow, soil, stems, surface, random, {
            ...prop,
            topWidthRatio: 0.34,
            topLengthRatio: 0.72,
            isDirty: false
        });
    });
}

// Process any explicit layout snow-patches with smooth rounded ridges
function buildExplicitPatches(
    snow: ReturnType<typeof createQuadBuilder>,
    soil: ReturnType<typeof createQuadBuilder>,
    stems: ReturnType<typeof createQuadBuilder>,
    layout: Layout,
    surface: SurfaceField
): void {
    const fields = objectsOfType(layout, 'snow-patch');

    fields.forEach((object: ObjectDescriptor) => {
        const { x, z } = object.transform;
        const parameters = object.parameters;
        const width: number = parameters.width;
        const depth: number = parameters.depth;
        const mounds: number = parameters.mounds;
        const random = createSeededRandom(parameters.seed);

        const count = Math.max(2, mounds);
        for (let i = 0; i < count; i++) {
            const cx = x + (random() - 0.5) * width * 0.7;
            const cz = z + (random() - 0.5) * depth * 0.7;
            const length = Math.min(width, depth) * (0.8 + random() * 0.5);
            const driftWidth = Math.min(width, depth) * 0.5;
            const height = 0.20 + random() * 0.16;
            const yaw = (i % 2 === 0 ? PATCH.DRIFT.WIND_YAW : PATCH.DRIFT.WIND_YAW + Math.PI / 2) + (random() - 0.5) * 0.25;

            addDrift(snow, soil, stems, surface, random, {
                x: cx,
                z: cz,
                yaw,
                length,
                width: driftWidth,
                height,
                topWidthRatio: 0.34,
                topLengthRatio: 0.72,
                twoTier: height > 0.22,
                isDirty: random() < PATCH.DRIFT.DIRTY_RATIO,
                stems: random() < 0.4 ? 1 + Math.floor(random() * 2) : 0
            });
        }
    });
}

// Main builder of all diorama snow decor.
export function buildSnowPatches(group: THREE.Group, layout: Layout, surface: SurfaceField): void {
    const snow = createQuadBuilder();
    const soil = createQuadBuilder();
    const stems = createQuadBuilder();
    const random = createSeededRandom(layout.seed || 108);

    // 1. Ploughed roadside banks along curbs
    buildRoadsideDrifts(snow, soil, stems, layout, surface, random);

    // 2. Deep rounded snowdrifts banked against building plinths
    buildBuildingPlinthDrifts(snow, soil, stems, layout, surface, random);

    // 3. Wide sweeping dunes and layered broad cushions across all courtyard lawns
    buildCourtyardLawnDrifts(snow, soil, stems, surface, random);

    // 4. Mounds around tree trunks
    buildTreeMounds(snow, soil, stems, layout, surface, random);

    // 5. Fence drifts
    buildFenceDrifts(snow, soil, stems, layout, surface, random);

    // 6. Playground and prop drifts
    buildPropDrifts(snow, soil, stems, surface, random);

    // 7. Explicit layout patches
    buildExplicitPatches(snow, soil, stems, layout, surface);

    const layers: Array<[string, THREE.Material, THREE.BufferGeometry | null]> = [
        ['snow-patch-drifts', snowCapMat, snow.isEmpty() ? null : snow.build()],
        ['snow-patch-dirty', snowSoilMat, soil.isEmpty() ? null : soil.build()],
        [
            'snow-patch-stems',
            makePS1Material({ color: COLORS.TREE_BARK, side: THREE.DoubleSide }),
            stems.isEmpty() ? null : stems.build()
        ]
    ];

    layers.forEach(([name, material, geometry]) => {
        if (!geometry) return;
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = name;
        group.add(mesh);
    });
}

// Backward-compatible export: base blanket is now part of the terrain in dioramaBase.
export function buildSnowCover(_group: THREE.Group, _layout: Layout, _surface: SurfaceField): void {
    // Base blanket is integrated directly into the diorama ground plane.
}
