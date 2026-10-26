// Applies the walker's gait, hull suspension, door/ladder travel and the
// mechanical flourishes to the rig, then places the searchlight's ground pool in
// world space. The pool is deliberately outside the rig: its pivot follows the
// walker's x/z and yaw only, so the gait can never tilt it off the pavement.
import { MECH_RIG } from '../config/mech.js';
import { GROUND_OVERLAY } from '../config/render.js';
import type { MechRig } from '../mech/mech.js';
import type { QuadLeg } from '../mech/legs.js';
import type { MechState } from '../state/mechState.js';
import type { SurfaceField } from '../world/surfaceField.js';
import type { Rect } from '../world/layout/rect.js';

const TWO_PI = Math.PI * 2;

// Lateral-sequence ripple of the reference model: FL → RR → FR → RL a quarter
// cycle apart. With the sinusoid lift this keeps a diagonal pair in the air at any
// moment, which reads as a heavy trot rather than a four-beat crawl.
const GAIT_PHASE = { fl: 0, rr: 0.25, fr: 0.5, rl: 0.75 } as const;

// Thigh and knee fold lift the pad; the foot counter-rotates by the sum so the
// sole stays parallel to the ground for the whole stride.
const PAD_COUNTER = MECH_RIG.THIGH_LIFT - MECH_RIG.KNEE_LIFT - MECH_RIG.FOOT_LIFT;

const footprint: Rect = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };

function animateLeg(leg: QuadLeg, phase: number, gait: number, crouch: number): void {
    const swing = Math.sin(phase) * gait;
    const lift = Math.max(0, Math.cos(phase)) * gait;

    // Horizontal hip yaw carries the stride; the parked stance widens instead.
    leg.hipYaw.rotation.y = leg.baseYaw + leg.sideX * swing * MECH_RIG.LEG_SWING + leg.sideX * crouch * MECH_RIG.STANCE_WIDEN;
    // Frontal-plane fold: thigh swings out, knee folds back under the drum.
    leg.thighPivot.rotation.z = leg.sideX * lift * MECH_RIG.THIGH_LIFT;
    leg.kneePivot.rotation.z = -leg.sideX * (lift * MECH_RIG.KNEE_LIFT + crouch * MECH_RIG.KNEE_CROUCH);
    leg.footPivot.rotation.z = leg.sideX * (lift * PAD_COUNTER + crouch * MECH_RIG.KNEE_CROUCH);
    leg.footPivot.rotation.x = swing * MECH_RIG.FOOT_PITCH;
}

let lastPoolX = Number.NaN;
let lastPoolZ = Number.NaN;
let lastPoolYaw = Number.NaN;
let cachedPoolY = 0;
let cachedHalfWidth = 0;
let cachedHalfDepth = 0;
let cachedGeometry: THREE.BufferGeometry | null = null;
let boundsComputed = false;

// The pool is a rectangular additive plate: its pivot carries the mech yaw and
// its world footprint spans both rotated half-axes.
function placeLightPool(mech: MechRig, mechState: MechState, surface: SurfaceField): void {
    const pivot = mech.ground.pool;
    const pool = mech.searchlight.groundLightPool;
    pivot.position.set(mechState.x, 0, mechState.z);
    pivot.rotation.y = mechState.yaw;

    if (!boundsComputed || pool.geometry !== cachedGeometry) {
        if (!pool.geometry.boundingBox) pool.geometry.computeBoundingBox();
        const bounds = pool.geometry.boundingBox;
        cachedHalfWidth = bounds ? (bounds.max.x - bounds.min.x) / 2 : 0;
        cachedHalfDepth = bounds ? (bounds.max.y - bounds.min.y) / 2 : 0;
        cachedGeometry = pool.geometry;
        boundsComputed = true;
    }

    if (
        Math.abs(mechState.x - lastPoolX) < 1e-4 &&
        Math.abs(mechState.z - lastPoolZ) < 1e-4 &&
        Math.abs(mechState.yaw - lastPoolYaw) < 1e-4
    ) {
        pool.position.y = cachedPoolY;
        return;
    }

    const cos = Math.cos(mechState.yaw);
    const sin = Math.sin(mechState.yaw);
    const centerX = mechState.x + pool.position.x * cos + pool.position.z * sin;
    const centerZ = mechState.z - pool.position.x * sin + pool.position.z * cos;

    footprint.minX = centerX - (Math.abs(cachedHalfWidth * cos) + Math.abs(cachedHalfDepth * sin));
    footprint.maxX = centerX + (Math.abs(cachedHalfWidth * cos) + Math.abs(cachedHalfDepth * sin));
    footprint.minZ = centerZ - (Math.abs(cachedHalfWidth * sin) + Math.abs(cachedHalfDepth * cos));
    footprint.maxZ = centerZ + (Math.abs(cachedHalfWidth * sin) + Math.abs(cachedHalfDepth * cos));

    // The pivot sits at y = 0 with a yaw-only rotation, so its local Y is world Y.
    cachedPoolY = surface.maxHeightInRect(footprint) + GROUND_OVERLAY.GAP;
    pool.position.y = cachedPoolY;

    lastPoolX = mechState.x;
    lastPoolZ = mechState.z;
    lastPoolYaw = mechState.yaw;
}

export function applyMechPose(mech: MechRig, mechState: MechState, surface: SurfaceField, time: number): void {
    mech.group.position.set(mechState.x, 0, mechState.z);
    mech.group.rotation.y = mechState.yaw;

    const gait = mechState.gait;
    const hum =
        Math.sin(time * MECH_RIG.ENGINE_HUM.LOW_FREQUENCY) * MECH_RIG.ENGINE_HUM.LOW_AMPLITUDE +
        Math.cos(time * MECH_RIG.ENGINE_HUM.HIGH_FREQUENCY) * MECH_RIG.ENGINE_HUM.HIGH_AMPLITUDE;

    // Hull suspension: two impacts per stride, plus the diesel idle shake.
    const bob = Math.abs(Math.sin(mechState.walkCycle)) * MECH_RIG.BOB_AMPLITUDE * gait;
    mech.hullPivot.position.y =
        MECH_RIG.HULL_HEIGHT + bob - mechState.crouch * MECH_RIG.CROUCH_DROP + hum;
    mech.hullPivot.rotation.z = Math.sin(mechState.walkCycle) * MECH_RIG.TORSO_SWAY * gait + hum * 0.3;
    mech.hullPivot.rotation.x =
        Math.cos(mechState.walkCycle * 2) * MECH_RIG.PITCH_SWAY * gait + mechState.crouch * MECH_RIG.CROUCH_TILT;

    // Armored flank door: rests ajar, swings outward for the pilot, rattles on
    // each planted step while the pilot is still inside.
    const rattle = Math.abs(Math.sin(mechState.walkCycle)) * MECH_RIG.HATCH_RATTLE * gait * (1 - mechState.hatchOpen);
    mech.hatchPivot.rotation.y =
        MECH_RIG.HATCH_CLOSED_YAW - mechState.hatchOpen * MECH_RIG.HATCH_OPEN_ANGLE - rattle + hum * 0.8;
    mech.ladderPivot.rotation.z = -mechState.hatchOpen * MECH_RIG.LADDER_DEPLOY_ANGLE;

    // Telemetry loop sweeps in discrete hydraulic ticks; the Sputnik whips sway
    // with the stride and the engine.
    mech.radarPivot.rotation.y =
        Math.floor(time * MECH_RIG.RADAR_SWEEP_RATE * MECH_RIG.RADAR_SWEEP_STEPS) / MECH_RIG.RADAR_SWEEP_STEPS;
    mech.antennaPivot.rotation.x = Math.sin(mechState.walkCycle * 2) * MECH_RIG.ANTENNA_SWAY * gait + hum * 3.5;
    mech.antennaPivot.rotation.z = Math.cos(mechState.walkCycle) * MECH_RIG.ANTENNA_ROLL * gait;

    animateLeg(mech.legs.fl, mechState.walkCycle + GAIT_PHASE.fl * TWO_PI, gait, mechState.crouch);
    animateLeg(mech.legs.rr, mechState.walkCycle + GAIT_PHASE.rr * TWO_PI, gait, mechState.crouch);
    animateLeg(mech.legs.fr, mechState.walkCycle + GAIT_PHASE.fr * TWO_PI, gait, mechState.crouch);
    animateLeg(mech.legs.rl, mechState.walkCycle + GAIT_PHASE.rl * TWO_PI, gait, mechState.crouch);

    placeLightPool(mech, mechState, surface);
}
