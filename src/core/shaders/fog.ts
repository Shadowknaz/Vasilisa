// One atmosphere model, shared by every custom shader. The geometry shader and
// the snow shader used to fade differently — three's `fog_fragment` for surfaces,
// a `smoothstep(near, far)` for flakes — which is why snow disappeared into a
// different haze than the yard behind it. Both now call atmosphereFog().
import { FOG } from '../../config/render.js';
import { NOISE_CHUNK } from './common.js';

// Bank shaping is tuning, so it comes from config rather than a literal in GLSL.
const BANK_BASE = FOG.NOISE.BANK_BASE.toFixed(3);
const BANK_GAIN = FOG.NOISE.BANK_GAIN.toFixed(3);

export const ATMOSPHERE_UNIFORM_GLSL = `
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uFogHeightFalloff;
uniform float uFogHeightMix;
uniform float uFogNoiseScale;
uniform float uFogNoiseAmount;
uniform vec2 uFogDrift;
uniform float uTime;
`;

// The base term is three's FogExp2 law verbatim, so a built-in material (voids,
// dust, beam cones) and this shader settle into the same tone at the same depth.
// The two extra factors are the ones the linear Fog could not express:
// - height: haze pools in the yard and thins with altitude, so the roofs of the
//   Khrushchyovka stay readable while the far kerb dissolves;
// - banks: a slowly drifting noise field, so the haze has a shape instead of
//   reading as a flat grey veil.
export const ATMOSPHERE_FUNCTION_GLSL = `
${NOISE_CHUNK}

float atmosphereFog(vec3 worldPos, float viewDepth) {
    float base = 1.0 - exp(-uFogDensity * uFogDensity * viewDepth * viewDepth);
    float height = exp(-max(worldPos.y, 0.0) * uFogHeightFalloff);
    float bank = valueNoise(worldPos.xz * uFogNoiseScale + uFogDrift * uTime);
    float density = mix(1.0, height, uFogHeightMix) * mix(1.0, ${BANK_BASE} + ${BANK_GAIN} * bank, uFogNoiseAmount);
    return clamp(base * density, 0.0, 1.0);
}

vec3 applyAtmosphere(vec3 color, vec3 worldPos, float viewDepth) {
    return mix(color, uFogColor, atmosphereFog(worldPos, viewDepth));
}
`;
