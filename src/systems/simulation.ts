// Per-frame simulation entry point. Keeps the original update order:
// particles → exhaust → mode logic → transitions → pose → camera → heroine → atmosphere.
import { CAMERA, OVERVIEW } from '../config/render.js';
import { updateAtmosphere, type LampEmitter } from '../core/atmosphere.js';
import { computeFpBlend, updateCamera } from './cameraRig.js';
import { isMovementPressed } from './keyState.js';
import { updateMechMode } from './mechController.js';
import { updateExhaustEffects } from './mechEffects.js';
import { applyMechPose } from './mechPose.js';
import { updateModeTransitions } from './modeController.js';
import { updatePilotMode } from './pilotController.js';
import { updatePlayerPose } from './playerPose.js';
import { updateSearchlightCones, updateSearchlightEmitters } from './searchlight.js';
import { updateFlashlightEmitter } from './flashlight.js';
import type { PerspectiveCamera, Scene } from 'three';
import type { buildMech } from '../mech/mech.js';
import type { PlayerRig } from '../player/player.js';
import type { createDustSystem } from './dust.js';
import type { CollisionWorld } from './collision.js';
import type { InteriorRuntime } from './interiorController.js';
import type { ViewState } from '../state/viewState.js';
import type { MechState } from '../state/mechState.js';
import type { PilotState } from '../state/pilotState.js';
import type { InputState } from '../state/inputState.js';
import type { SurfaceField } from '../world/surfaceField.js';
import type { SnowTrackSystem } from '../world/snowTracks.js';

export interface SimulationContext {
    viewState: ViewState;
    mechState: MechState;
    pilotState: PilotState;
    inputState: InputState;
    mech: ReturnType<typeof buildMech>;
    // First-person heroine: body in world space, arms pinned to the camera.
    player: PlayerRig;
    collision: CollisionWorld;
    // Porch crossings and stair treads.
    interior: InteriorRuntime;
    surface: SurfaceField;
    snowTracks: SnowTrackSystem;
    dust: ReturnType<typeof createDustSystem>;
    camera: PerspectiveCamera;
    scene: Scene;
    // Static fixtures plus the walker's searchlight, packed into the shader every
    // frame. `searchlightEmitters` are the same two objects, kept apart so the
    // per-frame update does not have to slice the combined list.
    lamps: LampEmitter[];
    searchlightEmitters: LampEmitter[];
    flashlightEmitter: LampEmitter;
}

export function updateSimulation(dt: number, {
    viewState,
    mechState,
    pilotState,
    inputState,
    mech,
    player,
    collision,
    interior,
    surface,
    snowTracks,
    dust,
    camera,
    scene,
    lamps,
    searchlightEmitters,
    flashlightEmitter
}: SimulationContext): void {
    viewState.time += dt;
    dust.update(dt);
    snowTracks.update?.(dt);

    const isMechMoving = viewState.mode === 'MECH' && isMovementPressed(inputState.keys);

    updateExhaustEffects(dt, {
        viewState,
        mechState,
        dust,
        exhaustFlapPivot: mech.exhaustFlapPivot,
        isMechMoving
    });

    if (viewState.mode === 'MECH') {
        updateMechMode(dt, { viewState, mechState, inputState, collision, dust, snowTracks });
    }

    if (viewState.mode === 'FP') {
        updatePilotMode(dt, {
            viewState,
            mechState,
            pilotState,
            inputState,
            collision: interior.navigation,
            boardingLampMat: mech.boardingLampMat,
            snowTracks
        });
    }

    // After the walk, before the camera: the doorway swap, the floor under the
    // feet and the hint all describe where the pilot ended up this frame.
    interior.update(dt);

    updateModeTransitions(dt, { viewState, mechState });

    // Smoothly interpolate isometric camera yaw rotation
    viewState.isoYaw += (viewState.isoTargetYaw - viewState.isoYaw) * dt * CAMERA.YAW_INTERPOLATION;
    viewState.isoZoom += (viewState.isoTargetZoom - viewState.isoZoom) * dt * CAMERA.ZOOM_INTERPOLATION;
    if (Math.abs(viewState.isoTargetZoom - viewState.isoZoom) < 1e-3) {
        viewState.isoZoom = viewState.isoTargetZoom;
    }

    // The overview belongs to the diorama camera; leaving it for the pilot's eyes
    // always pulls the blend back to the gameplay pose.
    if (viewState.mode !== 'MECH') viewState.overview = false;
    const overviewTarget = viewState.overview ? 1 : 0;
    viewState.overviewBlend += (overviewTarget - viewState.overviewBlend) * dt * OVERVIEW.BLEND_RATE;
    if (Math.abs(overviewTarget - viewState.overviewBlend) < 1e-3) {
        viewState.overviewBlend = overviewTarget;
    }

    applyMechPose(mech, mechState, surface, viewState.time);
    updateSearchlightCones(mech.searchlight, computeFpBlend(viewState));
    updateCamera(camera, viewState, mechState, pilotState, scene);
    // After the camera: the arm assembly is pinned to the eye pose of this frame,
    // while the body follows the footing settled by the interior controller.
    updatePlayerPose(player, viewState, pilotState, camera);
    // The atmosphere is settled last: the camera rig has just written the fog
    // density for this frame and the searchlight has just moved with the hull, so
    // one upload carries the final state of both.
    updateSearchlightEmitters(mech.searchlight, searchlightEmitters);
    updateFlashlightEmitter(camera, viewState, flashlightEmitter);
    updateAtmosphere(dt, scene.fog, lamps);
}
