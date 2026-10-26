// Own near plane for the first-person arms.
//
// The heroine's arms are a viewmodel: systems/playerPose.ts pins them to the eye
// pose every frame, so their polygons start at the eye plane and are the only
// geometry in the scene that can come within centimetres of the camera. Drawn
// with the world camera they would be clipped by CAMERA.NEAR (0.2 m) — the plane
// that gives the 400 m diorama its depth precision — and a clipped sleeve is a
// hole: the pilot looks straight into her own arm and sees the sky through it.
//
// The fix is the one every first-person game uses: a second pass with its own
// near plane. The arms live on VIEWMODEL_LAYER, the world camera does not see
// that layer (three skips it while traversing), and the pass renders the same
// scene with a camera that copies the eye pose but starts 2 cm in front of it.
// Depth is cleared between the passes, so the arms always draw over the world —
// which is exactly where a viewmodel belongs — and the world keeps its depth
// precision untouched.
//
// Nothing here knows about the player rig: the caller tags the arms
// (markViewmodel) and passes the returned camera to frameRender.
import { PLAYER_VIEW } from '../config/player.js';
import { CAMERA } from '../config/render.js';
import * as THREE from 'three';

const VIEWMODEL_LAYER = 1;

export function createViewmodelCamera(): THREE.PerspectiveCamera {
    const camera = new THREE.PerspectiveCamera(
        CAMERA.FP_FOV,
        CAMERA.INITIAL_ASPECT,
        PLAYER_VIEW.NEAR,
        PLAYER_VIEW.FAR
    );
    // The world pass must not see the arms through this camera and this pass must
    // not see the world: one layer each, no per-object visibility bookkeeping.
    camera.layers.set(VIEWMODEL_LAYER);
    return camera;
}

// Puts a rig subtree on the viewmodel layer. Meshes are what the renderer tests,
// but the whole subtree is tagged so a node added later cannot silently land on
// the world layer.
export function markViewmodel(root: THREE.Object3D): void {
    root.traverse((object) => object.layers.set(VIEWMODEL_LAYER));
}

// Copies the eye pose of the frame. The projection follows the world camera
// except for the near plane, so a vertex projects to the same pixel in both
// passes and the PS1 snap grid stays where the world pass put it.
export function syncViewmodelCamera(
    camera: THREE.PerspectiveCamera,
    viewmodelCamera: THREE.PerspectiveCamera
): void {
    viewmodelCamera.position.copy(camera.position);
    viewmodelCamera.quaternion.copy(camera.quaternion);
    if (viewmodelCamera.fov !== camera.fov || viewmodelCamera.aspect !== camera.aspect) {
        viewmodelCamera.fov = camera.fov;
        viewmodelCamera.aspect = camera.aspect;
        viewmodelCamera.updateProjectionMatrix();
    }
}
