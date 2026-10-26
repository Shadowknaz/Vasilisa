// Weathering of the Khrushchyovka, eleven years after the last caretaker: dirt
// washing off the sills and the balcony slabs, one panel corner knocked out by
// frost with rebar in the hole, rust running down from the gas line and the tags
// the district sprayed on the ground floor.
//
// Everything is a decal lying on the wall plane or a stub growing out of it by
// `panelBox`, so nothing here can leave the frozen visual envelope. The stains
// are grey textures multiplied by a material colour: `grime` uses the facade
// tone (it has to fade into the panel), `rustBleed` the rust tone (it has to stay
// warmer than the concrete around it).
import { GAS_PIPE, TILE, addBox, addPanelDecal, floorBaseY, panelBox } from './khrushchyovkaShell.js';
import type { BodyShape, FacadePanel, Shell } from './khrushchyovkaShell.js';
import { FACADE_FACE, isDecayEnabled } from './khrushchyovkaDecay.js';
import type { DecayProfile } from './khrushchyovkaDecay.js';

// Metres. A stain is a quad lifted one centimetre off the wall; the wind does not
// care, the depth buffer does.
export const WEATHERING = {
    // Dirt off a drip sill. Never wider than the sill it runs from.
    SILL_STAIN: { MAX_WIDTH: 1.9, HEIGHT: 0.85, LIFT: 0.01, CHANCE: 0.34 },
    // Snow on a sill. The wind sweeps a facade unevenly, so only a bit more than
    // half the sills keep a cap; a full row reads as a printed pattern.
    SILL_SNOW: { CHANCE: 0.55 },
    // Dirt off a cantilevered balcony slab. Short on purpose: it has to end above
    // the window head of the storey below, not run across it.
    BALCONY_STAIN: { WIDTH: 2.45, HEIGHT: 0.7, LIFT: 0.01 },
    // Panel corner knocked out by frost, plus the rebar left standing in it.
    SPALL: {
        WIDTH: 1.4,
        HEIGHT: 1.3,
        LIFT: 0.014,
        REBAR: {
            LENGTH: 0.45,
            THICKNESS: 0.04,
            PROUD: 0.14,
            EMBED: 0.05,
            // Local X of each stub against the joint the decal is pinned to, and
            // how far below that joint its foot sits.
            STUBS: [
                { X: -0.36, BOTTOM: -0.62 },
                { X: -0.18, BOTTOM: -0.48 }
            ]
        },
        // Concrete dust that stayed on the wall under the break
        DUST: { OFFSET_X: -0.25, WIDTH_SHARE: 0.6 }
    },
    // A tag between the plinth ledge and the first sill.
    GRAFFITI: { WIDTH: 1.75, HEIGHT: 0.55, LIFT: 0.012, ABOVE_PLINTH: 0.12 },
    // Rust washing down from the gas line, starting just under the pipe.
    PIPE_STAIN: { WIDTH: 0.52, HEIGHT: 0.85, LIFT: 0.01, DROP: 0.05 }
};

function panelFor(body: BodyShape, face: number): FacadePanel {
    switch (face) {
        case FACADE_FACE.back:
            return { axis: 'z', side: -1, plane: -body.frontPlane };
        case FACADE_FACE.endRight:
            return { axis: 'x', side: 1, plane: body.sidePlane };
        case FACADE_FACE.endLeft:
            return { axis: 'x', side: -1, plane: -body.sidePlane };
        default:
            return { axis: 'z', side: 1, plane: body.frontPlane };
    }
}

// Dirt tongue under a sash: its top edge is the bottom of the drip sill, because
// that is the ledge the water leaves.
export function addSillStain(
    shell: Shell,
    panel: FacadePanel,
    u: number,
    sillBottom: number,
    sillWidth: number
): void {
    const stain = WEATHERING.SILL_STAIN;
    addPanelDecal(
        shell.grime,
        panel,
        u,
        sillBottom - stain.HEIGHT / 2,
        Math.min(sillWidth, stain.MAX_WIDTH),
        stain.HEIGHT,
        stain.LIFT
    );
}

// Dirt tongue under a balcony slab, at the wall behind the cantilever.
export function addBalconyStain(shell: Shell, panel: FacadePanel, u: number, slabBottom: number): void {
    if (!isDecayEnabled()) return;
    const stain = WEATHERING.BALCONY_STAIN;
    addPanelDecal(
        shell.grime,
        panel,
        u,
        slabBottom - stain.HEIGHT / 2,
        stain.WIDTH,
        stain.HEIGHT,
        stain.LIFT
    );
}

// A panel corner the frost broke out: the decal is pinned to the joint, its patch
// sits below-left of it, and two stubs of rebar stand out of the break.
function addSpall(shell: Shell, panel: FacadePanel, u: number, y: number): void {
    const spall = WEATHERING.SPALL;
    addPanelDecal(shell.spall, panel, u, y, spall.WIDTH, spall.HEIGHT, spall.LIFT);

    const rebar = spall.REBAR;
    rebar.STUBS.forEach((stub) => {
        addBox(
            shell.rust,
            panelBox(
                panel,
                u + stub.X - rebar.THICKNESS / 2,
                u + stub.X + rebar.THICKNESS / 2,
                y + stub.BOTTOM,
                y + stub.BOTTOM + rebar.LENGTH,
                rebar.PROUD - rebar.EMBED,
                rebar.PROUD
            ),
            TILE.RUST.U,
            TILE.RUST.V
        );
    });

    // Concrete dust that fell out of the hole and stayed on the wall under it
    addPanelDecal(
        shell.grime,
        panel,
        u + spall.DUST.OFFSET_X,
        y - spall.HEIGHT / 2 - WEATHERING.SILL_STAIN.HEIGHT / 2,
        spall.WIDTH * spall.DUST.WIDTH_SHARE,
        WEATHERING.SILL_STAIN.HEIGHT,
        WEATHERING.SILL_STAIN.LIFT
    );
}

function addGraffitiTag(shell: Shell, panel: FacadePanel, u: number, y: number): void {
    const tag = WEATHERING.GRAFFITI;
    addPanelDecal(shell.graffiti, panel, u, y, tag.WIDTH, tag.HEIGHT, tag.LIFT);
}

// Rust out of the gas line: the stain starts a hand below the pipe and runs down
// the wall, fading out before the first-floor windows.
function addPipeStain(shell: Shell, panel: FacadePanel, u: number, pipeY: number): void {
    const stain = WEATHERING.PIPE_STAIN;
    addPanelDecal(shell.rustBleed, panel, u, pipeY - stain.HEIGHT / 2, stain.WIDTH, stain.HEIGHT, stain.LIFT);
}

// Block-level layer: the authored anchors of a block's history. Called once per
// building after the windows, porch and balcony field are drawn.
export function addBlockWeathering(shell: Shell, body: BodyShape, decay: DecayProfile): void {
    if (!isDecayEnabled()) return;
    const spall = decay.spall;
    addSpall(shell, panelFor(body, spall.face), spall.u, floorBaseY(spall.floor));

    const tagBottom = body.plinthHeight + WEATHERING.GRAFFITI.ABOVE_PLINTH;
    decay.graffiti.forEach((tag) => {
        addGraffitiTag(shell, panelFor(body, tag.face), tag.u, tagBottom + WEATHERING.GRAFFITI.HEIGHT / 2);
    });

    // The pipe runs along the courtyard face only.
    const pipeY = body.plinthHeight + GAS_PIPE.HEIGHT_ABOVE_PLINTH - WEATHERING.PIPE_STAIN.DROP;
    const front = panelFor(body, FACADE_FACE.front);
    decay.pipeStains.forEach((u) => addPipeStain(shell, front, u, pipeY));
}
