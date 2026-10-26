// Pixel skin of the interiors: painted plaster, worn lino, whitewash, stair
// concrete and the door leaf. Same factory, same nearest filtering and the same
// monochrome-noise grammar as the facade, so an interior wall and a facade panel
// belong to one drawing. The window pane is not here: an interior window shows the
// very sash texture the facade draws (KHRUSHCHYOVKA_TEXTURES.windowDark).
import { createPixelTexture, gray } from '../../core/pixelTexture.js';
import { createSeededRandom } from '../../core/random.js';

// Own generators: the facade's sequence is shared and must not shift when an
// interior texture is added.
const plasterRand = createSeededRandom(7411);
const linoRand = createSeededRandom(7477);
const washRand = createSeededRandom(7531);
const stepRand = createSeededRandom(7583);
const woodRand = createSeededRandom(7643);

const PLASTER = {
    SIZE: 64,
    BASE: 132,
    NOISE: 14,
    // Damp that creeps up from the floor: the bottom rows are darker and blotchy.
    DAMP_HEIGHT: 0.28,
    DAMP_DROP: 20,
    DAMP_BLOTCH: 12,
    // One hairline crack, drawn as a stepped polyline so it reads at 64 px.
    CRACK: 96,
    CRACK_TONE: 96
};

const LINO = {
    SIZE: 32,
    BASE: 118,
    NOISE: 16,
    // Sheet joints of the linoleum: one texel every 16, darker.
    JOINT_STEP: 16,
    JOINT_DROP: 26,
    // Worn traffic lane: a broad diagonal band, lighter than the field.
    TRAFFIC_GAIN: 8
};

const WHITEWASH = {
    SIZE: 32,
    BASE: 164,
    NOISE: 12,
    // Water that came through the slab above and dried in rings.
    RING: 18,
    RING_DROP: 16
};

const STEP = {
    SIZE: 32,
    BASE: 96,
    NOISE: 18,
    AGGREGATE_CHANCE: 0.9,
    AGGREGATE_DROP: 22
};

const WOOD = {
    SIZE: 32,
    BASE: 108,
    NOISE: 10,
    GRAIN_STEP: 3,
    GRAIN_GAIN: 14
};

const plaster = createPixelTexture(PLASTER.SIZE, PLASTER.SIZE, (ctx, w, h) => {
    for (let y = 0; y < h; y++) {
        const fromFloor = 1 - y / h;
        const damp = fromFloor > 1 - PLASTER.DAMP_HEIGHT ? PLASTER.DAMP_DROP * ((fromFloor - (1 - PLASTER.DAMP_HEIGHT)) / PLASTER.DAMP_HEIGHT) : 0;
        for (let x = 0; x < w; x++) {
            const blotch = damp > 0 ? (plasterRand() - 0.5) * PLASTER.DAMP_BLOTCH : 0;
            ctx.fillStyle = gray(PLASTER.BASE + (plasterRand() - 0.5) * PLASTER.NOISE - damp + blotch);
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // A crack from the ceiling toward the middle of the panel: three steps, so it
    // never reads as a straight scratch.
    ctx.strokeStyle = gray(PLASTER.CRACK);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 2);
    ctx.lineTo(36, 18);
    ctx.lineTo(39, 31);
    ctx.lineTo(33, 46);
    ctx.stroke();
});

const lino = createPixelTexture(LINO.SIZE, LINO.SIZE, (ctx, w, h) => {
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const joint = x % LINO.JOINT_STEP === 0 || y % LINO.JOINT_STEP === 0 ? -LINO.JOINT_DROP : 0;
            const traffic = Math.abs(x - y) < 5 ? LINO.TRAFFIC_GAIN : 0;
            ctx.fillStyle = gray(LINO.BASE + (linoRand() - 0.5) * LINO.NOISE + joint + traffic);
            ctx.fillRect(x, y, 1, 1);
        }
    }
});

const whitewash = createPixelTexture(WHITEWASH.SIZE, WHITEWASH.SIZE, (ctx, w, h) => {
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            ctx.fillStyle = gray(WHITEWASH.BASE + (washRand() - 0.5) * WHITEWASH.NOISE);
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // Two dried-through rings of the leak above.
    [11, 24].forEach((radius, index) => {
        ctx.strokeStyle = gray(WHITEWASH.BASE - WHITEWASH.RING + index * 4);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(9 + index * 13, 8 + index * 6, radius * 0.45, 0, Math.PI * 2);
        ctx.stroke();
    });
    ctx.fillStyle = gray(WHITEWASH.BASE - WHITEWASH.RING_DROP);
    ctx.fillRect(20, 22, 3, 2);
});

const stepConcrete = createPixelTexture(STEP.SIZE, STEP.SIZE, (ctx, w, h) => {
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const aggregate = stepRand() > STEP.AGGREGATE_CHANCE ? -STEP.AGGREGATE_DROP : 0;
            ctx.fillStyle = gray(STEP.BASE + (stepRand() - 0.5) * STEP.NOISE + aggregate);
            ctx.fillRect(x, y, 1, 1);
        }
    }
});

const doorWood = createPixelTexture(WOOD.SIZE, WOOD.SIZE, (ctx, w, h) => {
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const grain = (y % WOOD.GRAIN_STEP === 0 ? -WOOD.GRAIN_GAIN : 0) + Math.sin(x * 0.7 + y * 0.2) * 3;
            ctx.fillStyle = gray(WOOD.BASE + (woodRand() - 0.5) * WOOD.NOISE + grain);
            ctx.fillRect(x, y, 1, 1);
        }
    }
});

export const INTERIOR_TEXTURES = {
    plaster,
    lino,
    whitewash,
    stepConcrete,
    doorWood
};
