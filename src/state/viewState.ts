// View state: mode flow, isometric orbit and the diorama overview blend.
import { ISO_VIEW } from '../config/controls.js';

export type ViewMode = 'MECH' | 'TRANSITION_TO_FP' | 'FP' | 'TRANSITION_TO_MECH';

export interface ViewState {
    mode: ViewMode;
    transitionProgress: number;
    isoYaw: number;
    isoTargetYaw: number;
    // Current and requested isometric camera distance multiplier. Keeping the
    // target separate makes the wheel feel light instead of snapping the view.
    isoZoom: number;
    isoTargetZoom: number;
    overview: boolean;
    overviewBlend: number;
    time: number;
}

export function createViewState(): ViewState {
    return {
        mode: 'MECH', // 'MECH', 'TRANSITION_TO_FP', 'FP', 'TRANSITION_TO_MECH'
        transitionProgress: 0,
        isoYaw: ISO_VIEW.START_YAW,
        isoTargetYaw: ISO_VIEW.START_YAW,
        isoZoom: 1,
        isoTargetZoom: 1,
        // O key: acceptance view of the whole island. The blend eases pose and fog
        // instead of cutting between two cameras.
        overview: false,
        overviewBlend: 0,
        time: 0
    };
}
