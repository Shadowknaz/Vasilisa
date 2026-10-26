// Wind-blown snow accumulation and dune seeding across the diorama.
// Seeds snow blanket decor, wind barchans, roadside drifts and wall drifts
// onto the GranularSnowField, then applies cellular automaton relaxation.
import type { Layout, CurbSegment } from '../layout/createLayout.js';
import type { GranularSnowField } from './granularField.js';
import { objectsOfType } from '../placement.js';
import { createSeededRandom } from '../../core/random.js';

const WIND = {
    YAW: 0.28, // Prevailing winter wind (~16 degrees)
    DIRT_ROADSIDE_RATIO: 0.22,
    RELAX_ITERATIONS: 22
};

export function populateGranularSnow(field: GranularSnowField, layout: Layout): void {
    const random = createSeededRandom(layout.seed || 108);

    // 1. Base snow blanket across unpaved courtyard areas (8 to 14 cm)
    const res = field.resolution;
    const half = field.halfSize;
    const cell = field.cellSize;

    for (let j = 0; j < res; j++) {
        const wz = -half + (j + 0.5) * cell;
        for (let i = 0; i < res; i++) {
            const wx = -half + (i + 0.5) * cell;
            const idx = j * res + i;
            const bedrock = field.bedrock[idx];

            // If bedrock is near ground level (not elevated asphalt/paving > 0.03), deposit base snow
            if (bedrock <= 0.015 || (bedrock <= 0.05 && Math.abs(wx) > 14 && Math.abs(wz) > 14)) {
                // Natural organic wave modulation
                const wave = Math.sin(wx * 0.18 + wz * 0.12) * Math.cos(wz * 0.15 - wx * 0.08) * 0.035;
                const ripple = Math.sin(wx * 0.42 - wz * 0.35) * 0.015;
                const baseSnow = Math.max(0.04, 0.085 + wave + ripple);
                field.snow[idx] = baseSnow;
                field.totalY[idx] = bedrock + baseSnow;
            }
        }
    }

    // 2. Ploughed roadside banks along kerbs
    const crossings = layout.crossings || [];
    layout.curbs.forEach((curb: CurbSegment) => {
        const isXAxis = curb.axis === 'x';
        const start = isXAxis ? Math.min(curb.x0, curb.x1) : Math.min(curb.z0, curb.z1);
        const end = isXAxis ? Math.max(curb.x0, curb.x1) : Math.max(curb.z0, curb.z1);
        const span = end - start;
        if (span < 2.0) return;

        const count = Math.max(1, Math.round(span / 3.2));
        const step = span / count;

        for (let i = 0; i < count; i++) {
            const along = start + (i + 0.5) * step + (random() - 0.5) * 0.4;

            let nearCrossing = false;
            for (const crossing of crossings) {
                const crossCoord = isXAxis ? crossing.x : crossing.z;
                if (Math.abs(along - crossCoord) < 2.0) {
                    nearCrossing = true;
                    break;
                }
            }
            if (nearCrossing) continue;

            const radius = 1.2 + random() * 0.6;
            const peakHeight = 0.22 + random() * 0.12;

            const offset = curb.side * (0.16 + radius * 0.5);
            const cx = isXAxis ? along : curb.x + offset;
            const cz = isXAxis ? curb.z + offset : along;

            field.depositMound(cx, cz, radius, peakHeight, -curb.side * 0.25, 0);
        }
    });

    // 3. Snow banked against Khrushchyovka building plinths
    const buildings = objectsOfType(layout, 'khrushchyovka');
    buildings.forEach((building) => {
        const footprint = building.worldVisualFootprint;
        if (!footprint) return;

        const accessPoints = building.accessPoints;
        const halfWidth = (footprint.maxX - footprint.minX) / 2;
        const centerZ = (footprint.minZ + footprint.maxZ) / 2;

        const frontZ = building.transform.rotY === 0 ? footprint.maxZ : footprint.minZ;
        const frontSide = building.transform.rotY === 0 ? 1 : -1;
        const frontSteps = Math.floor((halfWidth * 2) / 3.8);

        for (let i = 0; i < frontSteps; i++) {
            const x = footprint.minX + 1.8 + i * 3.8 + (random() - 0.5) * 0.6;
            if (x >= footprint.maxX - 1.5) break;

            let nearAccess = false;
            for (const pt of accessPoints) {
                if (Math.abs(x - pt.world.x) < 2.0) {
                    nearAccess = true;
                    break;
                }
            }
            if (nearAccess) continue;

            const radius = 1.6 + random() * 0.5;
            const peakHeight = 0.32 + random() * 0.14;
            const cz = frontZ + frontSide * (radius * 0.45);
            field.depositMound(x, cz, radius, peakHeight, 0, frontSide * 0.3);
        }

        const rearZ = building.transform.rotY === 0 ? footprint.minZ : footprint.maxZ;
        const rearSide = -frontSide;
        const rearSteps = Math.floor((halfWidth * 2) / 4.2);

        for (let i = 0; i < rearSteps; i++) {
            const x = footprint.minX + 2.0 + i * 4.2 + (random() - 0.5) * 0.8;
            if (x >= footprint.maxX - 1.8) break;

            const radius = 1.7 + random() * 0.6;
            const peakHeight = 0.34 + random() * 0.15;
            const cz = rearZ + rearSide * (radius * 0.45);
            field.depositMound(x, cz, radius, peakHeight, 0, rearSide * 0.3);
        }

        // Gable ends
        [-1, 1].forEach((endSign) => {
            const endX = endSign < 0 ? footprint.minX : footprint.maxX;
            const radius = 1.5 + random() * 0.4;
            const peakHeight = 0.28 + random() * 0.12;
            const cx = endX + endSign * (radius * 0.45);
            field.depositMound(cx, centerZ, radius, peakHeight, endSign * 0.3, 0);
        });
    });

    // 4. Courtyard lawn dunes and cushions
    const lawnZones = [
        { minX: -36, maxX: -15, minZ: -18, maxZ: -4, count: 8, seed: 101 },
        { minX: 14, maxX: 36, minZ: -18, maxZ: -4, count: 7, seed: 102 },
        { minX: -36, maxX: -15, minZ: 4, maxZ: 18, count: 8, seed: 103 },
        { minX: 14, maxX: 36, minZ: 4, maxZ: 18, count: 7, seed: 104 },
        { minX: -38, maxX: 38, minZ: -44, maxZ: -38, count: 10, seed: 106 },
        { minX: -38, maxX: 38, minZ: 38, maxZ: 45, count: 10, seed: 107 }
    ];

    lawnZones.forEach((zone) => {
        const zoneRandom = createSeededRandom(zone.seed);
        const spanX = zone.maxX - zone.minX;
        const spanZ = zone.maxZ - zone.minZ;

        for (let i = 0; i < zone.count; i++) {
            const cx = zone.minX + (i + 0.5) * (spanX / zone.count) + (zoneRandom() - 0.5) * (spanX / zone.count * 0.6);
            const cz = zone.minZ + zoneRandom() * spanZ;

            const radius = 2.4 + zoneRandom() * 1.8;
            const peakHeight = 0.20 + zoneRandom() * 0.14;
            const windAsymmX = Math.cos(WIND.YAW) * 0.25;
            const windAsymmZ = Math.sin(WIND.YAW) * 0.25;

            field.depositMound(cx, cz, radius, peakHeight, windAsymmX, windAsymmZ);
        }
    });

    // 5. Apply Cellular Automaton Relaxation:
    // Natural angle-of-repose avalanche relaxation smooths all deposited mounds
    // into physically realistic, continuous slopes and domes
    field.relax(WIND.RELAX_ITERATIONS);
}
