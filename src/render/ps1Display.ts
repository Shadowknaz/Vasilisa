// Low-resolution 2D display canvas that stretches the PS1 framebuffer.
import { PS1 } from '../config/render.js';

export function createPS1Display(canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    let width: number = PS1.DEFAULT_WIDTH;

    function resize(aspect: number): number {
        width = Math.max(PS1.MIN_WIDTH, Math.floor(PS1.FRAME_HEIGHT * aspect));
        canvas.width = width;
        canvas.height = PS1.FRAME_HEIGHT;
        return width;
    }

    return {
        canvas,
        context,
        resize,
        get width() {
            return width;
        }
    };
}
