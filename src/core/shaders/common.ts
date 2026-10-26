// Shared GLSL building blocks. Every custom shader in the project imports from
// here instead of carrying its own copy: the clip-space snap used to exist twice
// (once as a material injection, once inline in the snow shader) and the two
// copies had already drifted apart.

// PlayStation 1 GTE vertex quantization: clip space is divided by w, floored to a
// fixed grid and multiplied back. `res` is the grid resolution in NDC units; 0
// disables the snap, which is how the ?snap=off audit flag and the flat ground
// layers (see core/ps1Material.ts) opt out of it.
export const PS1_SNAP_CHUNK = `
vec4 ps1Snap(vec4 clip, float res) {
    if (res <= 0.0) return clip;
    vec3 ndc = clip.xyz / clip.w;
    ndc.xy = floor(res * ndc.xy + 0.5) / res;
    return vec4(ndc * clip.w, clip.w);
}
`;

// Value noise: one hash, one bilinear interpolation. Enough for drifting fog
// banks at the 384 x 256 framebuffer size, where a smooth gradient is going to be
// quantized into a handful of levels anyway.
export const NOISE_CHUNK = `
float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
    vec2 cell = floor(p);
    vec2 f = fract(p);
    vec2 w = f * f * (3.0 - 2.0 * f);
    float a = hash21(cell);
    float b = hash21(cell + vec2(1.0, 0.0));
    float c = hash21(cell + vec2(0.0, 1.0));
    float d = hash21(cell + vec2(1.0, 1.0));
    return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
}
`;

// Flat (faceted) normal, rebuilt from the screen-space derivatives of the world
// position. This is what `flatShading: true` did for MeshLambertMaterial: the
// merged quad geometry already carries per-face normals, but the cylinders and
// cones of the props do not, and the PS1 look depends on them reading as facets.
// The facing test keeps the normal pointing out of the surface for DoubleSide
// materials (iron fences, tree frost, snow stems); a degenerate derivative (a
// sliver triangle seen edge-on) falls back to the interpolated normal.
export const FLAT_NORMAL_CHUNK = `
vec3 flatNormal(vec3 worldPos, vec3 fallbackNormal) {
    vec3 derived = cross(dFdx(worldPos), dFdy(worldPos));
    float len = length(derived);
    if (len < 1e-7) return fallbackNormal;
    derived /= len;
    return dot(derived, fallbackNormal) >= 0.0 ? derived : -derived;
}
`;
