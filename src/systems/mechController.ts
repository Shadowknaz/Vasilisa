// Isometric mode: driving the walker, turning it toward the input direction
// and triggering quadruped footstep dust.
import { MECH_CONTROL, MODE_FLOW } from '../config/controls.js';
import { readMovementVector } from './keyState.js';
import type { ViewState } from '../state/viewState.js';
import type { MechState } from '../state/mechState.js';
import type { InputState } from '../state/inputState.js';
import type { CollisionWorld } from './collision.js';
import type { createDustSystem } from './dust.js';
import type { SnowTrackSystem } from '../world/snowTracks.js';

type DustSystem = ReturnType<typeof createDustSystem>;

interface MechModeContext {
    viewState: ViewState;
    mechState: MechState;
    inputState: InputState;
    collision: CollisionWorld;
    dust: DustSystem;
    snowTracks: SnowTrackSystem;
}

function normalizeAngle(angle: number): number {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function spawnFootstepDust(dust: DustSystem, mechState: MechState, stepPhase: number): void {
    const legSide = stepPhase % 2 === 0 ? MECH_CONTROL.STEP_FOOT_OFFSET_X : -MECH_CONTROL.STEP_FOOT_OFFSET_X;
    const legEnd = stepPhase < MECH_CONTROL.STEP_COUNT / 2
        ? MECH_CONTROL.STEP_FOOT_OFFSET_Z
        : -MECH_CONTROL.STEP_FOOT_OFFSET_Z;
    const cosYaw = Math.cos(mechState.yaw);
    const sinYaw = Math.sin(mechState.yaw);

    dust.spawn(
        mechState.x + legSide * cosYaw + legEnd * sinYaw,
        MECH_CONTROL.STEP_DUST_HEIGHT,
        mechState.z - legSide * sinYaw + legEnd * cosYaw,
        MECH_CONTROL.STEP_DUST_SCALE
    );
}

export function updateMechMode(dt: number, { viewState, mechState, inputState, collision, dust, snowTracks }: MechModeContext): void {
    mechState.hatchOpen = Math.max(0, mechState.hatchOpen - dt * MODE_FLOW.HATCH_RATE);
    mechState.crouch = Math.max(0, mechState.crouch - dt * MODE_FLOW.HATCH_RATE);

    // Input vector relative to isometric camera orientation
    const { forward, right } = readMovementVector(inputState.keys);

    if (forward !== 0 || right !== 0) {
        // Convert screen-relative isometric input into world direction
        const forwardDirX = -Math.sin(viewState.isoYaw);
        const forwardDirZ = -Math.cos(viewState.isoYaw);
        const rightDirX = Math.cos(viewState.isoYaw);
        const rightDirZ = -Math.sin(viewState.isoYaw);

        const moveX = forwardDirX * forward + rightDirX * right;
        const moveZ = forwardDirZ * forward + rightDirZ * right;

        const targetYaw = Math.atan2(moveX, moveZ);
        // Shortest angle turn for the heavy 4-legged walker
        const diff = normalizeAngle(targetYaw - mechState.yaw);
        mechState.yaw += diff * Math.min(1, dt * MECH_CONTROL.TURN_RATE);

        const nx = mechState.x + Math.sin(mechState.yaw) * MECH_CONTROL.MOVE_SPEED * dt;
        const nz = mechState.z + Math.cos(mechState.yaw) * MECH_CONTROL.MOVE_SPEED * dt;

        if (collision.isFree(nx, mechState.z, MECH_CONTROL.COLLIDER_RADIUS)) mechState.x = nx;
        if (collision.isFree(mechState.x, nz, MECH_CONTROL.COLLIDER_RADIUS)) mechState.z = nz;

        // The stride phase only advances under power; the gait blend scales how
        // much of it reaches the legs, so a stop eases back to a planted stance.
        mechState.walkCycle += dt * MECH_CONTROL.WALK_CYCLE_RATE;
        mechState.gait = Math.min(1, mechState.gait + dt * MECH_CONTROL.GAIT_RATE_IN);

        // Trigger quadruped footstep dust puffs
        const stepPhase = Math.floor(mechState.walkCycle / MECH_CONTROL.STEP_QUARTER_TURN) % MECH_CONTROL.STEP_COUNT;
        if (stepPhase !== mechState.lastStepSide) {
            mechState.lastStepSide = stepPhase;
            spawnFootstepDust(dust, mechState, stepPhase);
            const side = stepPhase % 2 === 0 ? MECH_CONTROL.STEP_FOOT_OFFSET_X : -MECH_CONTROL.STEP_FOOT_OFFSET_X;
            const end = stepPhase < MECH_CONTROL.STEP_COUNT / 2 ? MECH_CONTROL.STEP_FOOT_OFFSET_Z : -MECH_CONTROL.STEP_FOOT_OFFSET_Z;
            const c = Math.cos(mechState.yaw), s = Math.sin(mechState.yaw);
            snowTracks.imprint(mechState.x + side * c + end * s, mechState.z - side * s + end * c, mechState.yaw);
        }
    } else {
        mechState.gait = Math.max(0, mechState.gait - dt * MECH_CONTROL.GAIT_RATE_OUT);
    }
}
