// Granular visual and physical snow response.
// Footprints displace physical 2.5D heightfield snow with lateral compaction rims
// and lay PS1 tread decals at the depressed floor.
import * as THREE from 'three';
import { COLORS } from '../config/colors.js';
import { textures } from '../core/textures.js';
import { makePS1Material } from '../core/ps1Material.js';
import type { SurfaceField } from './surfaceField.js';
import type { SnowSimulation } from './snow/snowSimulation.js';

const MAX_TRACKS = 96;
const TRACK_WIDTH = 0.35;
const TRACK_LENGTH = 0.65;

export interface SnowTrackSystem {
    imprint(x: number, z: number, yaw: number, isMech?: boolean): void;
    update?(dt: number): void;
    dispose(): void;
}

export function createSnowTrackSystem(
    group: THREE.Group,
    surface: SurfaceField,
    snowSim?: SnowSimulation
): SnowTrackSystem {
    const trackMaterial = makePS1Material(
        { map: textures.winterSnow, color: COLORS.SNOW_SOIL },
        { vertexSnap: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, depthWrite: false }
    );
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(TRACK_WIDTH, TRACK_LENGTH), trackMaterial, MAX_TRACKS);
    mesh.name = 'snow-footprints';
    mesh.renderOrder = 2;
    mesh.frustumCulled = false;
    mesh.count = 0;
    group.add(mesh);
    const dummy = new THREE.Object3D();
    let count = 0;

    return {
        imprint(x, z, yaw, isMech = true) {
            // 1. Physically deform 2.5D heightfield with cellular automaton relaxation
            snowSim?.imprint(x, z, yaw, isMech);

            // 2. Place instanced tread decal at the indented floor of the footprint
            const y = snowSim
                ? snowSim.field.getInterpolatedHeight(x, z)
                : surface.elevationAt(x, z);

            const scale = isMech ? 1.0 : 0.6;
            dummy.position.set(x, y + 0.003, z);
            dummy.rotation.set(-Math.PI / 2, 0, yaw);
            dummy.scale.set(scale, scale, 1);
            dummy.updateMatrix();
            mesh.setMatrixAt(count % MAX_TRACKS, dummy.matrix);
            count += 1;
            mesh.count = Math.min(count, MAX_TRACKS);
            mesh.instanceMatrix.needsUpdate = true;
        },
        update(dt) {
            snowSim?.update(dt);
        },
        dispose() {
            group.remove(mesh);
            mesh.geometry.dispose();
            trackMaterial.dispose();
        }
    };
}
