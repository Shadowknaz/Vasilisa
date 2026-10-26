// Values shared between the heroine rig and the first-person pose animator.
//
// The rig itself is built in metres in src/player/*: the felt boots stand on
// y = 0 and the collar sits at 1.4 m before the PLAYER_RIG.SCALE is applied at
// the composition root. At 0.67 the heroine is ~1.28 m tall with the helmet (an 11-year-old child),
// and the 1.18 m eye height of the pilot line matches her eyes. The head is built
// but hidden from the first-person camera: the eye line falls inside the skull, so
// the helmet would paint over the whole frame.
//
// Everything below is read by systems/playerPose.ts only. The pose angles of the
// camera-anchored arms are tuning, not anatomy: the mittens have to enter the
// bottom of the 72° frame, so the forearms are raised past a natural rest pose.

export const PLAYER_RIG = {
    // Uniform scale of the heroine. The reference is 1.92 m with the helmet.
    // Vasilisa is an 11-year-old girl (~1.28 m tall with helmet and boots, eye line ~1.18 m).
    // Scaling by 0.67 enlarges all buildings, rooms and courtyard objects by ~35%
    // relative to her, making Khrushchyovka interiors and doors feel spacious and natural.
    SCALE: 0.67
} as const;

export const PLAYER_GAIT = {
    // Hip swing and knee fold of one stride. The in/out blend itself lives in
    // PILOT_CONTROL (config/controls.ts) next to the walk speeds, and is written
    // into pilotState.gait by systems/pilotController.ts.
    LEG_SWING: 0.5,
    KNEE_BEND: 0.42,
    // Two bobs per stride, plus the roll of the hips, the chest counter-turn and
    // the hem lag. Scaled for an 11-year-old child's lighter stride.
    BOB: 0.016,
    BODY_SWAY: 0.022,
    TORSO_YAW: 0.045,
    SKIRT_SWAY: 0.04
} as const;

// The camera sits at the front of the head, not in the middle of the chest: the
// body stands this far behind the pilot's collision point. The coat skirt, waist
// and legs then sit in the lower half of the look-down view instead of under the
// eye, and the arms (which stay on the camera) keep a believable gap from the
// shoulders. The bulky chest itself is not drawn in first person — see
// src/player/player.ts.
//
// The value is the eye-to-coat margin: the top rim of the skirt reaches 0.154 m
// in front of the body axis (COAT.SKIRT.TOP_RADIUS x PLAYER_RIG.SCALE), so at
// 0.34 the rim stays ~0.186 m behind the eye even at the end of a stride.
export const PLAYER_BODY = {
    BACK_OFFSET: 0.34
} as const;

// The arms are a viewmodel, not a body part: they are pinned to the camera and
// start at the eye plane, so their polygons are the only geometry in the scene
// that can reach the camera. They are therefore drawn in their own pass with the
// near plane below (src/render/viewmodel.ts): the world keeps CAMERA.NEAR (0.2 m,
// which is the depth precision of a 400 m diorama), while a sleeve can never be
// sliced open by it and show its interior.
//
// FORWARD/DROP move the arm root away from the eye, which is the "camera step
// back" of the reference: the sleeves leave the near field, the mittens shrink a
// little and sit on the bottom edge of the 72° frame instead of floating in it.
export const PLAYER_VIEW = {
    NEAR: 0.02,
    // The arms live in the first metre of the frame; a short far plane keeps the
    // pass from ever culling a sleeve the way the 400 m world plane would not.
    FAR: 4,
    FORWARD: 0.075,
    DROP: 0.03
} as const;

export const PLAYER_IDLE = {
    BREATH_RATE: 1.9,
    BREATH_TILT: 0.02,
    BREATH_LIFT: 0.006,
    // The chest leans after the look: a few degrees, never the full pitch, or the
    // coat swallows the raised mittens.
    LOOK_LEAN: 0.12,
    ARM_BREATH: 0.022
} as const;

export const PLAYER_ARM_POSE = {
    // Upper arm raised toward the horizon and the forearm folded up: at these
    // angles the cuffs and mittens sit at the bottom edge of the FP frame.
    SHOULDER_PITCH: -1.70,
    ELBOW_PITCH: -0.22,
    // Hands spread and turned slightly inward, as if holding the pack straps.
    SHOULDER_SPREAD: 0.04,
    SHOULDER_YAW: 0.08,
    ELBOW_ROLL: 0.10,
    MITTEN_YAW: 0.18,
    // Gait swing of the arm pair, opposite to the legs.
    SWING: 0.12,
    ELBOW_SWING: 0.06,
    BOB: 0.014
} as const;
