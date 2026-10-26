// Primitive collector of the heroine rig. The reference model is a few hundred
// boxes, cylinders and low-segment spheres; at the PS1 buffer that is one draw
// call per part for detail nobody can resolve. Every part is therefore baked into
// a single merged BufferGeometry per material and per animated joint (hip, knee,
// shoulder, elbow, torso, head, pack), the same way the courtyard merges its
// fences and trees.
//
// The collector is one-shot: a builder fills it, calls build() and adds the
// returned group to its joint. Source primitives are disposed after the merge.
import { mergeGeometries, type MergePart } from '../core/geometryMerge.js';
import * as THREE from 'three';

interface PlayerPartCollector {
    box(
        width: number,
        height: number,
        depth: number,
        material: THREE.Material,
        x?: number,
        y?: number,
        z?: number,
        rx?: number,
        ry?: number,
        rz?: number
    ): void;
    cylinder(
        topRadius: number,
        bottomRadius: number,
        height: number,
        segments: number,
        material: THREE.Material,
        x?: number,
        y?: number,
        z?: number,
        rx?: number,
        ry?: number,
        rz?: number
    ): void;
    // Cylinder without end caps. The first-person coat skirt is built from two of
    // these: seen from above, its interior is culled away, so the camera can look
    // down through the hem at the legs that a closed shell would hide. The
    // optional theta range leaves the front of the coat open.
    openCylinder(
        topRadius: number,
        bottomRadius: number,
        height: number,
        segments: number,
        material: THREE.Material,
        x?: number,
        y?: number,
        z?: number,
        thetaStart?: number,
        thetaLength?: number
    ): void;
    sphere(
        radius: number,
        widthSegments: number,
        heightSegments: number,
        material: THREE.Material,
        x?: number,
        y?: number,
        z?: number,
        sx?: number,
        sy?: number,
        sz?: number
    ): void;
    build(name: string): THREE.Group;
}

export function createPlayerPartCollector(): PlayerPartCollector {
    const batches = new Map<THREE.Material, MergePart[]>();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const scale = new THREE.Vector3();

    function placement(
        x: number,
        y: number,
        z: number,
        rx: number,
        ry: number,
        rz: number,
        sx: number,
        sy: number,
        sz: number
    ): THREE.Matrix4 {
        euler.set(rx, ry, rz);
        quaternion.setFromEuler(euler);
        position.set(x, y, z);
        scale.set(sx, sy, sz);
        return new THREE.Matrix4().compose(position, quaternion, scale);
    }

    function push(geometry: THREE.BufferGeometry, material: THREE.Material, matrix: THREE.Matrix4): void {
        const parts = batches.get(material);
        if (parts) {
            parts.push({ geometry, matrix });
        } else {
            batches.set(material, [{ geometry, matrix }]);
        }
    }

    return {
        box(width, height, depth, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
            push(
                new THREE.BoxGeometry(width, height, depth),
                material,
                placement(x, y, z, rx, ry, rz, 1, 1, 1)
            );
        },

        cylinder(topRadius, bottomRadius, height, segments, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
            push(
                new THREE.CylinderGeometry(topRadius, bottomRadius, height, segments),
                material,
                placement(x, y, z, rx, ry, rz, 1, 1, 1)
            );
        },

        openCylinder(topRadius, bottomRadius, height, segments, material, x = 0, y = 0, z = 0, thetaStart = 0, thetaLength = Math.PI * 2) {
            push(
                new THREE.CylinderGeometry(topRadius, bottomRadius, height, segments, 1, true, thetaStart, thetaLength),
                material,
                placement(x, y, z, 0, 0, 0, 1, 1, 1)
            );
        },

        sphere(radius, widthSegments, heightSegments, material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
            push(
                new THREE.SphereGeometry(radius, widthSegments, heightSegments),
                material,
                placement(x, y, z, 0, 0, 0, sx, sy, sz)
            );
        },

        build(name) {
            const group = new THREE.Group();
            group.name = name;

            batches.forEach((parts, material) => {
                const geometry = mergeGeometries(parts);
                const mesh = new THREE.Mesh(geometry, material);
                mesh.name = `${name}-${material.name || 'surface'}`;
                group.add(mesh);
                parts.forEach((part) => part.geometry.dispose());
            });

            batches.clear();
            return group;
        }
    };
}
