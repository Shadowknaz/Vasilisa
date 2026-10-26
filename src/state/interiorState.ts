// Interaction state of the interior layer. The district has no interface: a
// doorway is walked through, a shut door is a wall. All the runtime has to
// remember is which porch the pilot is standing in.
export interface InteriorState {
    // Instance id of the porch the pilot is inside, null outdoors.
    activeId: string | null;
}

export function createInteriorState(): InteriorState {
    return {
        activeId: null
    };
}
