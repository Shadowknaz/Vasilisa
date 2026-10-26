// Mutable state of the walker (position, heading, gait phase and blend, hatch/crouch).
import { MECH_CONTROL } from '../config/controls.js';

export interface MechState {
    x: number;
    z: number;
    yaw: number;
    // Stride phase in radians; advances only while the walker is driving.
    walkCycle: number;
    // Locomotion blend 0..1: scales stride and lift, so the parked walker settles
    // into a planted stance instead of freezing mid-step.
    gait: number;
    lastStepSide: number;
    hatchOpen: number;
    crouch: number;
}

export function createMechState(): MechState {
    return {
        x: MECH_CONTROL.START_X,
        z: MECH_CONTROL.START_Z,
        yaw: MECH_CONTROL.START_YAW,
        walkCycle: 0,
        gait: 0,
        lastStepSide: 0,
        hatchOpen: 0,
        crouch: 0
    };
}
