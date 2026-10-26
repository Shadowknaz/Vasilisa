// Pixel-art skin of the Khrushchyovka, ported from the standalone home.html
// diorama: prefab panel concrete with tarred joints, weathered end walls, the
// basement plinth, four states of a dead sash, bitumen roofing, corrugated
// balcony cladding and rusted steel. Every texture is generated once at module
// load from one fixed seed, so two page loads paint identical walls.
import { createPixelTexture, gray } from '../core/pixelTexture.js';
import { createSeededRandom } from '../core/random.js';
import type { CanvasTexture } from 'three';

const NOISE_SEED = 1986;

const rand = createSeededRandom(NOISE_SEED);

const PANEL = {
    SIZE: 64,
    BASE: 124,
    NOISE: 18,
    STREAK_AMPLITUDE: 5,
    STREAK_FREQUENCY: 0.45,
    STREAK_DAMP: 8,
    AGGREGATE_CHANCE: 0.94,
    AGGREGATE_DROP: 18,
    BORDER: '#424446',
    BORDER_INSET: 1,
    BORDER_WIDTH: 2,
    MASTIC: '#232426',
    MASTIC_EDGE: 2,
    REPAIR_COUNT: 6,
    REPAIR_CHANCE: 0.35,
    REPAIR_WIDTH: 8,
    REPAIR_HEIGHT: 3
};

const SIDE = {
    SIZE: 64,
    BASE: 104,
    NOISE: 18,
    DAMP_AMPLITUDE: 6,
    DAMP_FREQUENCY: 0.2,
    BORDER: '#383a3c',
    BORDER_INSET: 1,
    BORDER_WIDTH: 2
};

const PLINTH = {
    WIDTH: 64,
    HEIGHT: 32,
    BASE: 62,
    NOISE: 16,
    GROUND_DAMP: 14,
    DAMP_ROW: 0.6,
    BORDER: '#2a2c2e'
};

const WINDOW = {
    SIZE: 32,
    RECESS: '#2b2d2f',
    FRAME: '#5a5650',
    FRAME_INSET: 2,
    PANE_INSET: 4,
    MULLION: '#514d48',
    MULLION_X: 15,
    MULLION_WIDTH: 2,
    FORTOCHKA_Y: 11,
    FORTOCHKA_HEIGHT: 2,
    FORTOCHKA_WIDTH: 14,
    SHADOW: '#1c1e20',
    NOISE: 12,
    DARK_GLASS: 30,
    CURTAIN: 14,
    CURTAIN_EDGE: 9,
    // Moonlight on dead glass. The pane is a touch brighter at its head (the sky
    // above the courtyard is the only thing it still reflects) with one soft
    // diagonal streak. All of it is albedo: the shader's emissive term for a sash
    // is zero, so a pane lit like this is a reflection, not a lamp.
    SHEEN: { HEAD_GAIN: 16, STREAK_GAIN: 12, STREAK_CENTRE: 46, STREAK_WIDTH: 3 },
    // Ten winters without a caretaker: the pane is gone and the reveal reads as
    // a hole with the mullion still standing in it.
    CAVITY: 11,
    CAVITY_NOISE: 7,
    CAVITY_MULLION: 23,
    // Dags of glass left in the frame. Muted, not white: glass stopped catching
    // the sky a decade ago, only its edges still do.
    SHARD: 76,
    SHARD_DARK: 46,
    CRACK: 86,
    // Boards nailed over a blown sash: grey, grained, one nail per end.
    BOARD: 74,
    BOARD_EDGE: 16,
    BOARD_GRAIN: 9,
    BOARD_HEIGHT: 7,
    BOARD_GAP: 2,
    BOARD_COUNT: 3,
    NAIL: 30
};

// Washed soot over the flat that burned. Eleven years of rain left a grey stain,
// not a fresh black tongue, so the gradient starts at the panel tone and only the
// bottom edge (the window head) is dark.
const SOOT = {
    SIZE: 32,
    TOP: PANEL.BASE,
    BOTTOM: 42,
    NOISE: 12,
    WOBBLE: 6,
    // Columns of the decal that blend back into the panel, so the stain has no
    // hard left/right edge to read as a pasted rectangle.
    EDGE: 4
};

const ROOF = {
    SIZE: 64,
    BASE: 38,
    NOISE: 14,
    SEAM_STEP: 16,
    SEAM_DARKEN: 10
};

const SLATE = {
    SIZE: 32,
    BASE: 72,
    WAVE_AMPLITUDE: 12,
    WAVE_FREQUENCY: 1.5,
    RUST_ROW: 20,
    RUST_CHANCE: 0.6,
    RUST_GAIN: 12,
    NOISE: 10
};

const RUST = {
    SIZE: 32,
    BASE: 64,
    NOISE: 16,
    PATCH_FREQUENCY: 0.3,
    PATCH_THRESHOLD: 0.2,
    PATCH_GAIN: 14
};

const panelWall = createPixelTexture(PANEL.SIZE, PANEL.SIZE, (ctx, w, h) => {
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const noise = (rand() - 0.5) * PANEL.NOISE;
            // Rain streaks run down the slab and fade toward the ground.
            const streak = Math.sin(x * PANEL.STREAK_FREQUENCY) * PANEL.STREAK_AMPLITUDE - (y / h) * PANEL.STREAK_DAMP;
            let value = PANEL.BASE + noise + streak;
            if (rand() > PANEL.AGGREGATE_CHANCE) value -= PANEL.AGGREGATE_DROP;
            ctx.fillStyle = gray(value);
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // Recessed concrete panel border
    ctx.strokeStyle = PANEL.BORDER;
    ctx.lineWidth = PANEL.BORDER_WIDTH;
    ctx.strokeRect(PANEL.BORDER_INSET, PANEL.BORDER_INSET, w - PANEL.BORDER_INSET * 2, h - PANEL.BORDER_INSET * 2);

    // Black tar mastic over the panel joints (герметизация швов)
    ctx.fillStyle = PANEL.MASTIC;
    ctx.fillRect(0, 0, w, PANEL.MASTIC_EDGE);
    ctx.fillRect(0, 0, PANEL.MASTIC_EDGE, h);
    for (let repair = 0; repair < PANEL.REPAIR_COUNT; repair++) {
        if (rand() > PANEL.REPAIR_CHANCE) {
            ctx.fillRect((rand() * w) | 0, 0, PANEL.REPAIR_WIDTH, PANEL.REPAIR_HEIGHT);
        }
    }
});

const sidePanel = createPixelTexture(SIDE.SIZE, SIDE.SIZE, (ctx, w, h) => {
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const noise = (rand() - 0.5) * SIDE.NOISE;
            const damp = Math.cos(y * SIDE.DAMP_FREQUENCY) * SIDE.DAMP_AMPLITUDE;
            ctx.fillStyle = gray(SIDE.BASE + noise - damp);
            ctx.fillRect(x, y, 1, 1);
        }
    }

    ctx.strokeStyle = SIDE.BORDER;
    ctx.lineWidth = SIDE.BORDER_WIDTH;
    ctx.strokeRect(SIDE.BORDER_INSET, SIDE.BORDER_INSET, w - SIDE.BORDER_INSET * 2, h - SIDE.BORDER_INSET * 2);
});

const plinthConcrete = createPixelTexture(PLINTH.WIDTH, PLINTH.HEIGHT, (ctx, w, h) => {
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const noise = (rand() - 0.5) * PLINTH.NOISE;
            // Damp, mossy stain where the plinth meets the courtyard dirt.
            const groundDamp = y > h * PLINTH.DAMP_ROW ? -PLINTH.GROUND_DAMP : 0;
            ctx.fillStyle = gray(PLINTH.BASE + noise + groundDamp);
            ctx.fillRect(x, y, 1, 1);
        }
    }

    ctx.strokeStyle = PLINTH.BORDER;
    ctx.strokeRect(0, 0, w, h);
});

// One sash: concrete reveal, peeling wooden frame, then whatever is left of the
// glazing. The four states are painted at the same 32x32 size so a sash can swap
// its state without any geometry change.
function paintSash(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = WINDOW.RECESS;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = WINDOW.FRAME;
    ctx.fillRect(WINDOW.FRAME_INSET, WINDOW.FRAME_INSET, w - WINDOW.FRAME_INSET * 2, h - WINDOW.FRAME_INSET * 2);
}

// Shadow under the head of the reveal: the sash always sits a little deeper.
function paintSashShadow(ctx: CanvasRenderingContext2D, w: number): void {
    ctx.fillStyle = WINDOW.SHADOW;
    ctx.fillRect(WINDOW.FRAME_INSET, WINDOW.FRAME_INSET, w - WINDOW.FRAME_INSET * 2, 1);
}

function paintMullion(ctx: CanvasRenderingContext2D, h: number, style: string): void {
    ctx.fillStyle = style;
    ctx.fillRect(WINDOW.MULLION_X, WINDOW.FRAME_INSET, WINDOW.MULLION_WIDTH, h - WINDOW.FRAME_INSET * 2);
    ctx.fillRect(WINDOW.MULLION_X + 1, WINDOW.FORTOCHKA_Y, WINDOW.FORTOCHKA_WIDTH, WINDOW.FORTOCHKA_HEIGHT);
}

function fillPane(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    colourAt: (px: number, py: number) => string
): void {
    for (let py = WINDOW.PANE_INSET; py < h - WINDOW.PANE_INSET; py++) {
        for (let px = WINDOW.PANE_INSET; px < w - WINDOW.PANE_INSET; px++) {
            ctx.fillStyle = colourAt(px, py);
            ctx.fillRect(px, py, 1, 1);
        }
    }
}

// A jagged dag of glass left in the frame: three corners, one of them inside the opening.
function paintShard(
    ctx: CanvasRenderingContext2D,
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number,
    style: string
): void {
    ctx.fillStyle = style;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.fill();
}

// Cracked sash: the glass is still there, with one corner blown out and the crack
// running up to the transom.
function paintCracks(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = gray(WINDOW.CAVITY);
    ctx.beginPath();
    ctx.moveTo(w - WINDOW.PANE_INSET, h - WINDOW.PANE_INSET);
    ctx.lineTo(w - 13, h - WINDOW.PANE_INSET);
    ctx.lineTo(w - 10, h - 15);
    ctx.lineTo(w - 16, h - 19);
    ctx.lineTo(w - WINDOW.PANE_INSET, h - 17);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = gray(WINDOW.CRACK);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(7, 8);
    ctx.lineTo(13, 14);
    ctx.lineTo(11, 20);
    ctx.lineTo(16, 25);
    ctx.moveTo(13, 14);
    ctx.lineTo(21, 12);
    ctx.lineTo(26, 18);
    ctx.stroke();
}

// Emptied sash: teeth of glass along the head, the jambs and the sill. Kept
// asymmetric — one big bite out of the lower pane, the rest of the frame holding
// a few dags — so a row of these never reads as a repeated stamp.
function paintShards(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const pale = gray(WINDOW.SHARD);
    const dark = gray(WINDOW.SHARD_DARK);
    const inset = WINDOW.PANE_INSET;
    paintShard(ctx, inset, inset, 11, inset, 7, 11, pale);
    paintShard(ctx, 22, inset, w - inset, inset, 26, 9, dark);
    paintShard(ctx, inset, 14, inset, 22, 10, 19, dark);
    paintShard(ctx, 18, h - inset, w - inset, h - inset, 23, h - 14, pale);
}

// Boards over a blown sash: three warped planks, two nails each, the cavity
// showing in the gaps.
function paintBoards(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const from = WINDOW.PANE_INSET;
    const span = w - WINDOW.PANE_INSET * 2;
    const limit = h - WINDOW.PANE_INSET;
    for (let plank = 0; plank < WINDOW.BOARD_COUNT; plank++) {
        const top = from + plank * (WINDOW.BOARD_HEIGHT + WINDOW.BOARD_GAP);
        const tone = WINDOW.BOARD + (rand() - 0.5) * WINDOW.BOARD_GRAIN * 2;
        const grain = Math.sin(plank * 2.3) * WINDOW.BOARD_GRAIN;
        for (let y = top; y < Math.min(top + WINDOW.BOARD_HEIGHT, limit); y++) {
            const edge = y === top || y === top + WINDOW.BOARD_HEIGHT - 1 ? -WINDOW.BOARD_EDGE : 0;
            for (let x = from; x < from + span; x++) {
                ctx.fillStyle = gray(tone + edge + grain + (rand() - 0.5) * WINDOW.BOARD_GRAIN);
                ctx.fillRect(x, y, 1, 1);
            }
        }
        ctx.fillStyle = gray(WINDOW.NAIL);
        ctx.fillRect(from + 1, top + (WINDOW.BOARD_HEIGHT >> 1), 1, 1);
        ctx.fillRect(from + span - 2, top + (WINDOW.BOARD_HEIGHT >> 1), 1, 1);
    }
}

type SashMode = 'dark' | 'cracked' | 'empty' | 'boarded';

function createWindowTexture(mode: SashMode): CanvasTexture {
    return createPixelTexture(WINDOW.SIZE, WINDOW.SIZE, (ctx, w, h) => {
        paintSash(ctx, w, h);

        if (mode === 'empty' || mode === 'boarded') {
            // The room behind is gone: a black cavity with the mullion silhouette,
            // unlit by anything.
            fillPane(ctx, w, h, () => gray(WINDOW.CAVITY + (rand() - 0.5) * WINDOW.CAVITY_NOISE));
            paintMullion(ctx, h, gray(WINDOW.CAVITY_MULLION));
        } else {
            // Unlit glass with a faint curtain silhouette behind it, and the sheen
            // of the sky it still reflects.
            fillPane(ctx, w, h, (px, py) => {
                const noise = (rand() - 0.5) * WINDOW.NOISE;
                const curtain = px < WINDOW.CURTAIN_EDGE || px > w - WINDOW.CURTAIN_EDGE ? WINDOW.CURTAIN : 0;
                const streak =
                    Math.abs(px + py - WINDOW.SHEEN.STREAK_CENTRE) < WINDOW.SHEEN.STREAK_WIDTH
                        ? WINDOW.SHEEN.STREAK_GAIN
                        : 0;
                const head = WINDOW.SHEEN.HEAD_GAIN * (1 - py / h);
                return gray(Math.max(12, WINDOW.DARK_GLASS + curtain + streak + head + noise * 0.6));
            });
            paintMullion(ctx, h, WINDOW.MULLION);
            if (mode === 'cracked') paintCracks(ctx, w, h);
        }

        if (mode === 'empty') paintShards(ctx, w, h);
        if (mode === 'boarded') paintBoards(ctx, w, h);
        paintSashShadow(ctx, w);
    });
}

const windowDark = createWindowTexture('dark');
const windowCracked = createWindowTexture('cracked');
const windowEmpty = createWindowTexture('empty');
const windowBoarded = createWindowTexture('boarded');

// Soot of the one burned flat. The decal sits above the window head, so the
// bottom rows of the canvas (which land at the window) are the darkest.
const sootPlume = createPixelTexture(SOOT.SIZE, SOOT.SIZE, (ctx, w, h) => {
    for (let y = 0; y < h; y++) {
        const rise = y / (h - 1);
        for (let x = 0; x < w; x++) {
            const wobble = Math.sin(x * 0.42 + y * 0.3) * SOOT.WOBBLE * (1 - rise);
            const noise = (rand() - 0.5) * SOOT.NOISE;
            const core = SOOT.BOTTOM + (SOOT.TOP - SOOT.BOTTOM) * rise + wobble + noise;
            const edge = Math.min(x, w - 1 - x);
            const blend = Math.min(1, edge / SOOT.EDGE);
            ctx.fillStyle = gray(SOOT.TOP + (core - SOOT.TOP) * blend);
            ctx.fillRect(x, y, 1, 1);
        }
    }
});

const roofTar = createPixelTexture(ROOF.SIZE, ROOF.SIZE, (ctx, w, h) => {
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const noise = (rand() - 0.5) * ROOF.NOISE;
            const seam = x % ROOF.SEAM_STEP === 0 ? -ROOF.SEAM_DARKEN : 0;
            ctx.fillStyle = gray(Math.max(14, ROOF.BASE + noise + seam));
            ctx.fillRect(x, y, 1, 1);
        }
    }
});

const balconySlate = createPixelTexture(SLATE.SIZE, SLATE.SIZE, (ctx, w, h) => {
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const wave = Math.sin(x * SLATE.WAVE_FREQUENCY) * SLATE.WAVE_AMPLITUDE;
            const rust = y > SLATE.RUST_ROW && rand() > SLATE.RUST_CHANCE ? SLATE.RUST_GAIN : 0;
            const noise = (rand() - 0.5) * SLATE.NOISE;
            ctx.fillStyle = gray(Math.max(20, SLATE.BASE + wave + rust + noise));
            ctx.fillRect(x, y, 1, 1);
        }
    }
});

const rustMetal = createPixelTexture(RUST.SIZE, RUST.SIZE, (ctx, w, h) => {
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const noise = (rand() - 0.5) * RUST.NOISE;
            const patch =
                Math.sin(x * RUST.PATCH_FREQUENCY) * Math.cos(y * RUST.PATCH_FREQUENCY) > RUST.PATCH_THRESHOLD
                    ? RUST.PATCH_GAIN
                    : 0;
            ctx.fillStyle = gray(RUST.BASE + patch + noise);
            ctx.fillRect(x, y, 1, 1);
        }
    }
});

// --- weathering skin ---------------------------------------------------------
// Decals of the eleven years since: what ran down the wall, what the frost broke
// out of a panel and what the district sprayed on the ground floor. Each one is
// painted on the panel tone at its far edge, because a decal has no alpha in this
// pipeline (the surface shader carries one opacity per material) — the rectangle
// has to dissolve into the wall by itself.

const STAIN = {
    SIZE: 32,
    PANEL: PANEL.BASE,
    // Values right under the sill, where the dirt leaves the concrete.
    HEAD: 44,
    // Share of the height the tongue needs to fade back into the panel.
    FALLOFF: 0.72,
    STREAK_GAIN: 10,
    NOISE: 14,
    // Columns of the decal that blend back into the panel.
    EDGE: 5
};

const SPALL = {
    SIZE: 32,
    PANEL: PANEL.BASE,
    // Exposed aggregate: a coarser, darker concrete than the panel face.
    PATCH: 104,
    AGGREGATE: 34,
    // The seam of the break and the clean lip just under it.
    CRACK: 40,
    LIP: 138,
    NOISE: 16
};

const GRAFFITI = {
    WIDTH: 64,
    HEIGHT: 32,
    PANEL: PANEL.BASE,
    // Faded primer, not a fresh can: bright enough to read, dull enough not to
    // glow in a night frame.
    PAINT: 142,
    PAINT_EDGE: 88,
    NOISE: 10,
    // Columns of the decal that blend back into the panel.
    EDGE: 7,
    STROKE: 2
};

// The weathering decals draw from their own generators: the wall, roof and window
// noise above is a shared sequence and must not shift when a decal is added.
const stainRand = createSeededRandom(3307);
const spallRand = createSeededRandom(5107);
const graffitiRand = createSeededRandom(6131);

const wallStain = createPixelTexture(STAIN.SIZE, STAIN.SIZE, (ctx, w, h) => {
    for (let y = 0; y < h; y++) {
        // Dark where it leaves the sill, bare panel two thirds of the way down.
        const fall = Math.min(1, y / (h * STAIN.FALLOFF));
        const tongue = STAIN.HEAD + (STAIN.PANEL - STAIN.HEAD) * Math.pow(fall, 0.65);
        for (let x = 0; x < w; x++) {
            const streak = Math.sin(x * 0.9 + y * 0.12) > 0.55 ? STAIN.STREAK_GAIN : 0;
            const noise = (stainRand() - 0.5) * STAIN.NOISE;
            const edge = Math.min(x, w - 1 - x);
            const blend = Math.min(1, edge / STAIN.EDGE);
            ctx.fillStyle = gray(STAIN.PANEL + (tongue + streak + noise - STAIN.PANEL) * blend);
            ctx.fillRect(x, y, 1, 1);
        }
    }
});

const panelSpall = createPixelTexture(SPALL.SIZE, SPALL.SIZE, (ctx, w, h) => {
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            ctx.fillStyle = gray(SPALL.PANEL + (spallRand() - 0.5) * SPALL.NOISE);
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // A chunk of the slab face gone: the patch stays inside the decal on all four
    // sides, otherwise the missing alpha would cut it into a rectangle.
    const outline = [
        [4, 12],
        [9, 8],
        [15, 11],
        [14, 17],
        [19, 21],
        [13, 27],
        [5, 25],
        [3, 18]
    ];
    ctx.fillStyle = gray(SPALL.PATCH);
    ctx.beginPath();
    ctx.moveTo(outline[0][0], outline[0][1]);
    for (let index = 1; index < outline.length; index++) ctx.lineTo(outline[index][0], outline[index][1]);
    ctx.closePath();
    ctx.fill();

    // Aggregate showing through the broken face
    for (let speck = 0; speck < 26; speck++) {
        const x = 4 + ((spallRand() * 13) | 0);
        const y = 10 + ((spallRand() * 14) | 0);
        ctx.fillStyle = gray(SPALL.PATCH - SPALL.AGGREGATE + spallRand() * 12);
        ctx.fillRect(x, y, 1, 1);
    }

    // The edge of the break: a dark seam with a clean lip under it, which is what
    // makes a broken corner read instead of a grey blot.
    ctx.strokeStyle = gray(SPALL.CRACK);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(outline[0][0], outline[0][1]);
    for (let index = 1; index < outline.length; index++) ctx.lineTo(outline[index][0], outline[index][1]);
    ctx.closePath();
    ctx.stroke();

    ctx.strokeStyle = gray(SPALL.LIP);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(outline[0][0] + 1, outline[0][1] + 1);
    ctx.lineTo(9, 10);
    ctx.lineTo(13, 13);
    ctx.stroke();
});

const graffitiTag = createPixelTexture(GRAFFITI.WIDTH, GRAFFITI.HEIGHT, (ctx, w, h) => {
    const edge = GRAFFITI.EDGE;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const blend = Math.min(1, Math.min(x, w - 1 - x) / edge);
            const noise = (graffitiRand() - 0.5) * GRAFFITI.NOISE;
            ctx.fillStyle = gray(GRAFFITI.PANEL + noise * blend);
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // Four strokes of a tag: a rise, a loop that never closes, a hard baseline.
    // The paint is faded primer, not a fresh can.
    const strokes: number[][][] = [
        [[9, 22], [13, 12], [17, 21]],
        [[19, 12], [24, 20], [28, 11], [31, 21]],
        [[33, 21], [36, 10], [40, 20], [44, 12]],
        [[12, 25], [42, 24]]
    ];
    strokes.forEach((points, index) => {
        ctx.strokeStyle = gray(index === strokes.length - 1 ? GRAFFITI.PAINT_EDGE : GRAFFITI.PAINT);
        ctx.lineWidth = GRAFFITI.STROKE;
        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        for (let point = 1; point < points.length; point++) ctx.lineTo(points[point][0], points[point][1]);
        ctx.stroke();
    });
});

export const KHRUSHCHYOVKA_TEXTURES = {
    panelWall,
    sidePanel,
    plinthConcrete,
    windowDark,
    windowCracked,
    windowEmpty,
    windowBoarded,
    sootPlume,
    roofTar,
    balconySlate,
    rustMetal,
    wallStain,
    panelSpall,
    graffitiTag
};
