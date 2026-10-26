// Lightweight visual snow response. Footprints are decals, not terrain physics.
import * as THREE from 'three';
import { COLORS } from '../config/colors.js';
import { textures } from '../core/textures.js';
import { makePS1Material } from '../core/ps1Material.js';
import type { SurfaceField } from './surfaceField.js';

const MAX_TRACKS = 96;
const TRACK_WIDTH = 0.28;
const TRACK_LENGTH = 0.52;

export interface SnowTrackSystem {
    imprint(x: number, z: number, yaw: number): void;
    dispose(): void;
}

export function createSnowTrackSystem(group: THREE.Group, surface: SurfaceField): SnowTrackSystem {
    const trackMaterial = makePS1Material({ map: textures.winterSnow, color: COLORS.SNOW_SOIL }, { vertexSnap: false });
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(TRACK_WIDTH, TRACK_LENGTH), trackMaterial, MAX_TRACKS);
    mesh.name = 'snow-footprints';
    mesh.renderOrder = 2;
    mesh.frustumCulled = false;
    mesh.count = 0;
    group.add(mesh);
    const dummy = new THREE.Object3D();
    let count = 0;
    return {
        imprint(x, z, yaw) {
            const y = surface.maxHeightInRect({ minX: x - TRACK_WIDTH, maxX: x + TRACK_WIDTH, minZ: z - TRACK_LENGTH, maxZ: z + TRACK_LENGTH });
            dummy.position.set(x, y + 0.035, z);
            dummy.rotation.set(-Math.PI / 2, 0, yaw);
            dummy.updateMatrix();
            mesh.setMatrixAt(count % MAX_TRACKS, dummy.matrix);
            count += 1;
            mesh.count = Math.min(count, MAX_TRACKS);
            mesh.instanceMatrix.needsUpdate = true;
        },
        dispose() {
            group.remove(mesh);
            mesh.geometry.dispose();
            trackMaterial.dispose();
        }
    };
}
