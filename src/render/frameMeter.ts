// Debug frame meter (?perf): rolling frame times, the draw stats of the last
// rendered frame and the measured tone of the finished picture. Debug only — the
// normal boot path never creates it.
//
// The tone line is the acceptance instrument of the night rework: it samples the
// same 2D canvas the player looks at and judges it against FRAME_METER.LUMA, so
// "the frame is too bright / too dark" is answered by a number instead of an
// opinion.
import { FRAME_METER } from '../config/render.js';
import { RENDER_FLAGS } from '../core/renderFlags.js';
import { describeLuminance, sampleLuminance } from './luminanceMeter.js';
import type { WebGLRenderer } from 'three';
import type { FrameRender } from './frameRender.js';
import type { createPS1Display } from './ps1Display.js';

export function createFrameMeter(
    renderer: WebGLRenderer,
    display: ReturnType<typeof createPS1Display>,
    frame: FrameRender
) {
    const samples: number[] = new Array(FRAME_METER.SAMPLES).fill(0);
    let cursor = 0;
    let filled = 0;
    let elapsed = 0;
    let tone = 'luma --';

    const box = document.createElement('div');
    box.className = 'frame-meter';
    document.body.appendChild(box);

    function percentile(sorted: number[], ratio: number): number {
        const index = Math.min(sorted.length - 1, Math.floor(sorted.length * ratio));
        return sorted[index];
    }

    function update(): void {
        const values = samples.slice(0, filled).sort((a, b) => a - b);
        const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
        box.textContent = [
            `fps ${(1000 / mean).toFixed(1)}  mean ${mean.toFixed(2)} ms`,
            `p50 ${percentile(values, 0.5).toFixed(2)}  p95 ${percentile(values, 0.95).toFixed(2)}`,
            `calls ${frame.stats.calls}  tris ${frame.stats.triangles}`,
            `${renderer.domElement.width}x${renderer.domElement.height}`,
            tone
        ].join('\n');
    }

    // Reading the canvas back is not free, so it happens on the same throttle as the
    // text refresh and never per frame.
    function sampleTone(): void {
        if (!display.context) return;
        const stats = sampleLuminance(display.context, display.width, renderer.domElement.height);
        if (stats) tone = describeLuminance(stats, RENDER_FLAGS.night);
    }

    return {
        sample(dt: number): void {
            if (dt <= 0) return;
            samples[cursor] = dt * 1000;
            cursor = (cursor + 1) % samples.length;
            filled = Math.min(samples.length, filled + 1);
            elapsed += dt;
            if (elapsed < FRAME_METER.UPDATE_SECONDS || filled < 8) return;
            elapsed = 0;
            sampleTone();
            update();
        }
    };
}
