// Monochrome pixel-art skin of the «ВНИИТЭ-68» walker, ported from the reference
// mexa.html: 1960s Soviet aero panels, dark structural armour with weld seams,
// patchwork sheet metal, the armoured flank door, its «68» stencil and the
// cathode visor / optical dome that read as the only lit sensors of the hull.
// Everything is drawn once at module load from one fixed seed.
import { createPixelTexture, gray } from '../core/pixelTexture.js';
import { createSeededRandom } from '../core/random.js';
import type { CanvasTexture } from 'three';

const NOISE_SEED = 1969;

const rand = createSeededRandom(NOISE_SEED);

interface ShadeArgs {
    x: number;
    y: number;
    width: number;
    height: number;
    noise: number;
}

// One texel per iteration, so every panel keeps the crisp nearest-filtered grain
// of the reference model instead of a smooth gradient.
function paintNoise(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    noiseAmplitude: number,
    shade: (args: ShadeArgs) => number
): void {
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const noise = (rand() - 0.5) * noiseAmplitude;
            const level = shade({ x, y, width, height, noise });
            ctx.fillStyle = gray(level);
            ctx.fillRect(x, y, 1, 1);
        }
    }
}

function strokeRect(ctx: CanvasRenderingContext2D, inset: number, width: number, height: number, color: string, lineWidth: number): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
}

const AERO = {
    SIZE: 64,
    BASE: 118,
    NOISE: 14,
    GRADIENT: 34,
    MIN: 25,
    MAX: 245,
    BAND_Y: 14,
    BAND_HEIGHT: 5,
    BAND_COLOR: '#e2e2e2',
    SEAM_Y: 19,
    SEAM_HEIGHT: 2,
    SEAM_COLOR: '#222222',
    BORDER_COLOR: '#262626',
    BORDER_WIDTH: 2,
    RIVET_START: 6,
    RIVET_STEP: 8,
    RIVET_SIZE: 2,
    RIVET_TOP_Y: 4,
    RIVET_BOTTOM_INSET: 6,
    RIVET_LIGHT: '#efefef',
    RIVET_DARK: '#1f1f1f'
};

// 1960s-70s Soviet industrial light-grey hull armour with a bright top bevel.
const aeroPanelTex = createPixelTexture(AERO.SIZE, AERO.SIZE, (ctx, w, h) => {
    paintNoise(ctx, w, h, AERO.NOISE, ({ y, noise }) => {
        const vertical = (1 - y / h) * AERO.GRADIENT;
        return Math.min(AERO.MAX, Math.max(AERO.MIN, AERO.BASE + vertical + noise));
    });

    ctx.fillStyle = AERO.BAND_COLOR;
    ctx.fillRect(0, AERO.BAND_Y, w, AERO.BAND_HEIGHT);
    ctx.fillStyle = AERO.SEAM_COLOR;
    ctx.fillRect(0, AERO.SEAM_Y, w, AERO.SEAM_HEIGHT);
    strokeRect(ctx, 1, w, h, AERO.BORDER_COLOR, AERO.BORDER_WIDTH);

    for (let x = AERO.RIVET_START; x < w - AERO.RIVET_SIZE; x += AERO.RIVET_STEP) {
        ctx.fillStyle = AERO.RIVET_LIGHT;
        ctx.fillRect(x, AERO.RIVET_TOP_Y, AERO.RIVET_SIZE, AERO.RIVET_SIZE);
        ctx.fillStyle = AERO.RIVET_DARK;
        ctx.fillRect(x, h - AERO.RIVET_BOTTOM_INSET, AERO.RIVET_SIZE, AERO.RIVET_SIZE);
    }
});

const DARK = {
    SIZE: 64,
    BASE: 58,
    NOISE: 16,
    MIN: 12,
    MAX: 180,
    BORDER_COLOR: '#141414',
    BORDER_WIDTH: 2,
    BOLT_START: 4,
    BOLT_STEP: 5,
    BOLT_WIDTH: 2,
    BOLT_HEIGHT: 3,
    BOLT_TOP_Y: 2,
    BOLT_BOTTOM_INSET: 5,
    BOLT_LIGHT: '#b0b0b0',
    BOLT_DARK: '#262626'
};

// Dark charcoal heavy structural armour with field weld seams.
const darkIndustrialTex = createPixelTexture(DARK.SIZE, DARK.SIZE, (ctx, w, h) => {
    paintNoise(ctx, w, h, DARK.NOISE, ({ noise }) => Math.min(DARK.MAX, Math.max(DARK.MIN, DARK.BASE + noise)));
    strokeRect(ctx, 1, w, h, DARK.BORDER_COLOR, DARK.BORDER_WIDTH);

    for (let x = DARK.BOLT_START; x < w - DARK.BOLT_START; x += DARK.BOLT_STEP) {
        ctx.fillStyle = x % 2 === 0 ? DARK.BOLT_LIGHT : DARK.BOLT_DARK;
        ctx.fillRect(x, DARK.BOLT_TOP_Y, DARK.BOLT_WIDTH, DARK.BOLT_HEIGHT);
        ctx.fillRect(x, h - DARK.BOLT_BOTTOM_INSET, DARK.BOLT_WIDTH, DARK.BOLT_HEIGHT);
    }
});

const PATCH = {
    SIZE: 64,
    BASE: 96,
    NOISE: 14,
    MIN: 18,
    MAX: 235,
    RIB_PERIOD: 5,
    RIB_AMPLITUDE: 22,
    PLATE_EDGE: { x: 30, y: 24 },
    PLATE_LIFT: 28,
    PLATE_DROP: -10,
    BORDER_INSET: 2,
    BORDER_COLOR: '#181818',
    BORDER_WIDTH: 2,
    PLATE_WIDTH: 32,
    PLATE_HEIGHT: 38
};

// Artisanal corrugated and patchwork sheet metal of the field repairs.
const patchworkMetalTex = createPixelTexture(PATCH.SIZE, PATCH.SIZE, (ctx, w, h) => {
    paintNoise(ctx, w, h, PATCH.NOISE, ({ x, y, noise }) => {
        const rib = Math.sin((x / PATCH.RIB_PERIOD) * Math.PI * 2) * PATCH.RIB_AMPLITUDE;
        const patched = x > PATCH.PLATE_EDGE.x && y > PATCH.PLATE_EDGE.y;
        const patch = patched ? PATCH.PLATE_LIFT : PATCH.PLATE_DROP;
        return Math.min(PATCH.MAX, Math.max(PATCH.MIN, PATCH.BASE + rib + patch + noise));
    });

    strokeRect(ctx, PATCH.BORDER_INSET, w, h, PATCH.BORDER_COLOR, PATCH.BORDER_WIDTH);
    ctx.strokeStyle = PATCH.BORDER_COLOR;
    ctx.lineWidth = PATCH.BORDER_WIDTH;
    ctx.strokeRect(PATCH.PLATE_EDGE.x, PATCH.PLATE_EDGE.y, PATCH.PLATE_WIDTH, PATCH.PLATE_HEIGHT);
});

const VISOR = {
    WIDTH: 64,
    HEIGHT: 32,
    BACKGROUND: '#1a1a1a',
    BORDER_COLOR: '#0d0d0d',
    BORDER_WIDTH: 3,
    ROW_TOP: 10,
    ROW_BOTTOM: 22,
    CENTER_Y: 16,
    GLOW_BASE: 250,
    GLOW_FALLOFF: 22,
    BAR_PERIOD: 6,
    BAR_DROP: 70,
    MIN: 24,
    MAX: 255,
    SIDE_INSET: 8
};

// 1960s Soviet retro-futuristic cathode vision slit: a horizontal glowing raster.
const cathodeVisorTex = createPixelTexture(VISOR.WIDTH, VISOR.HEIGHT, (ctx, w, h) => {
    ctx.fillStyle = VISOR.BACKGROUND;
    ctx.fillRect(0, 0, w, h);
    strokeRect(ctx, 1, w, h, VISOR.BORDER_COLOR, VISOR.BORDER_WIDTH);

    for (let y = VISOR.ROW_TOP; y <= VISOR.ROW_BOTTOM; y++) {
        for (let x = VISOR.SIDE_INSET; x < w - VISOR.SIDE_INSET; x++) {
            const glow = VISOR.GLOW_BASE - Math.abs(y - VISOR.CENTER_Y) * VISOR.GLOW_FALLOFF;
            const bar = x % VISOR.BAR_PERIOD === 0 ? -VISOR.BAR_DROP : 0;
            ctx.fillStyle = gray(Math.max(VISOR.MIN, Math.min(VISOR.MAX, glow + bar)));
            ctx.fillRect(x, y, 1, 1);
        }
    }
});

const DOME = {
    SIZE: 32,
    CENTER: 16,
    CORE_RADIUS: 4,
    RING_RADIUS: 8,
    OUTER_RADIUS: 11,
    BASE: 35,
    CORE: 250,
    RING: 45,
    OUTER: 195,
    RIM: 25
};

// «Луноход» / ВНИИТЭ optical photometer lens: concentric rings of a glass dome.
const opticalDomeTex = createPixelTexture(DOME.SIZE, DOME.SIZE, (ctx, w, h) => {
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const distance = Math.hypot(x - DOME.CENTER, y - DOME.CENTER);
            let level = DOME.BASE;
            if (distance < DOME.CORE_RADIUS) level = DOME.CORE;
            else if (distance < DOME.RING_RADIUS) level = DOME.RING;
            else if (distance < DOME.OUTER_RADIUS) level = DOME.OUTER;
            else level = DOME.RIM;
            ctx.fillStyle = gray(level);
            ctx.fillRect(x, y, 1, 1);
        }
    }
});

const DOOR = {
    SIZE: 64,
    BASE: 108,
    NOISE: 14,
    MIN: 30,
    MAX: 220,
    SEAL_INSET: 2,
    SEAL_WIDTH: 4,
    SEAL_COLOR: '#181818',
    TRIM_INSET: 6,
    TRIM_WIDTH: 1,
    TRIM_COLOR: '#dcdcdc',
    STAMP: { x: 12, y: 32, width: 40, height: 22 },
    STAMP_COLOR: '#2a2a2a',
    STAMP_WIDTH: 3,
    HAZARD_Y_INSET: 10,
    HAZARD_HEIGHT: 4,
    HAZARD_STEP: 8,
    HAZARD_LIGHT: '#e5e5e5',
    HAZARD_DARK: '#1a1a1a'
};

// Heavy stamped armoured blast door with a rubber seal and hazard threshold.
const armoredDoorTex = createPixelTexture(DOOR.SIZE, DOOR.SIZE, (ctx, w, h) => {
    paintNoise(ctx, w, h, DOOR.NOISE, ({ noise }) => Math.min(DOOR.MAX, Math.max(DOOR.MIN, DOOR.BASE + noise)));

    strokeRect(ctx, DOOR.SEAL_INSET, w, h, DOOR.SEAL_COLOR, DOOR.SEAL_WIDTH);
    strokeRect(ctx, DOOR.TRIM_INSET, w, h, DOOR.TRIM_COLOR, DOOR.TRIM_WIDTH);

    ctx.strokeStyle = DOOR.STAMP_COLOR;
    ctx.lineWidth = DOOR.STAMP_WIDTH;
    ctx.strokeRect(DOOR.STAMP.x, DOOR.STAMP.y, DOOR.STAMP.width, DOOR.STAMP.height);
    ctx.beginPath();
    ctx.moveTo(DOOR.STAMP.x + 2, DOOR.STAMP.y + 2);
    ctx.lineTo(DOOR.STAMP.x + DOOR.STAMP.width - 2, DOOR.STAMP.y + DOOR.STAMP.height - 2);
    ctx.moveTo(DOOR.STAMP.x + DOOR.STAMP.width - 2, DOOR.STAMP.y + 2);
    ctx.lineTo(DOOR.STAMP.x + 2, DOOR.STAMP.y + DOOR.STAMP.height - 2);
    ctx.stroke();

    for (let x = DOOR.HAZARD_STEP; x < w - DOOR.HAZARD_STEP; x += DOOR.HAZARD_STEP) {
        ctx.fillStyle = DOOR.HAZARD_LIGHT;
        ctx.fillRect(x, h - DOOR.HAZARD_Y_INSET, DOOR.HAZARD_HEIGHT, DOOR.HAZARD_HEIGHT);
        ctx.fillStyle = DOOR.HAZARD_DARK;
        ctx.fillRect(x + DOOR.HAZARD_HEIGHT, h - DOOR.HAZARD_Y_INSET, DOOR.HAZARD_HEIGHT, DOOR.HAZARD_HEIGHT);
    }
});

const PLATE = {
    WIDTH: 64,
    HEIGHT: 32,
    BACKGROUND: '#242424',
    BORDER_COLOR: '#d8d8d8',
    BORDER_INSET: 2,
    BORDER_WIDTH: 2,
    DIGIT_COLOR: '#efefef',
    DIGIT_Y: [6, 14, 22],
    BAR: 4,
    FIRST_X: 14,
    SECOND_X: 34,
    DIGIT_WIDTH: 14,
    DIGIT_HEIGHT: 20
};

// Soviet stencil «68» tactical number plate of the command tower's right cheek.
const numberPlateTex = createPixelTexture(PLATE.WIDTH, PLATE.HEIGHT, (ctx, w, h) => {
    ctx.fillStyle = PLATE.BACKGROUND;
    ctx.fillRect(0, 0, w, h);
    strokeRect(ctx, PLATE.BORDER_INSET, w, h, PLATE.BORDER_COLOR, PLATE.BORDER_WIDTH);

    ctx.fillStyle = PLATE.DIGIT_COLOR;
    const [top, middle, bottom] = PLATE.DIGIT_Y;
    // "6": full left stem, top/middle/bottom bars, lower right stem.
    ctx.fillRect(PLATE.FIRST_X, top, PLATE.DIGIT_WIDTH, PLATE.BAR);
    ctx.fillRect(PLATE.FIRST_X, top, PLATE.BAR, PLATE.DIGIT_HEIGHT);
    ctx.fillRect(PLATE.FIRST_X, middle, PLATE.DIGIT_WIDTH, PLATE.BAR);
    ctx.fillRect(PLATE.FIRST_X, bottom, PLATE.DIGIT_WIDTH, PLATE.BAR);
    ctx.fillRect(PLATE.FIRST_X + PLATE.DIGIT_WIDTH - PLATE.BAR, middle, PLATE.BAR, PLATE.DIGIT_HEIGHT - PLATE.BAR);
    // "8": both stems and all three bars.
    ctx.fillRect(PLATE.SECOND_X, top, PLATE.DIGIT_WIDTH, PLATE.BAR);
    ctx.fillRect(PLATE.SECOND_X, top, PLATE.BAR, PLATE.DIGIT_HEIGHT);
    ctx.fillRect(PLATE.SECOND_X + PLATE.DIGIT_WIDTH - PLATE.BAR, top, PLATE.BAR, PLATE.DIGIT_HEIGHT);
    ctx.fillRect(PLATE.SECOND_X, middle, PLATE.DIGIT_WIDTH, PLATE.BAR);
    ctx.fillRect(PLATE.SECOND_X, bottom, PLATE.DIGIT_WIDTH, PLATE.BAR);
});

export const mechTextures: {
    aeroPanel: CanvasTexture;
    darkIndustrial: CanvasTexture;
    patchMetal: CanvasTexture;
    cathodeVisor: CanvasTexture;
    opticalDome: CanvasTexture;
    armoredDoor: CanvasTexture;
    numberPlate: CanvasTexture;
} = {
    aeroPanel: aeroPanelTex,
    darkIndustrial: darkIndustrialTex,
    patchMetal: patchworkMetalTex,
    cathodeVisor: cathodeVisorTex,
    opticalDome: opticalDomeTex,
    armoredDoor: armoredDoorTex,
    numberPlate: numberPlateTex
};
