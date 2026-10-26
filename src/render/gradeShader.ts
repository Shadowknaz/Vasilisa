// Fullscreen grade of the PS1 framebuffer. This used to be a per-pixel JavaScript
// loop that read 384 x 256 pixels back into the 2D context every frame; the same
// photograph is now one drawing-buffer-sized quad.
//
// The chain, in order: luminance → vignette → night curve → ordered dither →
// 7-bit quantize → duotone tint. Luminance stays the only signal that travels
// through the curve, so the monochrome identity of the frame survives; the tint is
// applied to the quantized level, which is what gives cold shadow and warm light
// without introducing a second colour pipeline.
import { POST_PROCESS } from '../config/render.js';

// The quad is a 2x2 plane; its clip-space position is already the response, so
// the vertex stage only has to pass the UV through.
export const GRADE_VERTEX = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// 4x4 ordered dither, built from the bit-reversal identity of the Bayer matrix
// instead of a literal table: GLSL ES 1.00 has no array constructors, and the
// pattern is defined up to permutation anyway.
const BAYER_CHUNK = `
float bayer2(vec2 a) {
    a = floor(a);
    return fract(a.x / 2.0 + a.y * a.y * 0.75);
}

float bayer4(vec2 a) {
    return bayer2(0.5 * a) * 0.25 + bayer2(a);
}
`;

const {
    LUMA_R,
    LUMA_G,
    LUMA_B,
    SHADOW_THRESHOLD,
    SHADOW_SCALE,
    MID_OFFSET,
    MID_SCALE,
    HIGHLIGHT_THRESHOLD,
    HIGHLIGHT_OFFSET,
    HIGHLIGHT_SCALE,
    DITHER_MIN,
    DITHER_MAX,
    DITHER_WEIGHT,
    MIN_LEVEL,
    MAX_LEVEL,
    QUANTIZE_STEP,
    VIGNETTE,
    SHADOW_TINT,
    HIGHLIGHT_TINT
} = POST_PROCESS;

export const GRADE_FRAGMENT = `
${BAYER_CHUNK}

uniform sampler2D uScene;
uniform vec2 uFrameSize;
// 0 = raw render (?post=off): the audit switch has to show the untouched buffer.
uniform float uEnabled;
varying vec2 vUv;

void main() {
    vec3 scene = texture2D(uScene, vUv).rgb;
    if (uEnabled < 0.5) {
        gl_FragColor = vec4(scene, 1.0);
        return;
    }

    float luma = dot(scene, vec3(${LUMA_R.toFixed(3)}, ${LUMA_G.toFixed(3)}, ${LUMA_B.toFixed(3)})) * 255.0;

    // Vignette before the curve: the falloff is then dithered and quantized like
    // any other ramp instead of banding a smooth gradient against a flat frame.
    float radius = length((vUv - 0.5) * 2.0);
    float vignette = 1.0 - ${VIGNETTE.STRENGTH.toFixed(3)} *
        smoothstep(${VIGNETTE.INNER.toFixed(3)}, ${VIGNETTE.OUTER.toFixed(3)}, radius);
    float v = luma * vignette;

    // Three-zone night curve, continuous at both anchors.
    if (v < ${SHADOW_THRESHOLD.toFixed(1)}) {
        v *= ${SHADOW_SCALE.toFixed(3)};
    } else if (v < ${HIGHLIGHT_THRESHOLD.toFixed(1)}) {
        v = ${MID_OFFSET.toFixed(2)} + (v - ${SHADOW_THRESHOLD.toFixed(1)}) * ${MID_SCALE.toFixed(3)};
    } else {
        v = ${HIGHLIGHT_OFFSET.toFixed(2)} + (v - ${HIGHLIGHT_THRESHOLD.toFixed(1)}) * ${HIGHLIGHT_SCALE.toFixed(3)};
    }

    // Screen-space Bayer, indexed by framebuffer pixel so the pattern never
    // stretches with the viewport. Amplitude is exactly one quantization step.
    float dither = 0.0;
    if (v > ${DITHER_MIN.toFixed(1)} && v < ${DITHER_MAX.toFixed(1)}) {
        vec2 pixel = floor(vUv * uFrameSize);
        dither = (bayer4(pixel) - 0.5) * 2.0 * 8.0 * ${DITHER_WEIGHT.toFixed(3)};
    }
    v = clamp(v + dither, ${MIN_LEVEL.toFixed(1)}, ${MAX_LEVEL.toFixed(1)});

    // 7-bit step instead of 6-bit: the courtyard sits around tone 40, where a
    // 4-level step is 10 % of its brightness and the dither mixing it reads as a
    // checkerboard. Halving the step keeps the quantizer visible but makes a
    // flipped pixel imperceptible.
    float level = floor(v / ${QUANTIZE_STEP.toFixed(1)}) * ${QUANTIZE_STEP.toFixed(1)};
    float value = level / 255.0;

    // Duotone: cold in the shadows, warm in the light. The tint is normalised to
    // unit luminance, so it shifts the chromaticity of a level without darkening
    // it — an unnormalised tint silently multiplies the whole frame by ~0.6.
    vec3 tint = mix(
        vec3(${SHADOW_TINT.r.toFixed(3)}, ${SHADOW_TINT.g.toFixed(3)}, ${SHADOW_TINT.b.toFixed(3)}),
        vec3(${HIGHLIGHT_TINT.r.toFixed(3)}, ${HIGHLIGHT_TINT.g.toFixed(3)}, ${HIGHLIGHT_TINT.b.toFixed(3)}),
        value
    );
    tint /= max(dot(tint, vec3(${LUMA_R.toFixed(3)}, ${LUMA_G.toFixed(3)}, ${LUMA_B.toFixed(3)})), 0.001);
    gl_FragColor = vec4(tint * value, 1.0);
}
`;
