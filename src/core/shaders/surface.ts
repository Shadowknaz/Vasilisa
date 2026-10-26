// The one lit surface shader of the diorama. It replaces MeshLambertMaterial for
// every world and mech builder (they all go through makePS1Material), because a
// Lambert surface lights per *vertex* and a night scene needs three things it
// cannot do: light pools with a smooth per-pixel falloff, haze that varies per
// pixel, and an emissive term that survives the haze instead of being baked into
// the vertex colour.
//
// Shading order is deliberately fixed: albedo → hemisphere ambient → moon →
// practicals → emissive → fog. Fog last means a lamp and the searchlight glow
// *through* the haze, which is the whole point of a night frame. Windows carry no
// emissive at all: the courtyard has been without power for eleven years, so a
// sash is read by albedo, not by light.
import { ATMOSPHERE_FUNCTION_GLSL, ATMOSPHERE_UNIFORM_GLSL } from './fog.js';
import {
    LAMP_FUNCTION_GLSL,
    LAMP_UNIFORM_GLSL,
    SKY_FUNCTION_GLSL,
    SKY_UNIFORM_GLSL
} from './lighting.js';
import { FLAT_NORMAL_CHUNK, PS1_SNAP_CHUNK } from './common.js';
import { NIGHT } from '../../config/render.js';

const EMISSIVE_BOOST = NIGHT.EMISSIVE_BOOST;

const SURFACE_UNIFORM_GLSL = `
uniform vec3 uColor;
uniform vec3 uEmissive;
uniform float uOpacity;
uniform float uSnapResolution;
// 1 = night model, 0 = neutral studio light (key N / ?night=off).
uniform float uNightMode;
uniform float uNeutralAmbient;
uniform float uNeutralDirect;
#ifdef USE_MAP
uniform sampler2D uMap;
#endif
${SKY_UNIFORM_GLSL}
${LAMP_UNIFORM_GLSL}
${ATMOSPHERE_UNIFORM_GLSL}
`;

export const SURFACE_VERTEX = `
${PS1_SNAP_CHUNK}

uniform float uSnapResolution;

varying vec3 vWorldPos;
varying vec3 vSurfaceNormal;
varying vec2 vUv;
varying float vViewDepth;

void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    // Interpolated normal only exists so the fragment shader has something to
    // test facing against; the shading normal itself is rebuilt per pixel.
    vSurfaceNormal = normalize(mat3(modelMatrix) * normal);
    vUv = uv;

    vec4 view = viewMatrix * world;
    vViewDepth = -view.z;
    gl_Position = ps1Snap(projectionMatrix * view, uSnapResolution);
}
`;

export const SURFACE_FRAGMENT = `
${FLAT_NORMAL_CHUNK}
${SURFACE_UNIFORM_GLSL}
${LAMP_FUNCTION_GLSL}
${SKY_FUNCTION_GLSL}
${ATMOSPHERE_FUNCTION_GLSL}

varying vec3 vWorldPos;
varying vec3 vSurfaceNormal;
varying vec2 vUv;
varying float vViewDepth;

void main() {
    #ifdef USE_MAP
    vec4 texel = texture2D(uMap, vUv);
    #else
    vec4 texel = vec4(1.0);
    #endif
    vec3 albedo = texel.rgb * uColor;

    vec3 geoNormal = gl_FrontFacing ? vSurfaceNormal : -vSurfaceNormal;
    vec3 normal = flatNormal(vWorldPos, geoNormal);

    // Diagnostic path (key N / ?night=off): the night model is switched off
    // wholesale — no hemisphere, no moon tint, no practicals, no emissive, no fog.
    // What is left is the albedo under a plain neutral key, which is exactly the
    // question "is this artefact in the look or in the geometry".
    if (uNightMode < 0.5) {
        float key = max(dot(normal, uMoonDirection), 0.0);
        vec3 neutral = vec3(uNeutralAmbient + uNeutralDirect * key);
        gl_FragColor = vec4(albedo * neutral, uOpacity);
        return;
    }

    // Sky-given light (hemisphere + moon + fill + floor) comes from the shared
    // chunk, so the snowfall is lit by exactly the same sky as this surface.
    vec3 light = skyLight(normal) + lampLighting(vWorldPos, normal);

    // Emissive is multiplied by the albedo so a lit window keeps its frame and
    // crossbar: the texture is what shapes the glow, not a flat rectangle. The
    // boost compensates for the albedo factor and is what makes it read as light.
    vec3 color = albedo * light + albedo * uEmissive * ${EMISSIVE_BOOST.toFixed(2)};

    gl_FragColor = vec4(applyAtmosphere(color, vWorldPos, vViewDepth), uOpacity);
}
`;
