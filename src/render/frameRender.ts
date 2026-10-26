// The frame pipeline: scene → low-res render target → grade quad → display canvas.
//
// It lives in one place because the render target, the grade quad and the blit are
// three parts of a single step; splitting them is how the previous CPU pass ended
// up reading the drawing buffer back every frame.
import { PS1 } from '../config/render.js';
import { RENDER_FLAGS } from '../core/renderFlags.js';
import { GRADE_FRAGMENT, GRADE_VERTEX } from './gradeShader.js';
import { createSkyPass } from './sky.js';
import type { createPS1Display } from './ps1Display.js';
import * as THREE from 'three';

export interface FrameRender {
    resize(width: number, height: number): void;
    // `viewmodelCamera` is the second pass of the frame: the same scene drawn
    // again with the eye pose and a much shorter near plane, after the depth
    // buffer is cleared (see render/viewmodel.ts for why the arms need it).
    render(scene: THREE.Scene, camera: THREE.Camera, viewmodelCamera?: THREE.PerspectiveCamera | null): void;
    dispose(): void;
    // Draw stats of the *scene* pass. The renderer resets `info` on every
    // render() call, and the last call of a frame is the 2-triangle grade quad —
    // reading the renderer directly would always report "1 call, 2 triangles".
    readonly stats: { calls: number; triangles: number };
}

function gradeEnabled(): boolean {
    // The grade *is* the night grade: duotone, crushed toe and dither only make
    // sense while the night model is on. ?post=off still isolates the grade alone.
    return RENDER_FLAGS.postProcess && RENDER_FLAGS.night;
}

export function createFrameRender(
    renderer: THREE.WebGLRenderer,
    display: ReturnType<typeof createPS1Display>
): FrameRender {
    // Nearest filtering on both ends: the target is sampled 1:1 by the grade quad,
    // and any smoothing here would blur the pixel grid the whole look depends on.
    const target = new THREE.WebGLRenderTarget(PS1.DEFAULT_WIDTH, PS1.FRAME_HEIGHT, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        depthBuffer: true,
        stencilBuffer: false
    });

    const gradeUniforms = {
        uScene: { value: target.texture },
        uFrameSize: { value: new THREE.Vector2(PS1.DEFAULT_WIDTH, PS1.FRAME_HEIGHT) },
        uEnabled: { value: gradeEnabled() ? 1 : 0 }
    };

    const gradeMaterial = new THREE.ShaderMaterial({
        vertexShader: GRADE_VERTEX,
        fragmentShader: GRADE_FRAGMENT,
        uniforms: gradeUniforms,
        depthTest: false,
        depthWrite: false
    });

    const quadScene = new THREE.Scene();
    const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), gradeMaterial);
    quad.frustumCulled = false;
    quadScene.add(quad);

    const stats = { calls: 0, triangles: 0 };

    // The backdrop is drawn into the same target as the scene, so the grade, the
    // dither and the quantizer see one image instead of a composited pair.
    const sky = createSkyPass();

    function resize(width: number, height: number): void {
        target.setSize(width, height);
        gradeUniforms.uFrameSize.value.set(width, height);
    }

    function render(scene: THREE.Scene, camera: THREE.Camera, viewmodelCamera?: THREE.PerspectiveCamera | null): void {
        // The audit flag is read per frame, so ?post=off can be toggled from the
        // debug panel without rebuilding the pipeline.
        gradeUniforms.uEnabled.value = gradeEnabled() ? 1 : 0;

        renderer.setRenderTarget(target);
        // The sky pass is the clear of this frame: it fills the target with the
        // backdrop and clears depth in the same step. The scene then draws over it,
        // so autoClear has to be off for that one call -- and the scene must not
        // carry a Color background, or three would clear the target again on top
        // of the backdrop (core/stage.ts says so from the other side).
        if (camera instanceof THREE.PerspectiveCamera) {
            // The gradient belongs to the night model; with it switched off (key N /
            // ?night=off) the same pass paints the flat haze tone, which is exactly
            // the backdrop the diagnostic frame has always had.
            sky.render(renderer, camera, RENDER_FLAGS.night);
            renderer.autoClear = false;
        }
        renderer.render(scene, camera);
        let calls = renderer.info.render.calls;
        let triangles = renderer.info.render.triangles;

        // Viewmodel pass: only the layer the arms live on is drawn, the depth of
        // the world is thrown away (the arms are always in front of it, that is
        // what a viewmodel is), and the short near plane of this camera means no
        // sleeve can be sliced open by CAMERA.NEAR.
        if (viewmodelCamera) {
            renderer.clearDepth();
            renderer.render(scene, viewmodelCamera);
            calls += renderer.info.render.calls;
            triangles += renderer.info.render.triangles;
        }
        renderer.autoClear = true;
        // Snapshot before the grade pass resets the counters.
        stats.calls = calls;
        stats.triangles = triangles;

        renderer.setRenderTarget(null);
        renderer.render(quadScene, quadCamera);

        // The display canvas is a plain 2D canvas: it is the one that stretches to
        // the viewport with nearest-neighbour sampling (see styles/main.css).
        display.context?.drawImage(renderer.domElement, 0, 0);
    }

    function dispose(): void {
        target.dispose();
        gradeMaterial.dispose();
        quad.geometry.dispose();
        sky.dispose();
    }

    return {
        resize,
        render,
        dispose,
        get stats() {
            return stats;
        }
    };
}
