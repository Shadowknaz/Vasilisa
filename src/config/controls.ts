// Gameplay tuning: speeds, radii, mouse look, boarding rules, mode flow,
// mech effects and dust particles.
import { MECH_RIG } from './mech.js';

export const ISO_VIEW = {
    START_YAW: Math.PI * 0.25,
    ROTATION_STEP: Math.PI * 0.25,
    ZOOM_MIN: 0.55,
    ZOOM_MAX: 1.55,
    ZOOM_SENSITIVITY: 0.0015
} as const;

export const MECH_CONTROL = {
    // Spawn of the validated plan: SPAWN circle centre, yaw 0 (facing -Z).
    START_X: 0,
    START_Z: 14,
    START_YAW: 0,
    MOVE_SPEED: 4.3,
    TURN_RATE: 3.8,
    WALK_CYCLE_RATE: 5.6,
    // Gait blend in/out: the stride and the leg lift scale with it, so releasing
    // the keys eases the walker into a planted stance instead of freezing mid-step.
    GAIT_RATE_IN: 5,
    GAIT_RATE_OUT: 3.2,
    // Radii and contact points follow the rig scale: the pads sit at 1.19 m and
    // reach 1.62 m with the sole, so the collider keeps its old margin.
    COLLIDER_RADIUS: 1.75 * MECH_RIG.SCALE,
    STEP_QUARTER_TURN: Math.PI / 2,
    STEP_COUNT: 4,
    // Contact points of the four pads under the hull (src/mech/legs.ts).
    STEP_FOOT_OFFSET_X: 1.19 * MECH_RIG.SCALE,
    STEP_FOOT_OFFSET_Z: 0.6 * MECH_RIG.SCALE,
    STEP_DUST_HEIGHT: 0.18,
    STEP_DUST_SCALE: 1.2
} as const;

export const PILOT_CONTROL = {
    // Validated ladder exit point of the spawn: BOARDING.EXIT_DISTANCE along the
    // Mech's forward axis, standing in front of the walker.
    START: {
        X: 0,
        Y: 0,
        Z: 17.15,
        YAW: 0,
        PITCH: 0.08
    },
    WALK_SPEED: 3.2,
    RUN_SPEED: 5.0,
    WALK_CYCLE_RATE: 8.2,
    RUN_CYCLE_RATE: 11.5,
    // The stride blend of the first-person heroine: the same in/out idea as the
    // walker's gait, so releasing the keys ends the step instead of freezing it.
    GAIT_RATE_IN: 6,
    GAIT_RATE_OUT: 4.5,
    // 0.31 m cylinder matches an 11-year-old child's shoulder width (~0.62 m) and
    // allows smooth navigation through interior doors (1.10–1.20 m) and corridors (1.5 m).
    COLLIDER_RADIUS: 0.31,
    // The pilot keeps clear of the splayed pads, which grow with the rig.
    MECH_CLEARANCE: 2.05 * MECH_RIG.SCALE
} as const;

export const MOUSE_LOOK = {
    POINTER_LOCK_SENSITIVITY: 0.0026,
    DRAG_SENSITIVITY: 0.0042,
    ISO_DRAG_SENSITIVITY: 0.005,
    TOUCH_SENSITIVITY: 0.005,
    TOUCH_ISO_SENSITIVITY: 0.006,
    PITCH_LIMIT: 1.35,
    TOUCH_PITCH_LIMIT: 1.2
} as const;

export const BOARDING = {
    RADIUS: 3.85 * MECH_RIG.SIZE_FACTOR,
    // Local offset of the flank door on the hull (-X flank, src/mech/mechDoor.ts).
    HATCH_LOCAL: { x: -1.0 * MECH_RIG.SCALE, z: 0.0 },
    HATCH_REACH: 2.5 * MECH_RIG.SIZE_FACTOR,
    // The exit point and probe must move with the enlarged hull, otherwise
    // the pilot is placed back inside the walker's silhouette.
    EXIT_DISTANCE: 3.15 * MECH_RIG.SIZE_FACTOR,
    EXIT_CLEARANCE: 0.45,
    // The pilot must be able to take one step away from the hatch, otherwise the
    // exit is a wedge between two props rather than a way out.
    STEP_AWAY_PROBE: 1.2 * MECH_RIG.SIZE_FACTOR,
    // The pilot lands facing the hatch (yaw 0 looks back along the exit axis);
    // the offset keeps the walker's towering silhouette slightly off-centre.
    EXIT_YAW_OFFSET: 0.15,
    EXIT_PITCH: 0.16
} as const;

export const MODE_FLOW = {
    TRANSITION_RATE: 1.45,
    HATCH_RATE: 2.5,
    HATCH_FOLLOW: 1.3,
    CROUCH_FOLLOW: 1.2,
    LAMP_PULSE_RATE: 9
} as const;

export const MECH_EFFECTS = {
    FLAP_BASE_ANGLE: -0.22,
    FLAP_FREQUENCY_MOVING: 24,
    FLAP_FREQUENCY_IDLE: 11,
    FLAP_AMPLITUDE_MOVING: 0.55,
    FLAP_AMPLITUDE_IDLE: 0.22,
    // Denser smoke: higher spawn rates so the plume reads as a continuous column
    // and not as isolated puffs popping into the air.
    SMOKE_RATE_MOVING: 22.0,
    SMOKE_RATE_IDLE: 9.0,
    SMOKE_SCALE_MOVING: 1.4,
    SMOKE_SCALE_IDLE: 1.0
} as const;

export const DUST = {
    SIZE: 0.3,
    SPREAD: 0.35,
    RISE_MIN: 0.5,
    RISE_RANDOM: 0.45,
    // Longer lifetime gives the cloud time to expand and fade instead of
    // vanishing abruptly.
    LIFETIME: 1.4,
    GROWTH: 2.8
} as const;
