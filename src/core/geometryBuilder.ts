import * as THREE from 'three';
// Minimal quad builder: the surface layers are one non-indexed BufferGeometry per
// surface class, assembled from axis-aligned quads with world-space UVs. Building
// them by hand (instead of one Mesh per cell) keeps the draw-call budget flat and
// avoids T-junction cracks between neighbouring cells.

// Loose numeric tuples: corners/normals are [x, y, z], uvs are [u, v]. Kept as
// number[] (not fixed tuples) so the array literals below stay assignable.
type Point3 = number[];
type UV = number[];

interface PlaneRect {
    minX: number;
    minZ: number;
    maxX: number;
    maxZ: number;
}

interface BoxRect extends PlaneRect {
    minY: number;
    maxY: number;
}

interface StripPoint {
    x: number;
    z: number;
}

export function createQuadBuilder() {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];

    function pushVertex(point: Point3, normal: Point3, uv: UV): void {
        positions.push(point[0], point[1], point[2]);
        normals.push(normal[0], normal[1], normal[2]);
        uvs.push(uv[0], uv[1]);
    }

    // Corners are given in perimeter order; the winding is corrected against the
    // requested normal so the renderer never culls a face that should be visible.
    function addQuad(corners: Point3[], normal: Point3, cornerUvs: UV[]): void {
        const [a, b, c] = corners;
        const abx = b[0] - a[0];
        const aby = b[1] - a[1];
        const abz = b[2] - a[2];
        const acx = c[0] - a[0];
        const acy = c[1] - a[1];
        const acz = c[2] - a[2];
        const crossX = aby * acz - abz * acy;
        const crossY = abz * acx - abx * acz;
        const crossZ = abx * acy - aby * acx;
        const facing = crossX * normal[0] + crossY * normal[1] + crossZ * normal[2];
        const order = facing >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];

        order.forEach((index) => pushVertex(corners[index], normal, cornerUvs[index]));
    }

    // Flat rectangle in the XZ plane, facing up or down.
    function addPlane(rect: PlaneRect, y: number, tile: number, normalY = 1): void {
        const normal = [0, normalY, 0];
        const corners = [
            [rect.minX, y, rect.minZ],
            [rect.minX, y, rect.maxZ],
            [rect.maxX, y, rect.maxZ],
            [rect.maxX, y, rect.minZ]
        ];
        const cornerUvs = corners.map((point) => [point[0] / tile, point[2] / tile]);
        addQuad(corners, normal, cornerUvs);
    }

    function addBox({ minX, minZ, maxX, maxZ, minY, maxY }: BoxRect, tile: number): void {
        const top = [
            [minX, maxY, minZ],
            [minX, maxY, maxZ],
            [maxX, maxY, maxZ],
            [maxX, maxY, minZ]
        ];
        const bottom = [
            [minX, minY, minZ],
            [minX, minY, maxZ],
            [maxX, minY, maxZ],
            [maxX, minY, minZ]
        ];
        const uvXZ = (point: Point3): UV => [point[0] / tile, point[2] / tile];
        const uvYZ = (point: Point3): UV => [point[2] / tile, point[1] / tile];
        const uvXY = (point: Point3): UV => [point[0] / tile, point[1] / tile];

        addQuad(top, [0, 1, 0], top.map(uvXZ));
        addQuad(bottom, [0, -1, 0], bottom.map(uvXZ));

        const sides = [
            { normal: [1, 0, 0], corners: [[maxX, minY, minZ], [maxX, minY, maxZ], [maxX, maxY, maxZ], [maxX, maxY, minZ]], uvs: uvYZ },
            { normal: [-1, 0, 0], corners: [[minX, minY, minZ], [minX, minY, maxZ], [minX, maxY, maxZ], [minX, maxY, minZ]], uvs: uvYZ },
            { normal: [0, 0, 1], corners: [[minX, minY, maxZ], [maxX, minY, maxZ], [maxX, maxY, maxZ], [minX, maxY, maxZ]], uvs: uvXY },
            { normal: [0, 0, -1], corners: [[minX, minY, minZ], [maxX, minY, minZ], [maxX, maxY, minZ], [minX, maxY, minZ]], uvs: uvXY }
        ];
        sides.forEach((side) => addQuad(side.corners, side.normal, side.corners.map(side.uvs)));
    }

    // Vertical strip between two points on the XZ plane (used for kerb faces).
    function addVerticalStrip(from: StripPoint, to: StripPoint, y0: number, y1: number, normal: Point3, tile: number): void {
        const corners = [
            [from.x, y0, from.z],
            [to.x, y0, to.z],
            [to.x, y1, to.z],
            [from.x, y1, from.z]
        ];
        const along = Math.hypot(to.x - from.x, to.z - from.z);
        const cornerUvs = [
            [0, y0 / tile],
            [along / tile, y0 / tile],
            [along / tile, y1 / tile],
            [0, y1 / tile]
        ];
        addQuad(corners, normal, cornerUvs);
    }

    function isEmpty(): boolean {
        return positions.length === 0;
    }

    function build(): THREE.BufferGeometry {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.computeBoundingSphere();
        return geometry;
    }

    function buildMesh(material: THREE.Material, name = 'quads'): THREE.Mesh {
        const mesh = new THREE.Mesh(build(), material);
        mesh.name = name;
        return mesh;
    }

    return { addQuad, addPlane, addBox, addVerticalStrip, isEmpty, build, buildMesh };
}

export type QuadBuilder = ReturnType<typeof createQuadBuilder>;
