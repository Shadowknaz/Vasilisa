// Blends the isometric diorama camera, the far overview of the whole island and
// the pilot's first-person camera, and drives the fog presets that go with them.
import { CAMERA, FOG, OVERVIEW } from '../config/render.js';
import { DIORAMA } from '../config/world.js';
import { RENDER_FLAGS } from '../core/renderFlags.js';
import type { ViewState } from '../state/viewState.js';
import type { MechState } from '../state/mechState.js';
import type { PilotState } from '../state/pilotState.js';
import * as THREE from 'three';

const isoCamPos = new THREE.Vector3();
const isoLookTarget = new THREE.Vector3();
const overviewCamPos = new THREE.Vector3();
const overviewLookTarget = new THREE.Vector3();
const stageCamPos = new THREE.Vector3();
const stageLookTarget = new THREE.Vector3();
const fpCamPos = new THREE.Vector3();
const fpLookTarget = new THREE.Vector3();
const blendedLook = new THREE.Vector3();

// Discarded camera used only to measure the overview fit: the solver iterates it
// so the real camera keeps whatever pose the blend of this frame needs.
const probeCamera = new THREE.PerspectiveCamera(OVERVIEW.FOV, 1, CAMERA.NEAR, CAMERA.FAR);
const probeTarget = new THREE.Vector3(0, OVERVIEW.LOOK_HEIGHT, 0);
const probeCorner = new THREE.Vector3();

let solvedDistance: number = OVERVIEW.MAX_DISTANCE;
let solvedAspect = 0;
let solvedYaw = Number.NaN;

// From the pedestal bottom to the rooftop ridge: the overview must show the whole
// diorama, never a cropped corner (TZ §11.3).
function buildSlabCorners(): THREE.Vector3[] {
    const half = DIORAMA.SIZE / 2;
    const corners: THREE.Vector3[] = [];
    [-half, half].forEach((x) => {
        [-DIORAMA.DEPTH, OVERVIEW.TOP_HEIGHT].forEach((y) => {
            [-half, half].forEach((z) => corners.push(new THREE.Vector3(x, y, z)));
        });
    });
    return corners;
}

const SLAB_CORNERS = buildSlabCorners();

function placeProbeCamera(aspect: number, yaw: number, distance: number): void {
    const cosPitch = Math.cos(OVERVIEW.PITCH);
    probeCamera.aspect = aspect;
    probeCamera.far = Math.max(CAMERA.FAR, distance * OVERVIEW.FAR_RATIO);
    probeCamera.position.set(
        Math.sin(yaw) * cosPitch * distance,
        OVERVIEW.LOOK_HEIGHT + Math.sin(OVERVIEW.PITCH) * distance,
        Math.cos(yaw) * cosPitch * distance
    );
    probeCamera.lookAt(probeTarget);
    probeCamera.updateProjectionMatrix();
    probeCamera.updateMatrixWorld(true);
}

function fitsInFrame(limit: number): boolean {
    for (let index = 0; index < SLAB_CORNERS.length; index += 1) {
        probeCorner.copy(SLAB_CORNERS[index]).project(probeCamera);
        if (probeCorner.z < -1 || probeCorner.z > 1) return false;
        if (Math.abs(probeCorner.x) > limit || Math.abs(probeCorner.y) > limit) return false;
    }
    return true;
}

// Retreats along the orbit until the slab plus its rooftops fits the frame with
// OVERVIEW.MARGIN to spare. Cached per yaw/aspect pair: the pose only changes on
// an orbit rotation or a resize, never per frame.
function solveOverviewDistance(camera: THREE.PerspectiveCamera, yaw: number): number {
    if (Math.abs(yaw - solvedYaw) < 1e-4 && Math.abs(camera.aspect - solvedAspect) < 1e-4) {
        return solvedDistance;
    }

    const limit = 1 - OVERVIEW.MARGIN;
    let distance: number = OVERVIEW.MAX_DISTANCE;
    for (let probe: number = OVERVIEW.MIN_DISTANCE; probe <= OVERVIEW.MAX_DISTANCE; probe += OVERVIEW.STEP) {
        placeProbeCamera(camera.aspect, yaw, probe);
        if (fitsInFrame(limit)) {
            distance = probe;
            break;
        }
    }

    solvedYaw = yaw;
    solvedAspect = camera.aspect;
    solvedDistance = distance;
    return distance;
}

function smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
}

export function computeFpBlend(viewState: ViewState): number {
    if (viewState.mode === 'FP') return 1;
    if (viewState.mode === 'TRANSITION_TO_FP') return smoothstep(viewState.transitionProgress);
    if (viewState.mode === 'TRANSITION_TO_MECH') return smoothstep(1 - viewState.transitionProgress);
    return 0;
}

// One density per camera mode, blended into the single FogExp2 instance of the
// scene: the courtyard keeps a snow haze, the overview sees the whole island
// recede instead of lightening, and the pilot's own eyes get the thinnest veil.
// The custom shaders read the settled density, so geometry and snow can never
// fade differently.
function applyFog(scene: THREE.Scene | null, overviewBlend: number, fpBlend: number): void {
    const fog = scene ? scene.fog : null;
    if (!(fog instanceof THREE.FogExp2)) return;

    const stageDensity = FOG.DENSITY.GAME + (FOG.DENSITY.OVERVIEW - FOG.DENSITY.GAME) * overviewBlend;
    // The haze belongs to the night model: with the night switched off (key N), the
    // diagnostic frame has to show the geometry, not the weather.
    const fogOn = RENDER_FLAGS.fog && RENDER_FLAGS.night;
    fog.density = fogOn ? stageDensity + (FOG.DENSITY.FP - stageDensity) * fpBlend : 0;
}

export function updateCamera(camera: THREE.PerspectiveCamera, viewState: ViewState, mechState: MechState, pilotState: PilotState, scene: THREE.Scene | null = null): void {
    const overviewBlend = viewState.overviewBlend;

    // Isometric diorama pose (narrow FOV at high distance for a true isometric look)
    isoLookTarget.set(
        mechState.x * CAMERA.ISO_FOLLOW_RATIO,
        CAMERA.ISO_LOOK_HEIGHT,
        mechState.z * CAMERA.ISO_FOLLOW_RATIO
    );
    isoCamPos.set(
        isoLookTarget.x + Math.sin(viewState.isoYaw) * CAMERA.ISO_DISTANCE * viewState.isoZoom,
        isoLookTarget.y + (CAMERA.ISO_HEIGHT - CAMERA.ISO_LOOK_HEIGHT) * viewState.isoZoom,
        isoLookTarget.z + Math.cos(viewState.isoYaw) * CAMERA.ISO_DISTANCE * viewState.isoZoom
    );

    // Overview of the whole island: same orbit yaw, steeper pitch, solved distance
    const overviewDistance = solveOverviewDistance(camera, viewState.isoYaw);
    const overviewCosPitch = Math.cos(OVERVIEW.PITCH);
    overviewLookTarget.set(0, OVERVIEW.LOOK_HEIGHT, 0);
    overviewCamPos.set(
        Math.sin(viewState.isoYaw) * overviewCosPitch * overviewDistance,
        OVERVIEW.LOOK_HEIGHT + Math.sin(OVERVIEW.PITCH) * overviewDistance,
        Math.cos(viewState.isoYaw) * overviewCosPitch * overviewDistance
    );

    // Pilot first-person pose with head bob. `pilotState.y` is the floor under
    // his feet: 0 in the courtyard, the porch step, or a stair tread indoors.
    const headBob = viewState.mode === 'FP'
        ? Math.sin(pilotState.walkCycle) * CAMERA.FP_HEAD_BOB
        : 0;
    fpCamPos.set(pilotState.x, pilotState.y + CAMERA.FP_EYE_HEIGHT + headBob, pilotState.z);

    const lookDirX = -Math.sin(pilotState.yaw) * Math.cos(pilotState.pitch);
    const lookDirY = Math.sin(pilotState.pitch);
    const lookDirZ = -Math.cos(pilotState.yaw) * Math.cos(pilotState.pitch);
    fpLookTarget.set(
        fpCamPos.x + lookDirX * CAMERA.FP_LOOK_DISTANCE,
        fpCamPos.y + lookDirY * CAMERA.FP_LOOK_DISTANCE,
        fpCamPos.z + lookDirZ * CAMERA.FP_LOOK_DISTANCE
    );

    const fpBlend = computeFpBlend(viewState);

    // Diorama → overview → first person, so the O key never fights a transition
    stageCamPos.lerpVectors(isoCamPos, overviewCamPos, overviewBlend);
    stageLookTarget.lerpVectors(isoLookTarget, overviewLookTarget, overviewBlend);

    camera.position.lerpVectors(stageCamPos, fpCamPos, fpBlend);
    blendedLook.lerpVectors(stageLookTarget, fpLookTarget, fpBlend);
    camera.lookAt(blendedLook);

    // Narrow isometric FOV widens for the overview, then to the human FOV
    const stageFov = CAMERA.ISO_FOV + overviewBlend * (OVERVIEW.FOV - CAMERA.ISO_FOV);
    const targetFov = stageFov + fpBlend * (CAMERA.FP_FOV - stageFov);
    // The overview retreats past the gameplay far plane: extend it with the blend
    // so the far corner of the slab stays inside the depth range.
    const overviewFar = Math.max(CAMERA.FAR, overviewDistance * OVERVIEW.FAR_RATIO);
    const targetFar = CAMERA.FAR + (overviewFar - CAMERA.FAR) * overviewBlend;

    // In isometric and overview poses the diorama is >50m away; raising the near
    // plane from 0.2m to 2.5m multiplies depth buffer precision by >12x, eliminating
    // Z-fighting on close overlays (stains, window trims, curbs). FP mode smoothly blends down to 0.2m.
    const isoNear = 2.5;
    const targetNear = CAMERA.NEAR + (1 - fpBlend) * (isoNear - CAMERA.NEAR);

    if (
        Math.abs(camera.fov - targetFov) > 1e-4 ||
        Math.abs(camera.far - targetFar) > 1e-4 ||
        Math.abs(camera.near - targetNear) > 1e-4
    ) {
        camera.fov = targetFov;
        camera.far = targetFar;
        camera.near = targetNear;
        camera.updateProjectionMatrix();
    }

    applyFog(scene, overviewBlend, fpBlend);
}
