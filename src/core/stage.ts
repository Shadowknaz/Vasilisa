// Renderer, scene and camera of the diorama.
//
// There is no three.js light in this scene. The night model — hemisphere ambient,
// moon, and up to LAMPS.MAX practicals — is evaluated per fragment by the surface
// shader from the shared uniform block in core/atmosphere.ts, so adding a light
// to the scene graph would do exactly nothing. Shadow maps are gone with the
// directional light: a weak moon casts long hard shadows that fight the pools of
// the street lamps, and the custom shader would have to sample the shadow map by
// hand.
import { CAMERA, FOG } from '../config/render.js';
// The sky and the haze are exposed together with the hemisphere (see core/atmosphere.ts).
import { skyTone } from './atmosphere.js';
import * as THREE from 'three';

export interface Stage {
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    dispose(): void;
}

export function createStage(): Stage {
    // Internal WebGLRenderer renders at low PS1 resolution
    const renderer = new THREE.WebGLRenderer({
        antialias: false,
        powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(1);

    const scene = new THREE.Scene();
    // The sky is the haze, not the void: at night the air between the camera and
    // the island is visible, and a black background would silhouette the island
    // against nothing. The pedestal still reads because it is darker than the sky.
    // The backdrop is NOT a scene.background: render/sky.ts owns it (a horizon of
    // exactly this colour fading to a darker zenith), because a Color background
    // would force three to clear the target on every pass and wipe that gradient.
    // Both the backdrop and the haze come from skyTone() (core/atmosphere.ts), so a
    // darker night cannot leave a luminous fog wall over a black yard.
    // Exponential-squared: the only fog law where one density scalar describes
    // both the near courtyard and the far island. The camera rig blends the
    // per-mode density into this instance and the atmosphere mirrors it back for
    // the custom shaders.
    const fog = new THREE.FogExp2(FOG.COLOR, FOG.DENSITY.GAME);
    skyTone(fog.color);
    scene.fog = fog;

    const camera = new THREE.PerspectiveCamera(
        CAMERA.INITIAL_FOV,
        CAMERA.INITIAL_ASPECT,
        CAMERA.NEAR,
        CAMERA.FAR
    );

    return {
        renderer,
        scene,
        camera,
        dispose(): void {
            renderer.dispose();
        }
    };
}
