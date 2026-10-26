// requestAnimationFrame loop with a clamped delta time.
import { FRAME } from '../config/render.js';

export function startRenderLoop(onFrame: (dt: number) => void): () => void {
    let lastFrameTime = performance.now();
    let frameId: number | null = null;
    let running = true;

    function animateLoop(now: number): void {
        if (!running) return;
        frameId = requestAnimationFrame(animateLoop);
        const dt = Math.min(FRAME.MAX_DELTA, (now - lastFrameTime) / 1000);
        lastFrameTime = now;
        onFrame(dt);
    }

    frameId = requestAnimationFrame(animateLoop);

    return () => {
        running = false;
        if (frameId !== null) {
            cancelAnimationFrame(frameId);
            frameId = null;
        }
    };
}
