// The sky of the frame: one fullscreen gradient drawn into the PS1 render target
// before the scene.
//
// It exists because a flat backdrop cannot do the one job the backdrop has at
// night. A silhouette is read against what stands behind it, so the sky needs two
// tones: the horizon, which is exactly the haze colour (a fully fogged surface
// meets it without a seam), and a darker zenith. In the top-down poses -- the
// isometric camera and the overview -- the horizon lies above the frame and the
// backdrop is the horizon tone alone, which is also the physically right answer
// (looking down you see the air near the ground). The gradient itself appears where
// a real sky is in frame: the pilot raising their eyes past the rooftops.
//
// Nothing here is a second atmosphere: the colours come from skyTone()
// (core/atmosphere.ts), i.e. the same fog colour and the same SKY budget, and the
// backdrop is drawn inside the scene pass, so the grade, the dither and the
// quantizer treat the sky and the geometry identically.
import { NIGHT } from '../config/render.js';
import { skyTone } from '../core/atmosphere.js';
import * as THREE from 'three';

// The pass owns its quad and its own orthographic camera; the frame pipeline only
// ever needs the render call below.
interface SkyPass {
    // Draws the backdrop over the whole target and clears depth with it. The
    // caller has already bound the render target and left autoClear on.
    // `gradient` = false paints the flat horizon tone (night model switched off).
    render(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, gradient: boolean): void;
    dispose(): void;
}

const SKY_VERTEX = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// vUv.y = 0 at the bottom of the frame. t is the distance above the horizon in
// units of the gradient spread, so the band keeps its shape whatever the camera
// pitch; below the horizon the horizon tone simply continues (geometry covers
// that half anyway).
//
// uGradient = 0 collapses both tones into the horizon colour, which is exactly the
// flat backdrop the frame had before this pass existed: the diagnostic frame
// (key N / ?night=off) has to stay comparable with older captures.
const SKY_FRAGMENT = `
uniform vec3 uHorizon;
uniform vec3 uZenith;
uniform float uHorizonY;
uniform float uSpread;
uniform float uGradient;
varying vec2 vUv;

void main() {
    float t = clamp((vUv.y - uHorizonY) / max(uSpread, 0.001), 0.0, 1.0) * uGradient;
    gl_FragColor = vec4(mix(uHorizon, uZenith, smoothstep(0.0, 1.0, t)), 1.0);
}
`;

export function createSkyPass(): SkyPass {
    const horizon = skyTone();
    const zenith = horizon.clone().multiplyScalar(NIGHT.BACKDROP.ZENITH_GAIN);

    const uniforms = {
        uHorizon: { value: horizon },
        uZenith: { value: zenith },
        uHorizonY: { value: 0.5 },
        uSpread: { value: NIGHT.BACKDROP.HORIZON_SPREAD },
        uGradient: { value: 1 }
    };

    const material = new THREE.ShaderMaterial({
        vertexShader: SKY_VERTEX,
        fragmentShader: SKY_FRAGMENT,
        uniforms,
        depthTest: false,
        depthWrite: false
    });

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    scene.add(quad);

    const forward = new THREE.Vector3();

    // Screen height (0 = bottom, 1 = top) where a horizontal ray projects. A
    // perspective camera puts the horizon at ndc = -tan(pitch) / tan(fov / 2): the
    // sign is negative because a camera pitched DOWN by `pitch` (dir.y < 0) sees the
    // horizon ABOVE the frame, and vice versa. With the sign flipped, any top-down
    // pose (the isometric camera, the overview) would paint the whole frame with the
    // zenith tone instead of the haze the horizon carries.
    function horizonHeight(camera3: THREE.PerspectiveCamera): number {
        camera3.getWorldDirection(forward);
        const pitch = Math.atan2(forward.y, Math.hypot(forward.x, forward.z));
        const halfFov = THREE.MathUtils.degToRad(camera3.fov) / 2;
        const ndc = -Math.tan(pitch) / Math.tan(halfFov);
        return THREE.MathUtils.clamp(0.5 + ndc * 0.5, -0.5, 1.5);
    }

    return {
        render(renderer: THREE.WebGLRenderer, camera3: THREE.PerspectiveCamera, gradient: boolean): void {
            uniforms.uHorizonY.value = horizonHeight(camera3);
            uniforms.uGradient.value = gradient ? 1 : 0;
            // autoClear is on, so this pass clears colour and depth and then
            // paints the backdrop; the scene pass that follows draws over it
            // without a second clear.
            renderer.render(scene, camera);
        },
        dispose(): void {
            material.dispose();
            quad.geometry.dispose();
        }
    };
}
