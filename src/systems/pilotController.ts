// First-person mode: pilot walking, collision and the boarding beacon pulse.
import { COLORS } from '../config/colors.js';
import { MODE_FLOW, PILOT_CONTROL } from '../config/controls.js';
import { isPilotNearMech } from './boarding.js';
import { readMovementVector } from './keyState.js';
import type { ViewState } from '../state/viewState.js';
import type { MechState } from '../state/mechState.js';
import type { PilotState } from '../state/pilotState.js';
import type { InputState } from '../state/inputState.js';
import type { CollisionQuery } from './collision.js';
import type { MeshBasicMaterial } from 'three';
import type { SnowTrackSystem } from '../world/snowTracks.js';

interface PilotModeContext {
    viewState: ViewState;
    mechState: MechState;
    pilotState: PilotState;
    inputState: InputState;
    // The courtyard outdoors, the interior world inside a stairwell.
    collision: CollisionQuery;
    boardingLampMat: MeshBasicMaterial;
    snowTracks?: SnowTrackSystem;
}

function updateBoardingLamp(viewState: ViewState, mechState: MechState, pilotState: PilotState, boardingLampMat: MeshBasicMaterial): void {
    // Diegetic beacon pulse in pure monochrome brightness when near the Mech hatch
    if (isPilotNearMech(mechState, pilotState)) {
        const pulse = Math.sin(viewState.time * MODE_FLOW.LAMP_PULSE_RATE) > 0
            ? COLORS.BOARDING_LAMP_ON
            : COLORS.BOARDING_LAMP_DIM;
        boardingLampMat.color.setHex(pulse);
    } else {
        boardingLampMat.color.setHex(COLORS.BOARDING_LAMP_OFF);
    }
}

export function updatePilotMode(dt: number, {
    viewState,
    mechState,
    pilotState,
    inputState,
    collision,
    boardingLampMat,
    snowTracks
}: PilotModeContext): void {
    mechState.hatchOpen = Math.min(1, mechState.hatchOpen + dt * MODE_FLOW.HATCH_RATE);
    mechState.crouch = Math.min(1, mechState.crouch + dt * MODE_FLOW.HATCH_RATE);

    updateBoardingLamp(viewState, mechState, pilotState, boardingLampMat);

    const { forward, right: strafe } = readMovementVector(inputState.keys);
    const moving = forward !== 0 || strafe !== 0;

    // Locomotion blend of the visible body: it eases in with the first step and
    // settles to a planted stance after the last key, even if the pilot boards
    // mid-stride.
    const gaitTarget = moving ? 1 : 0;
    const gaitRate = moving ? PILOT_CONTROL.GAIT_RATE_IN : PILOT_CONTROL.GAIT_RATE_OUT;
    pilotState.gait += (gaitTarget - pilotState.gait) * Math.min(1, dt * gaitRate);
    if (Math.abs(gaitTarget - pilotState.gait) < 1e-3) pilotState.gait = gaitTarget;

    if (moving) {
        const walkSpeed = inputState.keys.shift ? PILOT_CONTROL.RUN_SPEED : PILOT_CONTROL.WALK_SPEED;
        const sinYaw = Math.sin(pilotState.yaw);
        const cosYaw = Math.cos(pilotState.yaw);

        const vx = (-sinYaw * forward + cosYaw * strafe) * walkSpeed * dt;
        const vz = (-cosYaw * forward - sinYaw * strafe) * walkSpeed * dt;

        // Prevent walking inside the parked 4-legged Mech's hull while allowing close approach
        const distanceToMechAfter = Math.hypot(
            pilotState.x + vx - mechState.x,
            pilotState.z + vz - mechState.z
        );

        if (distanceToMechAfter > PILOT_CONTROL.MECH_CLEARANCE) {
            if (collision.isFree(pilotState.x + vx, pilotState.z, PILOT_CONTROL.COLLIDER_RADIUS)) {
                pilotState.x += vx;
            }
            if (collision.isFree(pilotState.x, pilotState.z + vz, PILOT_CONTROL.COLLIDER_RADIUS)) {
                pilotState.z += vz;
            }
        }

        const stepRate = inputState.keys.shift
            ? PILOT_CONTROL.RUN_CYCLE_RATE
            : PILOT_CONTROL.WALK_CYCLE_RATE;
        const prevCycle = pilotState.walkCycle;
        pilotState.walkCycle += dt * stepRate;

        // Imprint footstep when foot plants on ground
        if (Math.floor(prevCycle / Math.PI) !== Math.floor(pilotState.walkCycle / Math.PI)) {
            snowTracks?.imprint(pilotState.x, pilotState.z, pilotState.yaw, false);
        }
    }
}
