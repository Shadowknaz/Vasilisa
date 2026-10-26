// Mode flow: hatch/crouch animation and transitions between diorama and first-person.
import { MODE_FLOW } from '../config/controls.js';
import type { ViewState } from '../state/viewState.js';
import type { MechState } from '../state/mechState.js';

export function updateModeTransitions(dt: number, { viewState, mechState }: { viewState: ViewState; mechState: MechState }): void {
    if (viewState.mode === 'TRANSITION_TO_FP') {
        viewState.transitionProgress += dt * MODE_FLOW.TRANSITION_RATE;
        mechState.hatchOpen = Math.min(1, viewState.transitionProgress * MODE_FLOW.HATCH_FOLLOW);
        mechState.crouch = Math.min(1, viewState.transitionProgress * MODE_FLOW.CROUCH_FOLLOW);
        if (viewState.transitionProgress >= 1) {
            viewState.transitionProgress = 1;
            viewState.mode = 'FP';
        }
    } else if (viewState.mode === 'TRANSITION_TO_MECH') {
        viewState.transitionProgress += dt * MODE_FLOW.TRANSITION_RATE;
        mechState.hatchOpen = Math.max(0, 1 - viewState.transitionProgress * MODE_FLOW.CROUCH_FOLLOW);
        mechState.crouch = Math.max(0, 1 - viewState.transitionProgress * MODE_FLOW.CROUCH_FOLLOW);
        if (viewState.transitionProgress >= 1) {
            viewState.transitionProgress = 0;
            viewState.mode = 'MECH';
        }
    }
}
