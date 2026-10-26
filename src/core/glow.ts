// Additive light overlays. Both the searchlight and every street lamp need the
// same two pieces — a soft pool lying on the ground and a halo hanging in the air
// at the fixture — so they are built here once. They are light, never shadow: a
// black decal on the ground stays forbidden (this project has none), an additive
// one is the whole point of a night frame.
//
// Both pieces are scaled by NIGHT.PRACTICAL_SCALE here, once, instead of per
// fixture: the additive layer is one budget, and it has to follow the sky down or
// the courtyard turns into a black plate with white discs lying on it.
import { GROUND_OVERLAY, NIGHT } from '../config/render.js';
import { textures } from './textures.js';
import * as THREE from 'three';

// Every additive overlay registers itself here. They are light, and light belongs
// to the night model: when the night is switched off (key N / ?night=off) the whole
// set disappears with one call, instead of each builder listening to the flag.
const glowObjects: THREE.Object3D[] = [];

function registerGlow(object: THREE.Object3D): void {
    glowObjects.push(object);
}

export function setGlowVisible(visible: boolean): void {
    for (const object of glowObjects) object.visible = visible;
}

interface GroundPoolOptions {
    width: number;
    depth: number;
    opacity: number;
    color?: number;
    map?: THREE.Texture;
}

// A pool is a flat plane lifted just above the surface under it and pushed toward
// the camera in depth, so it can never fight the pavement it lies on.
export function createGroundPool({ width, depth, opacity, color = 0xffffff, map = textures.lightPool }: GroundPoolOptions): THREE.Mesh {
    const material = new THREE.MeshBasicMaterial({
        map,
        color,
        transparent: true,
        opacity: opacity * NIGHT.PRACTICAL_SCALE,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        polygonOffset: true,
        polygonOffsetFactor: GROUND_OVERLAY.POLYGON_OFFSET_FACTOR,
        polygonOffsetUnits: GROUND_OVERLAY.POLYGON_OFFSET_UNITS
    });
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
    pool.rotation.x = -Math.PI / 2;
    pool.renderOrder = GROUND_OVERLAY.POOL_RENDER_ORDER;
    registerGlow(pool);
    return pool;
}

interface HaloOptions {
    size: number;
    opacity: number;
    color?: number;
}

// A halo is the light dissolving in the haze: an always-camera-facing additive
// disc at the fixture itself. Sprites are not fogged in r128, which is exactly
// what is wanted — a lamp that fades into the same grey as the wall behind it
// stops reading as a light.
export function createHalo({ size, opacity, color = 0xffffff }: HaloOptions): THREE.Sprite {
    const material = new THREE.SpriteMaterial({
        map: textures.halo,
        color,
        transparent: true,
        opacity: opacity * NIGHT.PRACTICAL_SCALE,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    const halo = new THREE.Sprite(material);
    halo.scale.set(size, size, 1);
    halo.renderOrder = GROUND_OVERLAY.POOL_RENDER_ORDER;
    registerGlow(halo);
    return halo;
}
