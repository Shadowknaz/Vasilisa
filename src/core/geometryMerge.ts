// Merge helper for geometry that cannot be expressed as axis-aligned quads
// (tree crowns, cones, dodecahedrons). The world builders stay at a handful of
// draw calls per object by baking a whole catalogue of small parts into one
// BufferGeometry per material, the same way the facade shell does it with quads.
import * as THREE from 'three';

export interface MergePart {
    geometry: THREE.BufferGeometry;
    // Placement of the part inside the merged mesh. Omitted parts stay at origin.
    matrix?: THREE.Matrix4;
}

export function mergeGeometries(parts: MergePart[]): THREE.BufferGeometry {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];

    const point = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const normalMatrix = new THREE.Matrix3();

    parts.forEach(({ geometry, matrix }) => {
        // Indexed primitives are expanded so the merged buffer stays a flat
        // triangle soup with one attribute layout for every part.
        const source = geometry.index ? geometry.toNonIndexed() : geometry;
        const position = source.getAttribute('position');
        const normalAttribute = source.getAttribute('normal');
        const uv = source.getAttribute('uv');

        if (matrix) normalMatrix.getNormalMatrix(matrix);

        for (let index = 0; index < position.count; index++) {
            point.fromBufferAttribute(position, index);
            if (matrix) point.applyMatrix4(matrix);
            positions.push(point.x, point.y, point.z);

            if (normalAttribute) {
                normal.fromBufferAttribute(normalAttribute, index);
                if (matrix) normal.applyMatrix3(normalMatrix).normalize();
                normals.push(normal.x, normal.y, normal.z);
            } else {
                normals.push(0, 1, 0);
            }

            if (uv) uvs.push(uv.getX(index), uv.getY(index));
            else uvs.push(0, 0);
        }

        if (source !== geometry) {
            source.dispose();
        }
    });

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    merged.computeBoundingSphere();
    return merged;
}
