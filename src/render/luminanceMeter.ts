// Luminance sampling of the finished frame. The debug meter reads the 2D display
// canvas, i.e. exactly what the player sees: after the GPU grade, the dither and
// the quantizer. That makes the acceptance band in FRAME_METER.LUMA measurable in
// the running app instead of only from a screenshot.
//
// It lives on its own because the verdict ("is this night dark enough") must not be
// duplicated between the meter, the docs and a script.
import { FRAME_METER, POST_PROCESS } from '../config/render.js';

interface LuminanceStats {
    // All values are 0..1 of full scale.
    mean: number;
    p50: number;
    p95: number;
    p99: number;
    max: number;
}

const BINS = 256;

export function sampleLuminance(
    context: CanvasRenderingContext2D,
    width: number,
    height: number
): LuminanceStats | null {
    const frame = context.getImageData(0, 0, width, height);
    const data = frame.data;
    const histogram = new Uint32Array(BINS);
    let sum = 0;
    let count = 0;

    for (let index = 0; index < data.length; index += 4) {
        const value =
            data[index] * POST_PROCESS.LUMA_R +
            data[index + 1] * POST_PROCESS.LUMA_G +
            data[index + 2] * POST_PROCESS.LUMA_B;
        const bin = value > 255 ? 255 : value < 0 ? 0 : value | 0;
        histogram[bin] += 1;
        sum += value;
        count += 1;
    }
    if (count === 0) return null;

    const percentile = (share: number): number => {
        const target = count * share;
        let accumulated = 0;
        for (let bin = 0; bin < BINS; bin += 1) {
            accumulated += histogram[bin];
            if (accumulated >= target) return bin / 255;
        }
        return 1;
    };

    let highest = BINS - 1;
    while (highest > 0 && histogram[highest] === 0) highest -= 1;

    return {
        mean: sum / count / 255,
        p50: percentile(0.5),
        p95: percentile(0.95),
        p99: percentile(0.99),
        max: highest / 255
    };
}

// The night contract of the rework (docs/ATMOSPHERE.md). Kept next to the sampler
// so the meter can print a verdict instead of raw numbers.
//
// Three numbers, because "a dark night with barely visible silhouettes" is three
// claims:
// - mean: the frame IS dark (0.018-0.045 is 4.5-11 of 255 on average);
// - p99: nothing but a practical core is bright (the searchlight cone and the lamp
//   heads are the only things allowed past ~0.3);
// - sep = p95 - p50: the frame still has tonal structure, so a shape can be read
//   against what is behind it. At the isometric spawn p95 is the lit courtyard and
//   p50 the dark masses; in the overview p95 is the haze and p50 the island; in
//   first person p95 is the beam and p50 the cockpit. The band is deliberately the
//   widest reading of all three, and docs/ATMOSPHERE.md carries the per-pose
//   numbers -- a single band wide enough for every pose cannot also be tight.
// With the night model switched off the numbers are still printed, but they are not
// judged: that frame is a diagnostic, not the look.
export function describeLuminance(stats: LuminanceStats, nightEnabled: boolean): string {
    const levels = (value: number): number => Math.round(value * 255);
    const separation = stats.p95 - stats.p50;
    const reading =
        `luma ${stats.mean.toFixed(3)} p50 ${levels(stats.p50)} p95 ${levels(stats.p95)} ` +
        `sep ${levels(separation)}`;
    if (!nightEnabled) return `${reading} night off`;

    const band = FRAME_METER.LUMA;
    const meanOk = stats.mean >= band.MEAN_MIN && stats.mean <= band.MEAN_MAX;
    const brightOk = stats.p99 <= band.P99_MAX;
    const shapeOk = separation >= band.SEPARATION_MIN && separation <= band.SEPARATION_MAX;
    return `${reading} ${meanOk && brightOk && shapeOk ? 'night ok' : 'OUT OF BAND'}`;
}
