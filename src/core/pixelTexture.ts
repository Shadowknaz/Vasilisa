import { TEXTURE } from '../config/render.js';
import * as THREE from 'three';
// Factory for low-resolution canvas textures with NearestFilter (PS1 look).

export function createPixelTexture(
    width: number,
    height: number,
    drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d')!;
    drawFn(context, width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Monochrome texel colour: the palette of every procedural texture is a single
// grey level, so the generator never carries a hue of its own.
export function gray(value: number): string {
    const level = Math.max(0, Math.min(255, value | 0));
    return `rgb(${level},${level},${level})`;
}

// Flat ground layers are seen at a grazing angle: near the mech a texel covers
// several pixels, at the far kerb it covers a fraction of one. Magnification stays
// Nearest (crisp pixel look), minification goes through mipmaps so the 1-texel
// slab joints stop aliasing into a screen-space lattice that crawls as the camera
// moves. Only the big horizontal surfaces need it; props keep plain NearestFilter.
export function setGroundMinification(texture: THREE.CanvasTexture): THREE.CanvasTexture {
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.anisotropy = TEXTURE.MAX_ANISOTROPY;
    texture.needsUpdate = true;
    return texture;
}
