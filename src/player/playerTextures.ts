// Monochrome pixel-art skin of the heroine, ported from the reference
// vasilisa.html: frost-chilled skin, the creased hide of an old sheepskin tulup,
// curly fur trim, scratched helmet metal, canvas pack cloth, the patterned mitten
// knit and the wool used for the scarf, the hat, the leg wraps and the braids.
//
// Every texture is a grey level; the hue comes from the material palette in
// playerMaterials.ts, the same split the walker and the courtyard use. The
// reference's coloured texels and its one-pixel noise were replaced with the
// project's large-plate rule: at the PS1 buffer a one-texel speck boils into a
// dither checkerboard as soon as the camera moves.
import { createPixelTexture, gray } from '../core/pixelTexture.js';
import { createSeededRandom } from '../core/random.js';
import type { CanvasTexture } from 'three';

const SKIN = {
    SIZE: 32,
    BASE: 186,
    NOISE: 10,
    SEED: 0x11a3
} as const;

const skinTex = createPixelTexture(SKIN.SIZE, SKIN.SIZE, (ctx, w, h) => {
    const random = createSeededRandom(SKIN.SEED);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            ctx.fillStyle = gray(SKIN.BASE + (random() - 0.5) * SKIN.NOISE);
            ctx.fillRect(x, y, 1, 1);
        }
    }
});

const TULUP = {
    SIZE: 64,
    BASE: 84,
    CREASE: 9,
    NOISE: 14,
    SEAM_X: 31,
    SEAM_Y: 46,
    SEAM_DROP: -18,
    FROST_Y: 54,
    FROST: 20,
    FROST_SHARE: 0.45,
    SEED: 0x51b7
} as const;

const tulupHideTex = createPixelTexture(TULUP.SIZE, TULUP.SIZE, (ctx, w, h) => {
    const random = createSeededRandom(TULUP.SEED);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const crease = Math.sin(y * 0.25 + Math.cos(x * 0.2) * 1.6) * TULUP.CREASE;
            const seam = x === TULUP.SEAM_X || x === TULUP.SEAM_X + 1 || y === TULUP.SEAM_Y
                ? TULUP.SEAM_DROP
                : 0;
            const frost = y > TULUP.FROST_Y && random() > TULUP.FROST_SHARE ? TULUP.FROST : 0;
            ctx.fillStyle = gray(TULUP.BASE + crease + seam + frost + (random() - 0.5) * TULUP.NOISE);
            ctx.fillRect(x, y, 1, 1);
        }
    }
});

const SHEEPSKIN = {
    SIZE: 32,
    BASE: 138,
    CURL: 14,
    NOISE: 18,
    SEED: 0x2c41
} as const;

const sheepskinTex = createPixelTexture(SHEEPSKIN.SIZE, SHEEPSKIN.SIZE, (ctx, w, h) => {
    const random = createSeededRandom(SHEEPSKIN.SEED);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const curl = Math.sin(x * 1.2) * Math.cos(y * 1.2) * SHEEPSKIN.CURL;
            ctx.fillStyle = gray(SHEEPSKIN.BASE + curl + (random() - 0.5) * SHEEPSKIN.NOISE);
            ctx.fillRect(x, y, 1, 1);
        }
    }
});

const HELMET = {
    SIZE: 32,
    BASE: 68,
    NOISE: 14,
    SCRATCH_PERIOD: 19,
    SCRATCH: 24,
    RUST_PERIOD: 11,
    RUST: -12,
    SEED: 0x73d9
} as const;

const helmetMetalTex = createPixelTexture(HELMET.SIZE, HELMET.SIZE, (ctx, w, h) => {
    const random = createSeededRandom(HELMET.SEED);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const scratch = (x * 3 + y * 5) % HELMET.SCRATCH_PERIOD === 0 ? HELMET.SCRATCH : 0;
            const rust = (x + y) % HELMET.RUST_PERIOD === 0 ? HELMET.RUST : 0;
            ctx.fillStyle = gray(HELMET.BASE + scratch + rust + (random() - 0.5) * HELMET.NOISE);
            ctx.fillRect(x, y, 1, 1);
        }
    }
});

const CANVAS = {
    SIZE: 64,
    BASE: 74,
    WEAVE: 5,
    NOISE: 14,
    STITCH: -18,
    STITCH_X: 6,
    STITCH_Y: 8,
    SEED: 0x6b2f
} as const;

const canvasTex = createPixelTexture(CANVAS.SIZE, CANVAS.SIZE, (ctx, w, h) => {
    const random = createSeededRandom(CANVAS.SEED);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const weave = (x + y) % 2 === 0 ? CANVAS.WEAVE : -CANVAS.WEAVE;
            const stitch = x === CANVAS.STITCH_X
                || x === w - CANVAS.STITCH_X - 1
                || y === CANVAS.STITCH_Y
                || y === h - CANVAS.STITCH_Y - 1
                ? CANVAS.STITCH
                : 0;
            ctx.fillStyle = gray(CANVAS.BASE + weave + stitch + (random() - 0.5) * CANVAS.NOISE);
            ctx.fillRect(x, y, 1, 1);
        }
    }
});

const MITTEN = {
    SIZE: 32,
    BASE: 88,
    RIB: 5,
    NOISE: 8,
    CUFF_HEIGHT: 8,
    CUFF_LIFT: 22,
    BAND_TOP: 13,
    BAND_BOTTOM: 21,
    DIAMOND: 170,
    SEED: 0x4e13
} as const;

const mittenTex = createPixelTexture(MITTEN.SIZE, MITTEN.SIZE, (ctx, w, h) => {
    const random = createSeededRandom(MITTEN.SEED);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const rib = x % 2 === 0 ? MITTEN.RIB : -MITTEN.RIB;
            const cuff = y < MITTEN.CUFF_HEIGHT && x % 2 === 0;
            const band = y >= MITTEN.BAND_TOP && y <= MITTEN.BAND_BOTTOM;
            const diamond = band && ((x + y) % 4 === 0 || (x - y + w) % 4 === 0);
            let level = MITTEN.BASE + rib;
            if (cuff) level += MITTEN.CUFF_LIFT;
            else if (diamond) level = MITTEN.DIAMOND;
            ctx.fillStyle = gray(level + (random() - 0.5) * MITTEN.NOISE);
            ctx.fillRect(x, y, 1, 1);
        }
    }
});

const KNIT = {
    SIZE: 32,
    BASE: 96,
    RIB_PERIOD: 3,
    RIB_DROP: -12,
    ROW_LIFT: 6,
    NOISE: 9,
    SEED: 0x19c5
} as const;

const knitTex = createPixelTexture(KNIT.SIZE, KNIT.SIZE, (ctx, w, h) => {
    const random = createSeededRandom(KNIT.SEED);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const rib = x % KNIT.RIB_PERIOD === 0 ? KNIT.RIB_DROP : (y % 2 === 0 ? KNIT.ROW_LIFT : 0);
            ctx.fillStyle = gray(KNIT.BASE + rib + (random() - 0.5) * KNIT.NOISE);
            ctx.fillRect(x, y, 1, 1);
        }
    }
});

export const playerTextures: {
    skin: CanvasTexture;
    tulupHide: CanvasTexture;
    sheepskin: CanvasTexture;
    helmetMetal: CanvasTexture;
    canvas: CanvasTexture;
    mitten: CanvasTexture;
    knit: CanvasTexture;
} = {
    skin: skinTex,
    tulupHide: tulupHideTex,
    sheepskin: sheepskinTex,
    helmetMetal: helmetMetalTex,
    canvas: canvasTex,
    mitten: mittenTex,
    knit: knitTex
};
