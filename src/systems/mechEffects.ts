// Exhaust chimney: clattering rain-flap cap and diesel smoke puffs.
import { MECH_EFFECTS } from '../config/controls.js';
import { MECH_RIG } from '../config/mech.js';
import type { ViewState } from '../state/viewState.js';
import type { MechState } from '../state/mechState.js';
import type { createDustSystem } from './dust.js';
import type { Group } from 'three';

interface ExhaustEffectsContext {
    viewState: ViewState;
    mechState: MechState;
    dust: ReturnType<typeof createDustSystem>;
    exhaustFlapPivot: Group;
    isMechMoving: boolean;
}

export function updateExhaustEffects(dt: number, {
    viewState,
    mechState,
    dust,
    exhaustFlapPivot,
    isMechMoving
}: ExhaustEffectsContext): void {
    // Clattering rain-flap cap on top of the tall vertical Soviet exhaust pipe
    const flapFrequency = isMechMoving
        ? MECH_EFFECTS.FLAP_FREQUENCY_MOVING
        : MECH_EFFECTS.FLAP_FREQUENCY_IDLE;
    const flapAmplitude = isMechMoving
        ? MECH_EFFECTS.FLAP_AMPLITUDE_MOVING
        : MECH_EFFECTS.FLAP_AMPLITUDE_IDLE;

    exhaustFlapPivot.rotation.z =
        MECH_EFFECTS.FLAP_BASE_ANGLE - Math.abs(Math.sin(viewState.time * flapFrequency)) * flapAmplitude;

    // Spawn dark diesel smoke puffs from the top of the vertical exhaust chimney
    const smokeRate = isMechMoving ? MECH_EFFECTS.SMOKE_RATE_MOVING : MECH_EFFECTS.SMOKE_RATE_IDLE;
    if (Math.random() < dt * smokeRate) {
        const cosYaw = Math.cos(mechState.yaw);
        const sinYaw = Math.sin(mechState.yaw);
        const { x: localX, y: tipHeight, z: localZ } = MECH_RIG.EXHAUST_TIP;

        // World coordinates of the exhaust pipe tip
        const x = mechState.x + localX * cosYaw + localZ * sinYaw;
        const z = mechState.z - localX * sinYaw + localZ * cosYaw;
        const y = tipHeight - mechState.crouch * MECH_RIG.CROUCH_DROP;

        dust.spawn(
            x,
            y,
            z,
            isMechMoving ? MECH_EFFECTS.SMOKE_SCALE_MOVING : MECH_EFFECTS.SMOKE_SCALE_IDLE
        );
    }
}
