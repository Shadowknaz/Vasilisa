// 2.5D Granular Snow Heightfield with Cellular Automaton & Thermal Relaxation.
// Implements angle-of-repose avalanche relaxation, wind-blown accumulation
// against obstacles, footprint displacement with lateral rim formation,
// and dynamic blizzard sweeping.
import { DIORAMA } from '../../config/world.js';
import type { SurfaceField } from '../surfaceField.js';

export interface GranularFieldConfig {
    resolution?: number; // Grid cells per axis (default 256 for ~0.42m precision)
    reposeAngle?: number; // Critical angle in degrees (default 34 deg)
    transferRate?: number; // Viscosity/flow rate per relaxation step (default 0.45)
}

export interface DirtyRect {
    minI: number;
    maxI: number;
    minJ: number;
    maxJ: number;
}

export class GranularSnowField {
    readonly size: number;
    readonly resolution: number;
    readonly cellSize: number;
    readonly halfSize: number;
    readonly tanRepose: number;
    readonly maxDeltaOrthogonal: number;
    readonly maxDeltaDiagonal: number;
    readonly transferRate: number;

    // Zero-allocation typed buffers
    readonly bedrock: Float32Array; // Base surface elevation (immutable ground/paving)
    readonly snow: Float32Array;    // Granular snow layer thickness S(x, z)
    readonly totalY: Float32Array;   // Y = bedrock + snow
    readonly flags: Uint8Array;     // Obstacle masks & cell metadata

    // Dirty bounding box for localized simulation and mesh updates
    private dirtyMinI: number;
    private dirtyMaxI: number;
    private dirtyMinJ: number;
    private dirtyMaxJ: number;
    private hasDirty: boolean = false;

    constructor(surface: SurfaceField, config: GranularFieldConfig = {}) {
        this.size = DIORAMA.SIZE; // 108 meters
        this.resolution = config.resolution ?? 256;
        this.cellSize = this.size / this.resolution;
        this.halfSize = this.size / 2;

        const reposeDeg = config.reposeAngle ?? 34;
        this.tanRepose = Math.tan((reposeDeg * Math.PI) / 180);
        this.maxDeltaOrthogonal = this.tanRepose * this.cellSize;
        this.maxDeltaDiagonal = this.maxDeltaOrthogonal * Math.SQRT2;
        this.transferRate = config.transferRate ?? 0.45;

        const totalCells = this.resolution * this.resolution;
        this.bedrock = new Float32Array(totalCells);
        this.snow = new Float32Array(totalCells);
        this.totalY = new Float32Array(totalCells);
        this.flags = new Uint8Array(totalCells);

        this.dirtyMinI = 0;
        this.dirtyMaxI = this.resolution - 1;
        this.dirtyMinJ = 0;
        this.dirtyMaxJ = this.resolution - 1;

        // Initialize bedrock elevation from authoritative SurfaceField
        for (let j = 0; j < this.resolution; j++) {
            const wz = -this.halfSize + (j + 0.5) * this.cellSize;
            for (let i = 0; i < this.resolution; i++) {
                const wx = -this.halfSize + (i + 0.5) * this.cellSize;
                const idx = j * this.resolution + i;
                const baseElev = surface.elevationAt(wx, wz);
                this.bedrock[idx] = baseElev;
                this.snow[idx] = 0;
                this.totalY[idx] = baseElev;
            }
        }
    }

    worldToCell(x: number, z: number): { i: number; j: number } {
        const i = Math.floor(((x + this.halfSize) / this.size) * this.resolution);
        const j = Math.floor(((z + this.halfSize) / this.size) * this.resolution);
        return {
            i: Math.max(0, Math.min(this.resolution - 1, i)),
            j: Math.max(0, Math.min(this.resolution - 1, j))
        };
    }

    cellToWorld(i: number, j: number): { x: number; z: number } {
        return {
            x: -this.halfSize + (i + 0.5) * this.cellSize,
            z: -this.halfSize + (j + 0.5) * this.cellSize
        };
    }

    markDirty(minI: number, maxI: number, minJ: number, maxJ: number): void {
        const cMinI = Math.max(0, minI);
        const cMaxI = Math.min(this.resolution - 1, maxI);
        const cMinJ = Math.max(0, minJ);
        const cMaxJ = Math.min(this.resolution - 1, maxJ);

        if (!this.hasDirty) {
            this.dirtyMinI = cMinI;
            this.dirtyMaxI = cMaxI;
            this.dirtyMinJ = cMinJ;
            this.dirtyMaxJ = cMaxJ;
            this.hasDirty = true;
        } else {
            this.dirtyMinI = Math.min(this.dirtyMinI, cMinI);
            this.dirtyMaxI = Math.max(this.dirtyMaxI, cMaxI);
            this.dirtyMinJ = Math.min(this.dirtyMinJ, cMinJ);
            this.dirtyMaxJ = Math.max(this.dirtyMaxJ, cMaxJ);
        }
    }

    getAndClearDirty(): DirtyRect | null {
        if (!this.hasDirty) return null;
        const result = {
            minI: this.dirtyMinI,
            maxI: this.dirtyMaxI,
            minJ: this.dirtyMinJ,
            maxJ: this.dirtyMaxJ
        };
        this.hasDirty = false;
        return result;
    }

    getSnow(x: number, z: number): number {
        const { i, j } = this.worldToCell(x, z);
        return this.snow[j * this.resolution + i];
    }

    getTotalY(x: number, z: number): number {
        const { i, j } = this.worldToCell(x, z);
        return this.totalY[j * this.resolution + i];
    }

    // Bilinear interpolated height query
    getInterpolatedHeight(x: number, z: number): number {
        const fx = ((x + this.halfSize) / this.size) * this.resolution - 0.5;
        const fz = ((z + this.halfSize) / this.size) * this.resolution - 0.5;

        const i0 = Math.max(0, Math.min(this.resolution - 1, Math.floor(fx)));
        const j0 = Math.max(0, Math.min(this.resolution - 1, Math.floor(fz)));
        const i1 = Math.min(this.resolution - 1, i0 + 1);
        const j1 = Math.min(this.resolution - 1, j0 + 1);

        const tx = Math.max(0, Math.min(1, fx - i0));
        const tz = Math.max(0, Math.min(1, fz - j0));

        const h00 = this.totalY[j0 * this.resolution + i0];
        const h10 = this.totalY[j0 * this.resolution + i1];
        const h01 = this.totalY[j1 * this.resolution + i0];
        const h11 = this.totalY[j1 * this.resolution + i1];

        const top = h00 + (h10 - h00) * tx;
        const btm = h01 + (h11 - h01) * tx;
        return top + (btm - top) * tz;
    }

    // Deposit snow at (wx, wz) with a bell-curve radial kernel
    depositMound(
        wx: number,
        wz: number,
        radius: number,
        peakHeight: number,
        asymmetryX: number = 0,
        asymmetryZ: number = 0
    ): void {
        const { i: centerI, j: centerJ } = this.worldToCell(wx, wz);
        const cellRadius = Math.ceil(radius / this.cellSize);

        const minI = Math.max(0, centerI - cellRadius);
        const maxI = Math.min(this.resolution - 1, centerI + cellRadius);
        const minJ = Math.max(0, centerJ - cellRadius);
        const maxJ = Math.min(this.resolution - 1, centerJ + cellRadius);

        for (let j = minJ; j <= maxJ; j++) {
            const cz = -this.halfSize + (j + 0.5) * this.cellSize;
            const dz = cz - wz - asymmetryZ * radius * 0.3;

            for (let i = minI; i <= maxI; i++) {
                const cx = -this.halfSize + (i + 0.5) * this.cellSize;
                const dx = cx - wx - asymmetryX * radius * 0.3;

                const dist = Math.hypot(dx, dz);
                if (dist >= radius) continue;

                const normDist = dist / radius;
                // Granular cosine profile
                const profile = Math.pow(Math.cos(normDist * (Math.PI / 2)), 1.3);
                const added = peakHeight * profile;

                const idx = j * this.resolution + i;
                this.snow[idx] += added;
                this.totalY[idx] = this.bedrock[idx] + this.snow[idx];
            }
        }
        this.markDirty(minI, maxI, minJ, maxJ);
    }

    // Interactive footprint indentation with lateral snow displacement (valik vytyasneniya)
    displaceFootprint(
        wx: number,
        wz: number,
        yaw: number,
        footWidth: number,
        footLength: number,
        indentDepth: number
    ): void {
        const cos = Math.cos(yaw);
        const sin = Math.sin(yaw);

        const halfL = footLength / 2;
        const halfW = footWidth / 2;
        const rimWidth = Math.max(0.18, footWidth * 0.45);
        const maxRadius = Math.hypot(halfL + rimWidth, halfW + rimWidth);
        const { i: centerI, j: centerJ } = this.worldToCell(wx, wz);
        const cellRadius = Math.ceil(maxRadius / this.cellSize);

        const minI = Math.max(0, centerI - cellRadius);
        const maxI = Math.min(this.resolution - 1, centerI + cellRadius);
        const minJ = Math.max(0, centerJ - cellRadius);
        const maxJ = Math.min(this.resolution - 1, centerJ + cellRadius);

        let displacedVolume = 0;
        let rimCellCount = 0;

        // First pass: indent under the foot and calculate displaced volume
        for (let j = minJ; j <= maxJ; j++) {
            const cz = -this.halfSize + (j + 0.5) * this.cellSize;
            for (let i = minI; i <= maxI; i++) {
                const cx = -this.halfSize + (i + 0.5) * this.cellSize;

                // Transform to local footprint frame
                const relX = cx - wx;
                const relZ = cz - wz;
                const lx = relX * cos - relZ * sin;
                const lz = relX * sin + relZ * cos;

                const insideFoot = Math.abs(lx) <= halfL && Math.abs(lz) <= halfW;
                const idx = j * this.resolution + i;

                if (insideFoot) {
                    const currentSnow = this.snow[idx];
                    if (currentSnow > 0.005) {
                        const targetSnow = Math.max(0.003, currentSnow - indentDepth);
                        const removed = currentSnow - targetSnow;
                        displacedVolume += removed;
                        this.snow[idx] = targetSnow;
                        this.totalY[idx] = this.bedrock[idx] + targetSnow;
                    }
                } else {
                    const rimDistX = Math.max(0, Math.abs(lx) - halfL);
                    const rimDistZ = Math.max(0, Math.abs(lz) - halfW);
                    const rimDist = Math.hypot(rimDistX, rimDistZ);
                    if (rimDist > 0 && rimDist <= rimWidth) {
                        rimCellCount++;
                    }
                }
            }
        }

        // Second pass: distribute displaced volume into the rim surrounding the foot
        if (displacedVolume > 0 && rimCellCount > 0) {
            const addedPerCell = (displacedVolume / rimCellCount) * 0.85; // 15% packing consolidation
            for (let j = minJ; j <= maxJ; j++) {
                const cz = -this.halfSize + (j + 0.5) * this.cellSize;
                for (let i = minI; i <= maxI; i++) {
                    const cx = -this.halfSize + (i + 0.5) * this.cellSize;

                    const relX = cx - wx;
                    const relZ = cz - wz;
                    const lx = relX * cos - relZ * sin;
                    const lz = relX * sin + relZ * cos;

                    const rimDistX = Math.max(0, Math.abs(lx) - halfL);
                    const rimDistZ = Math.max(0, Math.abs(lz) - halfW);
                    const rimDist = Math.hypot(rimDistX, rimDistZ);

                    if (rimDist > 0 && rimDist <= rimWidth) {
                        const falloff = Math.sin((rimDist / rimWidth) * Math.PI);
                        const idx = j * this.resolution + i;
                        this.snow[idx] += addedPerCell * falloff * 1.5;
                        this.totalY[idx] = this.bedrock[idx] + this.snow[idx];
                    }
                }
            }
        }

        this.markDirty(minI, maxI, minJ, maxJ);
    }

    // Angle-of-repose cellular automaton thermal relaxation (лавинное перераспределение)
    relax(iterations: number = 1, region?: DirtyRect): void {
        const res = this.resolution;
        const minI = region ? Math.max(1, region.minI - 1) : 1;
        const maxI = region ? Math.min(res - 2, region.maxI + 1) : res - 2;
        const minJ = region ? Math.max(1, region.minJ - 1) : 1;
        const maxJ = region ? Math.min(res - 2, region.maxJ + 1) : res - 2;

        const maxOrtho = this.maxDeltaOrthogonal;
        const maxDiag = this.maxDeltaDiagonal;
        const rate = this.transferRate;

        // Orthogonal and diagonal neighbor directions
        const di = [-1, 1, 0, 0, -1, 1, -1, 1];
        const dj = [0, 0, -1, 1, -1, -1, 1, 1];
        const maxD = [
            maxOrtho, maxOrtho, maxOrtho, maxOrtho,
            maxDiag, maxDiag, maxDiag, maxDiag
        ];

        for (let iter = 0; iter < iterations; iter++) {
            let anyMoved = false;

            for (let j = minJ; j <= maxJ; j++) {
                const rowOffset = j * res;

                for (let i = minI; i <= maxI; i++) {
                    const idx = rowOffset + i;
                    const currentSnow = this.snow[idx];
                    if (currentSnow <= 0.001) continue;

                    const currentH = this.totalY[idx];

                    let bestExcess = 0;
                    let bestNeighborIdx = -1;

                    for (let n = 0; n < 8; n++) {
                        const ni = i + di[n];
                        const nj = j + dj[n];
                        const nIdx = nj * res + ni;

                        const diff = currentH - this.totalY[nIdx];
                        const limit = maxD[n];
                        if (diff > limit) {
                            const excess = diff - limit;
                            if (excess > bestExcess) {
                                bestExcess = excess;
                                bestNeighborIdx = nIdx;
                            }
                        }
                    }

                    if (bestExcess > 0 && bestNeighborIdx >= 0) {
                        const transfer = Math.min(currentSnow, (bestExcess * 0.5) * rate);
                        if (transfer > 0.0005) {
                            this.snow[idx] -= transfer;
                            this.totalY[idx] -= transfer;

                            this.snow[bestNeighborIdx] += transfer;
                            this.totalY[bestNeighborIdx] += transfer;

                            anyMoved = true;
                        }
                    }
                }
            }

            if (!anyMoved) break;
        }

        this.markDirty(minI, maxI, minJ, maxJ);
    }

    // Dynamic gradual blizzard accumulation (slowly filling depressions and footsteps)
    accumulateBlizzard(dt: number, snowRate: number = 0.0015): void {
        const added = snowRate * dt;
        if (added <= 0) return;

        const total = this.resolution * this.resolution;
        for (let idx = 0; idx < total; idx++) {
            this.snow[idx] += added;
            this.totalY[idx] = this.bedrock[idx] + this.snow[idx];
        }
    }

    // Compute surface normal from finite differences on the heightfield
    computeNormal(x: number, z: number, out: [number, number, number]): void {
        const { i, j } = this.worldToCell(x, z);
        const res = this.resolution;

        const leftI = Math.max(0, i - 1);
        const rightI = Math.min(res - 1, i + 1);
        const btmJ = Math.max(0, j - 1);
        const topJ = Math.min(res - 1, j + 1);

        const hL = this.totalY[j * res + leftI];
        const hR = this.totalY[j * res + rightI];
        const hB = this.totalY[btmJ * res + i];
        const hT = this.totalY[topJ * res + i];

        const dx = (rightI - leftI) * this.cellSize;
        const dz = (topJ - btmJ) * this.cellSize;

        const nx = -(hR - hL) / dx;
        const nz = -(hT - hB) / dz;
        const ny = 1.0;

        const len = Math.hypot(nx, ny, nz) || 1;
        out[0] = nx / len;
        out[1] = ny / len;
        out[2] = nz / len;
    }
}
