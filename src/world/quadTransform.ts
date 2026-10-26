// Transform-aware quad helpers. A builder that merges a whole run of objects
// into one mesh (fences, snow fields, plate yards) needs the same box emitter
// with a placement baked into every vertex — that is exactly this module. The
// placement is a plain point function, so a shear (a leaning slab) and a rigid
// frame (a section along a run) compose without matrices.
import type { QuadBuilder } from '../core/geometryBuilder.js';

export type Point = number[];
export type Placement = (point: Point) => Point;

interface BoxSpec {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
}

// Local frame of a section: xw = xo + xl·cos + zl·sin, zw = zo − xl·sin + zl·cos
// (the same convention the layout descriptors use).
export function placeAt(x: number, z: number, rotY: number, y = 0): Placement {
    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);
    return (point) => [x + point[0] * cos + point[2] * sin, point[1] + y, z - point[0] * sin + point[2] * cos];
}

export function translateY(dy: number): Placement {
    return (point) => [point[0], point[1] + dy, point[2]];
}

// Leaning slab: the top of the section is pushed along local Z. Because the
// offset depends on Y only, the shear survives the merge into a single mesh.
export function shearY(lean: number): Placement {
    return (point) => [point[0], point[1], point[2] + lean * point[1]];
}

export function compose(...placements: Placement[]): Placement {
    return (point) => placements.reduce((current, placement) => placement(current), point);
}

// A normal is a direction: it follows the linear part of the placement only.
// Mapping the origin as well and subtracting it removes the translation, which
// is what keeps a rotated fence face lit by the same light as an axis-aligned one.
function mapNormal(place: Placement, normal: Point): Point {
    const origin = place([0, 0, 0]);
    const mapped = place([normal[0], normal[1], normal[2]]);
    const x = mapped[0] - origin[0];
    const y = mapped[1] - origin[1];
    const z = mapped[2] - origin[2];
    const length = Math.hypot(x, y, z) || 1;
    return [x / length, y / length, z / length];
}

export function addBox(quads: QuadBuilder, place: Placement, box: BoxSpec, tile: number): void {
    const { minX, maxX, minY, maxY, minZ, maxZ } = box;
    const uvXZ = (point: Point): number[] => [point[0] / tile, point[2] / tile];
    const uvYZ = (point: Point): number[] => [point[2] / tile, point[1] / tile];
    const uvXY = (point: Point): number[] => [point[0] / tile, point[1] / tile];

    const top = [
        [minX, maxY, minZ],
        [minX, maxY, maxZ],
        [maxX, maxY, maxZ],
        [maxX, maxY, minZ]
    ].map(place);
    const bottom = [
        [minX, minY, minZ],
        [minX, minY, maxZ],
        [maxX, minY, maxZ],
        [maxX, minY, minZ]
    ].map(place);
    quads.addQuad(top, mapNormal(place, [0, 1, 0]), top.map(uvXZ));
    quads.addQuad(bottom, mapNormal(place, [0, -1, 0]), bottom.map(uvXZ));

    const sides = [
        { normal: [1, 0, 0], corners: [[maxX, minY, minZ], [maxX, minY, maxZ], [maxX, maxY, maxZ], [maxX, maxY, minZ]], uvs: uvYZ },
        { normal: [-1, 0, 0], corners: [[minX, minY, minZ], [minX, minY, maxZ], [minX, maxY, maxZ], [minX, maxY, minZ]], uvs: uvYZ },
        { normal: [0, 0, 1], corners: [[minX, minY, maxZ], [maxX, minY, maxZ], [maxX, maxY, maxZ], [minX, maxY, maxZ]], uvs: uvXY },
        { normal: [0, 0, -1], corners: [[minX, minY, minZ], [maxX, minY, minZ], [maxX, maxY, minZ], [minX, maxY, minZ]], uvs: uvXY }
    ];
    sides.forEach((side) => {
        const corners = side.corners.map(place);
        quads.addQuad(corners, mapNormal(place, side.normal), corners.map(side.uvs));
    });
}

// Flat four-point patch (a diamond relief, a stencil on a slab). The caller says
// which way it faces; no thickness, no depth fight with the surface behind it.
export function addDecal(quads: QuadBuilder, place: Placement, corners: Point[], normal: Point, uvs: number[][]): void {
    quads.addQuad(corners.map(place), mapNormal(place, normal), uvs);
}

interface RidgeSpec {
    length: number;
    width: number;
    height: number;
}

// A snow drift: a tent with two sloped faces and two triangular ends. Flat boxes
// read as paper sheets lying on the ground; a sloped ridge catches the light and
// reads as a mound from the isometric camera, at the cost of six quads.
export function addRidge(quads: QuadBuilder, place: Placement, ridge: RidgeSpec, tile: number): void {
    const halfLength = ridge.length / 2;
    const halfWidth = ridge.width / 2;
    const { height } = ridge;

    const a: Point = [-halfLength, 0, -halfWidth];
    const b: Point = [halfLength, 0, -halfWidth];
    const c: Point = [halfLength, 0, halfWidth];
    const d: Point = [-halfLength, 0, halfWidth];
    const e: Point = [-halfLength, height, 0];
    const f: Point = [halfLength, height, 0];

    const slope = Math.hypot(halfWidth, height);
    const frontNormal: Point = [0, halfWidth / slope, -height / slope];
    const backNormal: Point = [0, halfWidth / slope, height / slope];

    const uvs = (points: Point[]): number[][] => points.map((point) => [point[0] / tile, (point[2] + point[1]) / tile]);
    const capUvs = (points: Point[]): number[][] => points.map((point) => [point[2] / tile, point[1] / tile]);

    const front: Point[] = [a, b, f, e];
    const back: Point[] = [d, c, f, e];

    // Sloped faces.
    quads.addQuad(front.map(place), mapNormal(place, frontNormal), uvs(front));
    quads.addQuad(back.map(place), mapNormal(place, backNormal), uvs(back));
    // End caps (the second triangle is degenerate, which is the cheapest way to
    // close a ridge with a quad-only emitter).
    quads.addQuad([a, e, d, d].map(place), mapNormal(place, [-1, 0, 0]), capUvs([a, e, d, d]));
    quads.addQuad([b, c, f, f].map(place), mapNormal(place, [1, 0, 0]), capUvs([b, c, f, f]));
}

export interface RoundedDriftSpec {
    length: number;
    width: number;
    height: number;
    topWidthRatio?: number;
    topLengthRatio?: number;
    asymmetry?: number;
    twoTier?: boolean;
}

// Rounded volumetric snowdrift: faceted dome or trapezoidal mound with smooth
// sloped flanks, rounded top crest and tapered ends, completely eliminating sharp
// knife-edge ridge artifacts.
export function addRoundedDrift(
    quads: QuadBuilder,
    place: Placement,
    spec: RoundedDriftSpec,
    tile: number
): void {
    const {
        length,
        width,
        height,
        topWidthRatio = 0.32,
        topLengthRatio = 0.72,
        asymmetry = 0,
        twoTier = height > 0.22
    } = spec;

    const halfL = length / 2;
    const halfW = width / 2;
    const shift = width * asymmetry;
    const baseY = -0.18;

    const uvs = (points: Point[]): number[][] => points.map((p) => [p[0] / tile, (p[2] + p[1]) / tile]);
    const uvXZ = (points: Point[]): number[][] => points.map((p) => [p[0] / tile, p[2] / tile]);

    function computeNormal(p0: Point, p1: Point, p3: Point): Point {
        const u = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
        const v = [p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]];
        const nx = u[1] * v[2] - u[2] * v[1];
        const ny = u[2] * v[0] - u[0] * v[2];
        const nz = u[0] * v[1] - u[1] * v[0];
        const len = Math.hypot(nx, ny, nz) || 1;
        return [nx / len, ny / len, nz / len];
    }

    function addQuadFace(corners: Point[], isTop = false): void {
        const normal = isTop ? [0, 1, 0] : computeNormal(corners[0], corners[1], corners[3]);
        const uvMapping = isTop ? uvXZ(corners) : uvs(corners);
        quads.addQuad(corners.map(place), mapNormal(place, normal), uvMapping);
    }

    if (!twoTier) {
        // Single-tier rounded mound with soft crest plateau
        const halfTopL = halfL * topLengthRatio;
        const halfTopW = halfW * topWidthRatio;

        const b0: Point = [-halfL, baseY, -halfW];
        const b1: Point = [halfL, baseY, -halfW];
        const b2: Point = [halfL, baseY, halfW];
        const b3: Point = [-halfL, baseY, halfW];

        const t0: Point = [-halfTopL, height, -halfTopW + shift];
        const t1: Point = [halfTopL, height, -halfTopW + shift];
        const t2: Point = [halfTopL, height, halfTopW + shift];
        const t3: Point = [-halfTopL, height, halfTopW + shift];

        addQuadFace([t0, t1, t2, t3], true);
        addQuadFace([b0, b1, t1, t0]);
        addQuadFace([t3, t2, b2, b3]);
        addQuadFace([b3, b0, t0, t3]);
        addQuadFace([b1, b2, t2, t1]);
    } else {
        // Two-tier rounded dome (curved multi-slope cross section with soft shoulder)
        const shoulderH = height * 0.52;
        const halfShoulderL = halfL * 0.86;
        const halfShoulderW = halfW * 0.68;
        const shoulderShift = shift * 0.45;

        const halfTopL = halfL * Math.min(topLengthRatio, 0.66);
        const halfTopW = halfW * Math.min(topWidthRatio, 0.28);

        const b0: Point = [-halfL, baseY, -halfW];
        const b1: Point = [halfL, baseY, -halfW];
        const b2: Point = [halfL, baseY, halfW];
        const b3: Point = [-halfL, baseY, halfW];

        const s0: Point = [-halfShoulderL, shoulderH, -halfShoulderW + shoulderShift];
        const s1: Point = [halfShoulderL, shoulderH, -halfShoulderW + shoulderShift];
        const s2: Point = [halfShoulderL, shoulderH, halfShoulderW + shoulderShift];
        const s3: Point = [-halfShoulderL, shoulderH, halfShoulderW + shoulderShift];

        const t0: Point = [-halfTopL, height, -halfTopW + shift];
        const t1: Point = [halfTopL, height, -halfTopW + shift];
        const t2: Point = [halfTopL, height, halfTopW + shift];
        const t3: Point = [-halfTopL, height, halfTopW + shift];

        addQuadFace([t0, t1, t2, t3], true);
        addQuadFace([b0, b1, s1, s0]);
        addQuadFace([s0, s1, t1, t0]);
        addQuadFace([t3, t2, s2, s3]);
        addQuadFace([s3, s2, b2, b3]);
        addQuadFace([b3, b0, s0, s3]);
        addQuadFace([s3, s0, t0, t3]);
        addQuadFace([b1, b2, s2, s1]);
        addQuadFace([s1, s2, t2, t1]);
    }
}
