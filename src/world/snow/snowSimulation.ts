// Dynamic granular snow simulation runtime:
// Manages the 2.5D heightfield, footprint displacement, avalanche relaxation,
// and real-time mesh synchronization with the diorama ground plane.
import * as THREE from 'three';
import { DIORAMA } from '../../config/world.js';
import type { SurfaceField } from '../surfaceField.js';
import type { Layout } from '../layout/createLayout.js';
import { GranularSnowField, type DirtyRect } from './granularField.js';
import { populateGranularSnow } from './windAccumulation.js';

export class SnowSimulation {
    readonly field: GranularSnowField;
    readonly surface: SurfaceField;
    private groundMesh: THREE.Mesh | null = null;
    private blizzardTimer: number = 0;

    constructor(surface: SurfaceField, layout: Layout) {
        this.surface = surface;
        this.field = new GranularSnowField(surface, { resolution: 256, reposeAngle: 34, transferRate: 0.45 });
        populateGranularSnow(this.field, layout);
    }

    attachGroundMesh(mesh: THREE.Mesh): void {
        this.groundMesh = mesh;
        this.syncMesh();
    }

    // Footstep indentation with lateral granular displacement & avalanche relaxation
    imprint(x: number, z: number, yaw: number, isMech = true): void {
        const width = isMech ? 0.65 : 0.28;
        const length = isMech ? 0.95 : 0.45;
        const depth = isMech ? 0.085 : 0.035;

        // Displace snow and create raised rim
        this.field.displaceFootprint(x, z, yaw, width, length, depth);

        // Relax the local dirty region with angle-of-repose cellular automaton
        const dirty = this.field.getAndClearDirty();
        if (dirty) {
            this.field.relax(2, dirty);
            this.syncMesh(dirty);
        }
    }

    // Per-frame update: gentle blizzard accumulation and gradual track relaxation
    update(dt: number): void {
        this.blizzardTimer += dt;
        // Periodic gentle relaxation of active areas every 0.15s
        if (this.blizzardTimer >= 0.15) {
            this.blizzardTimer = 0;
            const dirty = this.field.getAndClearDirty();
            if (dirty) {
                this.field.relax(1, dirty);
                this.syncMesh(dirty);
            }
        }
    }

    syncMesh(dirty?: DirtyRect): void {
        if (!this.groundMesh) return;
        const segs = DIORAMA.GROUND_SEGMENTS; // 128
        const geom = this.groundMesh.geometry;
        const posAttr = geom.attributes.position;

        const dMinI = dirty
            ? Math.max(0, Math.floor((dirty.minI / this.field.resolution) * segs) - 1)
            : 0;
        const dMaxI = dirty
            ? Math.min(segs, Math.ceil((dirty.maxI / this.field.resolution) * segs) + 1)
            : segs;
        const dMinJ = dirty
            ? Math.max(0, Math.floor((dirty.minJ / this.field.resolution) * segs) - 1)
            : 0;
        const dMaxJ = dirty
            ? Math.min(segs, Math.ceil((dirty.maxJ / this.field.resolution) * segs) + 1)
            : segs;

        for (let j = dMinJ; j <= dMaxJ; j++) {
            for (let i = dMinI; i <= dMaxI; i++) {
                const vIdx = j * (segs + 1) + i;
                const vx = posAttr.getX(vIdx);
                const worldZ = -posAttr.getY(vIdx);
                const snowH = this.field.getSnow(vx, worldZ);
                const baseRelief = this.surface.groundHeightAt(vx, worldZ);
                posAttr.setZ(vIdx, baseRelief + snowH);
            }
        }
        posAttr.needsUpdate = true;
    }
}
