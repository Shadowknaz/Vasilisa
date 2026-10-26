// Viewport resize: keeps the PS1 framebuffer aspect ratio in sync with the window.
import { PS1 } from '../config/render.js';
import type { WebGLRenderer, PerspectiveCamera } from 'three';
import type { FrameRender } from './frameRender.js';
import type { createPS1Display } from './ps1Display.js';

export function resizeViewport(
    display: ReturnType<typeof createPS1Display>,
    renderer: WebGLRenderer,
    camera: PerspectiveCamera,
    frame: FrameRender
): void {
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const width = display.resize(aspect);

    renderer.setSize(width, PS1.FRAME_HEIGHT, false);
    // The render target and the grade quad follow the drawing buffer, so the two
    // can never disagree about the framebuffer size.
    frame.resize(width, PS1.FRAME_HEIGHT);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
}
