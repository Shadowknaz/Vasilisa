// Material factory of the diorama: every lit surface in the project is created
// here, which is why the night renderer could be swapped in without touching a
// single world or mech builder.
//
// Two things make it more than a parameter bag:
// 1. PS1 vertex snap. Snapping moves only x/y in NDC, but it shears the
//    rasterized triangle: at a given pixel the interpolated depth then belongs to
//    a different point of the plane. Two different tessellations of the same flat
//    surface (a 128-segment terrain, a merged quad plate, a 2-triangle overlay)
//    shear differently, so their rendered depth diverges by far more than any sane
//    gap between layers and the depth test starts flipping pixels as the camera
//    moves. Flat ground layers therefore opt out of the snap
//    (`vertexSnap: false`); volumetric geometry keeps it, which is where the PS1
//    wobble actually reads.
// 2. The atmosphere uniforms. They are spread in by reference, not cloned: every
//    material in the scene points at the same { value } holders, so the whole
//    frame is lit and fogged by mutating one object once per frame
//    (core/atmosphere.ts).
import { PS1 } from '../config/render.js';
import { atmosphereUniforms } from './atmosphere.js';
import { SURFACE_FRAGMENT, SURFACE_VERTEX } from './shaders/surface.js';
import * as THREE from 'three';

// Shared between every snapping material: one holder, so the ?snap=off audit flag
// flips the whole scene with a single assignment instead of a re-compile.
const SNAP_ON = { value: PS1.VERTEX_SNAP_RESOLUTION as number };
// Flat ground layers own this one; it never changes.
const SNAP_OFF = { value: 0 };

export function setVertexSnapEnabled(enabled: boolean): void {
    SNAP_ON.value = enabled ? PS1.VERTEX_SNAP_RESOLUTION : 0;
}

// The snow shader snaps with the same grid, so it reads the same holder.
export function getVertexSnapResolution(): number {
    return SNAP_ON.value;
}

interface PS1MaterialOptions {
    // Flat ground surfaces (terrain, plates, pad, light pool) must not snap: see
    // the module header. Defaults to true for everything that stands above ground.
    vertexSnap?: boolean;
    polygonOffset?: boolean;
    polygonOffsetFactor?: number;
    polygonOffsetUnits?: number;
    depthWrite?: boolean;
}

export function makePS1Material(
    params: THREE.MeshLambertMaterialParameters,
    options: PS1MaterialOptions = {}
): THREE.ShaderMaterial {
    const { vertexSnap = true, polygonOffset, polygonOffsetFactor, polygonOffsetUnits, depthWrite } = options;
    const hasMap = Boolean(params.map);

    const material = new THREE.ShaderMaterial({
        vertexShader: SURFACE_VERTEX,
        fragmentShader: SURFACE_FRAGMENT,
        uniforms: {
            ...atmosphereUniforms,
            uColor: { value: new THREE.Color(params.color !== undefined ? params.color : 0xffffff) },
            uEmissive: { value: new THREE.Color(params.emissive !== undefined ? params.emissive : 0x000000) },
            uOpacity: { value: params.opacity !== undefined ? params.opacity : 1 },
            uSnapResolution: vertexSnap ? SNAP_ON : SNAP_OFF,
            uMap: { value: hasMap ? params.map : null }
        },
        // Two program variants only: with and without an albedo map.
        defines: hasMap ? { USE_MAP: '' } : {},
        side: params.side !== undefined ? params.side : THREE.FrontSide,
        transparent: params.transparent === true,
        extensions: { derivatives: true }
    });

    const useOffset = polygonOffset ?? params.polygonOffset;
    if (useOffset !== undefined) material.polygonOffset = useOffset;
    const factor = polygonOffsetFactor ?? params.polygonOffsetFactor;
    if (factor !== undefined) material.polygonOffsetFactor = factor;
    const units = polygonOffsetUnits ?? params.polygonOffsetUnits;
    if (units !== undefined) material.polygonOffsetUnits = units;
    const writeDepth = depthWrite ?? params.depthWrite;
    if (writeDepth !== undefined) material.depthWrite = writeDepth;
    if (params.depthTest !== undefined) material.depthTest = params.depthTest;

    if (params.transparent === true && writeDepth === undefined) {
        material.depthWrite = false;
    }

    return material;
}
