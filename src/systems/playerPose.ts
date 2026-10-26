// First-person pose of the heroine. The rig is built once (src/player/player.ts);
// this system is the only thing that moves it:
//
// - the body root stands on the pilot's floor x/z with the pilot's heading, and
//   its coat billows with the stride;
// - hips and knees carry the walk, the coat hem lags it; the chest is not drawn
//   in first person (see src/player/player.ts);
// - the arm assembly is pinned to the camera and then swung in camera space, so
//   the mittens stay in the same corner of the frame at every look angle.
//
// Reads state, writes transforms: no geometry and no input decisions live here.
import { PLAYER_ARM_POSE, PLAYER_BODY, PLAYER_GAIT, PLAYER_IDLE } from '../config/player.js';
import type { PlayerRig } from '../player/player.js';
import type { PerspectiveCamera } from 'three';
import type { PilotState } from '../state/pilotState.js';
import type { ViewState } from '../state/viewState.js';

export function updatePlayerPose(
    player: PlayerRig,
    viewState: ViewState,
    pilotState: PilotState,
    camera: PerspectiveCamera
): void {
    // The heroine exists only in the pilot's eyes: the diorama camera and the
    // cockpit transition must never show her standing in the yard.
    const visible = viewState.mode === 'FP';
    player.group.visible = visible;
    player.view.visible = visible;
    if (!visible) return;

    const gait = pilotState.gait;
    // `walkCycle` only advances while the pilot is actually walking, and gait
    // eases to zero after the keys are released, so the body settles into a
    // planted stance instead of freezing mid-step.
    const stride = Math.sin(pilotState.walkCycle) * gait;
    const stridePhase = pilotState.walkCycle;
    const breath = Math.sin(viewState.time * PLAYER_IDLE.BREATH_RATE);

    // Body root: feet on the stair tread / courtyard, two bobs per stride. The
    // body stands behind the eye line (see PLAYER_BODY), so the waist, the open
    // coat and the boots sit in the lower half of the look-down view; the bulky
    // chest itself is not drawn by the rig.
    const bob = Math.abs(Math.sin(stridePhase)) * PLAYER_GAIT.BOB * gait;
    const backX = Math.sin(pilotState.yaw) * PLAYER_BODY.BACK_OFFSET;
    const backZ = Math.cos(pilotState.yaw) * PLAYER_BODY.BACK_OFFSET;
    player.group.position.set(pilotState.x + backX, pilotState.y + bob, pilotState.z + backZ);
    player.group.rotation.set(
        0,
        pilotState.yaw + Math.PI,
        Math.sin(stridePhase) * PLAYER_GAIT.BODY_SWAY * gait
    );

    // Hips swing the whole leg under the coat; the knee folds over the forward
    // half of the swing, which is the only part of the stride the hem reveals.
    player.hips[0].rotation.x = -stride * PLAYER_GAIT.LEG_SWING;
    player.hips[1].rotation.x = stride * PLAYER_GAIT.LEG_SWING;
    player.knees[0].rotation.x = Math.max(0, Math.cos(stridePhase)) * PLAYER_GAIT.KNEE_BEND * gait;
    player.knees[1].rotation.x = Math.max(0, -Math.cos(stridePhase)) * PLAYER_GAIT.KNEE_BEND * gait;

    // Coat skirt and chest: the hem lags the stride, the shoulders counter-rotate
    // against the hips, and the breath lifts the torso by a millimetre. The chest
    // leans after the look a few degrees, never the full pitch.
    player.skirt.rotation.x = -stride * PLAYER_GAIT.SKIRT_SWAY;
    player.skirt.rotation.z = Math.sin(stridePhase) * PLAYER_GAIT.BODY_SWAY * gait;
    player.torso.position.y = player.torsoBaseY + breath * PLAYER_IDLE.BREATH_LIFT;
    player.torso.rotation.x = breath * PLAYER_IDLE.BREATH_TILT - pilotState.pitch * PLAYER_IDLE.LOOK_LEAN;
    player.torso.rotation.y = -stride * PLAYER_GAIT.TORSO_YAW;
    player.torso.rotation.z = Math.sin(stridePhase) * PLAYER_GAIT.BODY_SWAY * 0.5 * gait;

    // The arms are a child of the camera for this frame. The camera has already
    // been placed by systems/cameraRig.ts, so copying its pose is enough.
    player.view.position.copy(camera.position);
    player.view.position.y += Math.sin(stridePhase * 2) * PLAYER_ARM_POSE.BOB * gait;
    player.view.quaternion.copy(camera.quaternion);

    for (let index = 0; index < player.shoulders.length; index++) {
        // index 0 is the model's -X side; the pair mirrors around the chest.
        const side = index === 0 ? -1 : 1;
        const swing = Math.sin(stridePhase) * gait * side;
        player.shoulders[index].rotation.set(
            PLAYER_ARM_POSE.SHOULDER_PITCH + swing * PLAYER_ARM_POSE.SWING + breath * PLAYER_IDLE.ARM_BREATH,
            side * PLAYER_ARM_POSE.SHOULDER_YAW,
            side * PLAYER_ARM_POSE.SHOULDER_SPREAD
        );
        player.elbows[index].rotation.set(
            PLAYER_ARM_POSE.ELBOW_PITCH + swing * PLAYER_ARM_POSE.ELBOW_SWING,
            0,
            side * PLAYER_ARM_POSE.ELBOW_ROLL
        );
        player.mittens[index].rotation.y = -side * PLAYER_ARM_POSE.MITTEN_YAW;
    }
}
