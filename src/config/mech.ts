// Values shared between the mech builder, the pose animator and the simulation:
// suspension pivots, gait amplitudes, hatch/ladder travel and the exhaust emitter.
// The walker's legs mount to the root, so the hull pivots on its struts while the
// feet stay planted — every amplitude below is read by systems/mechPose.ts.

// Uniform enlargement of the reference walker. The rig is scaled once at the
// composition root, so every part keeps its proportions; the values below that are
// consumed OUTSIDE that scaled group (exhaust emitter, contact points) carry it
// explicitly, and so do the gameplay radii in config/controls.ts.
// Preserve the 1.25 reference scale and enlarge the mech itself by 40%.
const SIZE_FACTOR = 1.4;
const SCALE = 1.25 * SIZE_FACTOR;

export const MECH_RIG = {
    SCALE,
    SIZE_FACTOR,
    // Height of the hull suspension pivot above the ground (rig-local).
    HULL_HEIGHT: 2.28,
    BOB_AMPLITUDE: 0.07,
    TORSO_SWAY: 0.038,
    PITCH_SWAY: 0.024,
    // Diesel idle shake: two incommensurate frequencies keep it from reading as a loop.
    ENGINE_HUM: { LOW_FREQUENCY: 26, LOW_AMPLITUDE: 0.006, HIGH_FREQUENCY: 41, HIGH_AMPLITUDE: 0.004 },
    // The parked walker sits down on its struts instead of folding the legs, so no
    // foot ever leaves the pavement during a boarding transition.
    CROUCH_DROP: 0.34,
    CROUCH_TILT: 0.12,
    // Armored flank door: rests ajar, swings outward and rattles with each step.
    HATCH_CLOSED_YAW: -0.12,
    HATCH_OPEN_ANGLE: 1.1,
    HATCH_RATTLE: 0.035,
    LADDER_DEPLOY_ANGLE: 0.95,
    // Gait amplitudes: hip yaw carries the stride, thigh/knee fold the leg in the
    // frontal plane, the foot counter-rotates to stay level.
    LEG_SWING: 0.2,
    THIGH_LIFT: 0.36,
    KNEE_LIFT: 0.26,
    FOOT_LIFT: 0.1,
    FOOT_PITCH: 0.08,
    STANCE_WIDEN: 0.16,
    KNEE_CROUCH: 0.12,
    // Mechanical flourishes from the reference model.
    RADAR_SWEEP_RATE: 1.2,
    RADAR_SWEEP_STEPS: 12,
    ANTENNA_SWAY: 0.1,
    ANTENNA_ROLL: 0.07,
    // World-space exhaust emitter (rig-local values above are already scaled by
    // the rig itself; this one is read by systems/mechEffects.ts).
    EXHAUST_TIP: { x: -0.46 * SCALE, y: 4.4 * SCALE, z: -0.68 * SCALE }
} as const;
