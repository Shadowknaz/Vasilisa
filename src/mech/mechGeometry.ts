// Terse mesh helpers for the walker's part builders. The reference model is built
// from a few hundred boxes and low-segment cylinders, so each part is one call
// with an optional local rotation; rivet rows are the only repeated pattern.
import * as THREE from 'three';

interface Vec3 {
    x: number;
    y: number;
    z: number;
}

const RIVET_SIZE = 0.032;

export function box(
    width: number,
    height: number,
    depth: number,
    material: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
    rx = 0,
    ry = 0,
    rz = 0
): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    return mesh;
}

export function cyl(
    topRadius: number,
    bottomRadius: number,
    height: number,
    segments: number,
    material: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
    rx = 0,
    ry = 0,
    rz = 0
): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(topRadius, bottomRadius, height, segments), material);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    return mesh;
}

const sharedRivetGeometry = new THREE.BoxGeometry(RIVET_SIZE, RIVET_SIZE, RIVET_SIZE);

export function addRivetRow(
    parent: THREE.Object3D,
    material: THREE.Material,
    count: number,
    start: Vec3,
    step: Vec3
): void {
    for (let index = 0; index < count; index++) {
        const mesh = new THREE.Mesh(sharedRivetGeometry, material);
        mesh.position.set(
            start.x + step.x * index,
            start.y + step.y * index,
            start.z + step.z * index
        );
        parent.add(mesh);
    }
}
