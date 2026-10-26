// GPU snow shader: modern soft particles with deliberately quantized motion.
//
// The field is a torus: fall wraps through the volume height and the wind wraps
// through its x/z extents, so a constant density is preserved forever instead of
// the whole cloud drifting away from the level.
//
// Everything shared with the rest of the frame comes from the shader chunks: the
// clip-space snap, the lamp array, the SKY (hemisphere + moon + fill) and the
// atmosphere. A flake used to fade on its own smoothstep while the yard behind it
// faded on three's linear fog, and it used to carry its own brightness while the
// yard was lit — both are now the same light model, so the snowfall cannot become
// the brightest layer of a dark frame.
import { PS1_SNAP_CHUNK } from '../core/shaders/common.js';
import { ATMOSPHERE_FUNCTION_GLSL, ATMOSPHERE_UNIFORM_GLSL } from '../core/shaders/fog.js';
import {
    LAMP_FUNCTION_GLSL,
    LAMP_UNIFORM_GLSL,
    SKY_FUNCTION_GLSL,
    SKY_UNIFORM_GLSL
} from '../core/shaders/lighting.js';

export const WINTER_SNOW_VERTEX = `
${PS1_SNAP_CHUNK}
${LAMP_UNIFORM_GLSL}
${ATMOSPHERE_UNIFORM_GLSL}
${LAMP_FUNCTION_GLSL}

attribute float aPhase;
attribute float aSize;
uniform float uHeight;
uniform vec2 uHalfExtents;
uniform float uSnapResolution;
uniform float uFallSpeed;
uniform float uPointScale;
uniform float uMaxPointSize;
uniform vec2 uWind;
uniform float uLampTint;
varying float vDepth;
varying vec3 vWorldPos;
varying float vTwinkle;
varying vec3 vLampLight;

void main() {
    vec3 p = position;
    float fall = uTime * uFallSpeed + aPhase * 17.0;
    float swayX = sin(uTime * 0.55 + aPhase * 13.0) * 0.42;
    float swayZ = cos(uTime * 0.42 + aPhase * 9.0) * 0.22;
    p.y = mod(p.y - fall, uHeight);
    // The half extent is added before the modulo: the base positions are
    // centred on the origin, and mod() only folds correctly into [0, 2H).
    p.x = mod(p.x + swayX + uWind.x * uTime + uHalfExtents.x, uHalfExtents.x * 2.0) - uHalfExtents.x;
    p.z = mod(p.z + swayZ + uWind.y * uTime + uHalfExtents.y, uHalfExtents.y * 2.0) - uHalfExtents.y;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    // Same clip-space grid as the geometry: a flake snaps exactly like the surface
    // behind it, so the field never leaves a smooth layer in a snapped frame.
    gl_Position = ps1Snap(projectionMatrix * mv, uSnapResolution);

    gl_PointSize = clamp(aSize * uPointScale / max(1.0, -mv.z), 1.0, uMaxPointSize);
    vDepth = -mv.z;
    vWorldPos = p;
    // A flake entering a lamp pool lights up: this is what makes the snowfall read
    // as air rather than as noise on top of the image.
    vLampLight = lampLighting(p, vec3(0.0, 1.0, 0.0));
    vTwinkle = 0.72 + 0.28 * sin(uTime * 1.7 + aPhase * 31.0);
}
`;

export const WINTER_SNOW_FRAGMENT = `
${ATMOSPHERE_UNIFORM_GLSL}
${ATMOSPHERE_FUNCTION_GLSL}
${SKY_UNIFORM_GLSL}
${SKY_FUNCTION_GLSL}

uniform vec3 uColor;
uniform float uOpacity;
uniform float uLampTint;
// Same switch and same neutral light as the surface shader: a flake has to obey
// key N like every other layer of the frame.
uniform float uNightMode;
uniform float uNeutralAmbient;
varying float vDepth;
varying vec3 vWorldPos;
varying float vTwinkle;
varying vec3 vLampLight;

void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float disc = 1.0 - smoothstep(0.45, 1.0, dot(p, p));
    float alpha = disc * uOpacity * vTwinkle;
    if (alpha < 0.025) discard;
    // A flake is a tiny sphere of ice: it takes the dome from above, which is why
    // the sky term is evaluated with an up-facing normal instead of its own.
    vec3 lit = uNightMode < 0.5 ? vec3(uNeutralAmbient) : skyLight(vec3(0.0, 1.0, 0.0));
    vec3 color = uColor * lit + vLampLight * uLampTint;
    gl_FragColor = vec4(applyAtmosphere(color, vWorldPos, vDepth), alpha);
}
`;
