// Authoritative "how high is the ground here" query. The relief mesh, the
// pavement plates and the searchlight's ground pool read the same numbers, so an
// overlay is always lifted above the highest surface it covers instead of
// relying on one hard-coded height for all layers (previously 0.025–0.038 for
// ground, asphalt, paving and the building apron alike).
import { DECOR } from '../config/layout.js';
import { GROUND_OVERLAY } from '../config/render.js';
import { DIORAMA, SURFACE } from '../config/world.js';
import { expandRect, pointRectDistance, type Rect } from './layout/rect.js';
import type { Layout, SurfaceRects } from './layout/createLayout.js';

// Band over which the flattened ground blends back into the terrain.
const FLATTEN = {
    EDGE: SURFACE.FLATTEN_EDGE,
    BLEND: SURFACE.FLATTEN_BLEND
};

// Concrete landing pad next to the mech: it is a plate of its own, so the light
// pool on it must not sink to the ground below.
export const STENCIL_PAD = {
    WIDTH: 6.4,
    DEPTH: 3.2,
    X: DECOR.stencilPad.x,
    Z: DECOR.stencilPad.z
} as const;

export interface SurfaceField {
    // Height of the relief itself (0 under every flattened mask).
    groundHeightAt(x: number, z: number): number;
    // Highest surface touched by a footprint, plus a sampling margin. A single
    // flat overlay cannot follow the relief, so it rides above the highest sample.
    maxHeightInRect(rect: Rect): number;
    // Authoritative exact surface elevation at a point (taking into account terrain relief and plates)
    elevationAt(x: number, z: number): number;
}

function stencilPadRect(): Rect {
    const pad = {
        minX: STENCIL_PAD.X - STENCIL_PAD.WIDTH / 2,
        maxX: STENCIL_PAD.X + STENCIL_PAD.WIDTH / 2,
        minZ: STENCIL_PAD.Z - STENCIL_PAD.DEPTH / 2,
        maxZ: STENCIL_PAD.Z + STENCIL_PAD.DEPTH / 2
    };
    return expandRect(pad, FLATTEN.EDGE);
}

// Collect every rectangle the ground must stay flat under: pavement, paved zones,
// pedestrian links, buildings, props and the stencil pad.
function collectFlatRects(layout: Layout, surfaceRects: SurfaceRects): Rect[] {
    const rects: Rect[] = [
        ...surfaceRects.asphalt,
        ...surfaceRects.shells,
        ...surfaceRects.walk,
        ...surfaceRects.paving
    ];

    layout.zones.forEach((zone) => rects.push(zone.rect));

    layout.objects.forEach((object) => {
        if (object.worldVisualFootprint) rects.push(object.worldVisualFootprint);
    });

    rects.push(stencilPadRect());
    return rects;
}

// 0 inside a flat rectangle, 1 once the terrain is fully back. The smoothstep in
// between keeps the transition from reading as a hard edge under the iso camera.
function flatBlend(x: number, z: number, rects: Rect[]): number {
    let best = Number.POSITIVE_INFINITY;
    for (let index = 0; index < rects.length; index++) {
        const distance = pointRectDistance(x, z, rects[index]);
        if (distance < best) {
            best = distance;
            if (best <= FLATTEN.EDGE) return 0;
        }
    }
    if (best >= FLATTEN.EDGE + FLATTEN.BLEND) return 1;
    const t = (best - FLATTEN.EDGE) / FLATTEN.BLEND;
    return t * t * (3 - 2 * t);
}

// Same formula the relief mesh is displaced with. Outside the terrain band the
// ground is a flat slab at y = 0.
// Multi-octave natural winter terrain: broad rolling snow swells, wind-carved
// waves and soft hollows across unpaved courtyard grounds. Inside flattened masks
// (asphalt, sidewalks, links, plinths) it smoothly blends to 0.
function terrainHeightAt(x: number, z: number): number {
    if (Math.max(Math.abs(x), Math.abs(z)) >= DIORAMA.SIZE * DIORAMA.TERRAIN_EDGE_RATIO) return 0;
    const swell = Math.sin(x * 0.16 + z * 0.09) * Math.cos(z * 0.13 - x * 0.07);
    const windWave = Math.sin(x * 0.36 - z * 0.26) * 0.45;
    const ripple = Math.cos(x * 0.62 + z * 0.44) * 0.22;
    // Produces ~12-15 cm of natural rolling snow blanket relief across open lawns
    return (swell + windWave + ripple) * 0.092;
}

function anyOverlaps(rects: Rect[], other: Rect): boolean {
    for (let index = 0; index < rects.length; index++) {
        const rect = rects[index];
        if (rect.minX <= other.maxX && other.minX <= rect.maxX && rect.minZ <= other.maxZ && other.minZ <= rect.maxZ) {
            return true;
        }
    }
    return false;
}

function sampleCount(span: number): number {
    const [min, max] = GROUND_OVERLAY.SAMPLES_PER_AXIS;
    return Math.min(max, Math.max(min, Math.ceil(span / GROUND_OVERLAY.SAMPLE_SPACING) + 1));
}

export function createSurfaceField({ layout, surfaceRects }: { layout: Layout; surfaceRects: SurfaceRects }): SurfaceField {
    const flatRects = collectFlatRects(layout, surfaceRects);

    // Plate priority mirrors the mask order of the plan: pedestrian links and
    // paved zones are painted over the carriageway, the sidewalk shell is the
    // layer under everything else.
    const paving = [...surfaceRects.walk, ...surfaceRects.paving, stencilPadRect()];
    const asphalt = surfaceRects.asphalt;
    const sidewalk = surfaceRects.shells;

    function groundHeightAt(x: number, z: number): number {
        const terrain = terrainHeightAt(x, z);
        if (terrain === 0) return 0;
        return terrain * flatBlend(x, z, flatRects);
    }

    function terrainMaxInRect(rect: Rect): number {
        const spanX = rect.maxX - rect.minX;
        const spanZ = rect.maxZ - rect.minZ;
        const stepsX = sampleCount(spanX);
        const stepsZ = sampleCount(spanZ);
        let max = Number.NEGATIVE_INFINITY;
        for (let i = 0; i < stepsX; i++) {
            const x = stepsX > 1 ? rect.minX + (spanX * i) / (stepsX - 1) : (rect.minX + rect.maxX) / 2;
            for (let j = 0; j < stepsZ; j++) {
                const z = stepsZ > 1 ? rect.minZ + (spanZ * j) / (stepsZ - 1) : (rect.minZ + rect.maxZ) / 2;
                const height = groundHeightAt(x, z);
                if (height > max) max = height;
            }
        }
        return Number.isFinite(max) ? max : 0;
    }

    function maxHeightInRect(rect: Rect): number {
        // Conservative on purpose: one plane cannot follow two plates, so it rides
        // above the highest layer the footprint touches.
        let height = terrainMaxInRect(rect) + GROUND_OVERLAY.SAMPLE_MARGIN;
        if (anyOverlaps(asphalt, rect)) height = Math.max(height, SURFACE.ASPHALT);
        if (anyOverlaps(paving, rect) || anyOverlaps(sidewalk, rect)) {
            height = Math.max(height, SURFACE.PAVING);
        }
        return height;
    }

    function elevationAt(x: number, z: number): number {
        const relief = groundHeightAt(x, z);
        for (let i = 0; i < paving.length; i++) {
            const r = paving[i];
            if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
                return Math.max(relief, SURFACE.PAVING);
            }
        }
        for (let i = 0; i < sidewalk.length; i++) {
            const r = sidewalk[i];
            if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
                return Math.max(relief, SURFACE.PAVING);
            }
        }
        for (let i = 0; i < asphalt.length; i++) {
            const r = asphalt[i];
            if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
                return Math.max(relief, SURFACE.ASPHALT);
            }
        }
        return relief;
    }

    return { groundHeightAt, maxHeightInRect, elevationAt };
}
