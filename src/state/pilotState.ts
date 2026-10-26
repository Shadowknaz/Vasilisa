// Mutable state of the pilot (first-person position, look angles, gait phase).
import { PILOT_CONTROL } from '../config/controls.js';

export interface PilotState {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    // Stride phase in radians; advances only while the pilot is walking.
    walkCycle: number;
    // Locomotion blend 0..1: the heroine's step eases in and out with the keys,
    // so the body settles into a planted stance instead of freezing mid-stride.
    gait: number;
}

export function createPilotState(): PilotState {
    return {
        x: PILOT_CONTROL.START.X,
        y: PILOT_CONTROL.START.Y,
        z: PILOT_CONTROL.START.Z,
        yaw: PILOT_CONTROL.START.YAW,
        pitch: PILOT_CONTROL.START.PITCH,
        walkCycle: 0,
        gait: 0
    };
}
