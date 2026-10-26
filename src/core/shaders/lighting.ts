// Local lights of the night scene. Ten is the whole budget: four pole lamps, the
// kiosk window, two porch bulbs and the searchlight's spot plus its ground bounce.
// They travel to the GPU as three parallel vec4 arrays instead of a struct array,
// because GLSL ES 1.00 only allows constant loop bounds and dynamic indexing of
// plain arrays; the loop below runs to MAX_LAMPS and breaks on uLampCount.
import { LAMPS } from '../../config/render.js';

// Wider than four decimals of noise and it stops mattering at 3° of cone.
const CONE_INNER_RATIO = LAMPS.CONE_INNER_RATIO.toFixed(3);
// Wrapped lambert: N·L * WRAP + (1 - WRAP), so a face turned away keeps 1-WRAP of
// its albedo instead of falling into a black wedge.
const WRAP = LAMPS.WRAP.toFixed(3);
const WRAP_FLOOR = (1 - LAMPS.WRAP).toFixed(3);

export const LAMP_UNIFORM_GLSL = `
#define MAX_LAMPS ${LAMPS.MAX}
// xyz = world position, w = range in metres
uniform vec4 uLampPos[MAX_LAMPS];
// rgb = colour, w = intensity
uniform vec4 uLampColor[MAX_LAMPS];
// xyz = spot axis, w = cos of the outer angle (-2.0 marks a plain point light)
uniform vec4 uLampDir[MAX_LAMPS];
// xyz = right axis for an elliptical spot, w = vertical outer cosine
uniform vec4 uLampRight[MAX_LAMPS];
uniform int uLampCount;
`;

// Two falloffs, one for each thing a light has to do at night:
// - inverse-square-ish range falloff, squared so it dies before the edge of its
//   range instead of ending on a visible disc;
// - a wrapped lambert, because a face turned away from the last lamp must still
//   carry some albedo: at these light levels a hard N·L term puts a black wedge on
//   every corner of a wall.
export const LAMP_FUNCTION_GLSL = `
float lampWrap(vec3 normal, vec3 direction) {
    return max(0.0, dot(normal, direction) * ${WRAP} + ${WRAP_FLOOR});
}

vec3 lampLighting(vec3 worldPos, vec3 normal) {
    vec3 sum = vec3(0.0);
    for (int i = 0; i < MAX_LAMPS; i++) {
        if (i >= uLampCount) break;
        vec3 toLamp = uLampPos[i].xyz - worldPos;
        float dist = length(toLamp);
        float range = uLampPos[i].w;
        if (dist > range) continue;
        vec3 direction = toLamp / max(dist, 0.0001);
        float falloff = 1.0 - dist / range;
        falloff *= falloff;
        float cone = 1.0;
        float cosOuter = uLampDir[i].w;
        if (cosOuter > -1.5) {
            // uLampDir is the axis the spot LOOKS ALONG, while direction points
            // from the surface to the lamp: the dot product needs the negated axis,
            // otherwise the cone test is inverted and a spot lights nothing at all.
            vec3 spotAxis = normalize(-uLampDir[i].xyz);
            vec4 spotRight = uLampRight[i];
            if (spotRight.w > -1.5 && length(spotRight.xyz) > 0.001) {
                vec3 right = normalize(spotRight.xyz);
                vec3 up = normalize(cross(spotAxis, right));
                float forward = dot(spotAxis, direction);
                if (forward > 0.001) {
                    if (spotRight.w > 0.001) {
                        // --- 1. PLAYER FLASHLIGHT (Handheld / Headlamp optics) ---
                        float hLimit = tan(acos(cosOuter));
                        float vLimit = tan(acos(spotRight.w));
                        float un = (dot(right, direction) / forward) / max(hLimit, 0.0001);
                        float vn = (dot(up, direction) / forward) / max(vLimit, 0.0001);
                        float r = length(vec2(un, vn));
                        float phi = atan(vn, un);

                        // Organic micro-modulation: eliminates sterile computer oval
                        float rMod = r * (1.0 + 0.038 * sin(phi * 4.0 + 1.25) + 0.022 * cos(phi * 7.0 - 0.45) + 0.015 * sin(phi * 11.0 + 2.1));

                        // Intense central hotspot + smooth reflector corona + wide peripheral spill
                        float hotspot = exp(-rMod * rMod * 5.2);
                        float corona = smoothstep(1.05, 0.16, rMod);
                        float spill = smoothstep(1.5, 0.7, rMod) * 0.24;

                        // Concentric caustic lens rings
                        float rings = 1.0 + 0.065 * sin(rMod * 28.0) * smoothstep(0.12, 0.88, rMod);

                        // Subtle filament vertical asymmetry
                        float asym = 1.0 - 0.05 * vn;

                        cone = (hotspot * 2.2 + corona * 0.72 + spill) * rings * asym;
                        cone *= smoothstep(1.5, 1.2, rMod);
                    } else {
                        // --- 2. MECH SEARCHLIGHT (Caged military searchlight optics) ---
                        float limit = tan(acos(cosOuter));
                        float un = (dot(right, direction) / forward) / max(limit, 0.0001);
                        float vn = (dot(up, direction) / forward) / max(limit, 0.0001);
                        float r = length(vec2(un, vn));
                        float phi = atan(vn, un);

                        // Physical cross-grille cage shadow (from the two protective steel bars)
                        float barU = smoothstep(0.012, 0.08, abs(un));
                        float barV = smoothstep(0.012, 0.08, abs(vn));
                        float cageShadow = mix(0.72, 1.0, barU * barV);

                        // Parabolic reflector facet striations (ribbed military searchlight dish)
                        float facetRibs = 1.0 + 0.045 * cos(phi * 12.0) + 0.024 * sin(phi * 24.0);

                        // Subtle organic perimeter modulation
                        float rDist = r * (1.0 + 0.035 * sin(phi * 5.0 + 0.8) + 0.02 * cos(phi * 9.0 - 0.4));

                        // High-power hotspot + broad corona + spill
                        float hotspot = exp(-r * r * 4.0);
                        float corona = smoothstep(1.0, 0.22, r);
                        float spill = smoothstep(1.35, 0.75, r) * 0.18;

                        cone = (hotspot * 2.0 + corona * 0.75 + spill) * cageShadow * facetRibs;
                        cone *= smoothstep(1.35, 1.05, rDist);
                    }
                } else {
                    cone = 0.0;
                }
            } else {
                // --- 3. STANDARD STREET / PORCH LAMPS ---
                float cosAngle = dot(spotAxis, direction);
                cone = smoothstep(cosOuter, mix(cosOuter, 1.0, ${CONE_INNER_RATIO}), cosAngle);
            }
        }
        sum += uLampColor[i].rgb * (uLampColor[i].w * falloff * cone * lampWrap(normal, direction));
    }
    return sum;
}
`;

// What the sky gives an arbitrary surface: hemisphere dome + moon + anti-moon
// fill + the flat floor. It is a chunk rather than four lines inside the surface
// shader because the snowfall has to be lit by the same sky: a flake that carries
// its own brightness outshines the yard the moment the surface budget drops, and
// the two layers then read as two different nights.
export const SKY_UNIFORM_GLSL = `
uniform vec3 uMoonColor;
uniform float uMoonIntensity;
uniform vec3 uMoonDirection;
uniform vec3 uFillColor;
uniform float uFillIntensity;
uniform vec3 uFillDirection;
uniform vec3 uSkyColor;
uniform float uSkyIntensity;
uniform vec3 uGroundColor;
uniform float uGroundIntensity;
uniform float uHemisphereExp;
uniform float uAmbientFloor;
`;

export const SKY_FUNCTION_GLSL = `
vec3 skyLight(vec3 normal) {
    // Hemisphere ambient: cold dome above, the warm bounce of the frozen ground
    // below. This is what keeps a roof and a wall apart while both stay dark.
    float up = normal.y * 0.5 + 0.5;
    vec3 ambient = mix(
        uGroundColor * uGroundIntensity,
        uSkyColor * uSkyIntensity,
        pow(up, uHemisphereExp)
    ) + uAmbientFloor;

    // Moon: a single directional source, weak on purpose. It only has to model
    // the volumes and let the snow caps catch the sky.
    float moon = max(dot(normal, uMoonDirection), 0.0);
    vec3 direct = uMoonColor * (uMoonIntensity * moon);

    // Sky fill from the anti-moon side: the shaded face of a volume still has the
    // rest of the dome above it, and without this term the walker turns into a
    // silhouette as soon as the camera orbits behind it.
    float fill = max(dot(normal, uFillDirection), 0.0);
    direct += uFillColor * (uFillIntensity * fill);

    return ambient + direct;
}
`;
