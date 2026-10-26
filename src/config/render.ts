// Rendering, camera, atmosphere and post-processing tuning constants.
import { COLORS } from './colors.js';

// Night haze. Fog is exponential-squared, because a linear near/far pair cannot
// describe a 108 m slab: the old `Fog(58, 210)` started past the far kerb, so the
// courtyard never fogged at all. DENSITY is the only value that changes between
// camera modes and it is expressed the way three's FogExp2 reads it, so the
// built-in materials and the custom surface shader dissolve into one haze.
//
// HEIGHT folds the fog down toward the ground (a snow haze lying in the yard),
// NOISE makes it drift in banks instead of a uniform veil. Both are extra terms
// applied identically in every custom shader (core/shaders/fog.ts), never a
// second fog model.
export const FOG = {
    COLOR: COLORS.FOG,
    // Frost haze: denser than the first pass (≈35 % at the 66 m isometric
    // distance, 88 % at 150 m), so the yard visibly cools with distance. The
    // overview retreats several hundred metres and needs much thinner air, or the
    // whole island dissolves into a flat fog-coloured diamond.
    DENSITY: { GAME: 0.0135, OVERVIEW: 0.0022, FP: 0.0058 },
    // Falloff in 1/m above the ground plane, and how much of the haze obeys it.
    HEIGHT: { FALLOFF: 0.1, MIX: 0.7 },
    // Bank scale in 1/m, drift speed in m/s, and the shape of the modulation:
    // BANK_BASE / BANK_GAIN widen the noise range around 1 before AMOUNT blends it
    // in. A bank factor of exactly 1 everywhere is a flat veil, not a bank.
    NOISE: { SCALE: 0.07, AMOUNT: 0.36, DRIFT_X: 0.35, DRIFT_Z: 0.12, BANK_BASE: 0.55, BANK_GAIN: 0.9 }
} as const;

// Night light model of the surface shader. There is no three.js light in the
// scene: ambient, moon and every practical are evaluated per fragment from the
// shared uniform block (core/atmosphere.ts).
// - SKY/GROUND build the hemisphere gradient, so a roof and a wall face read as
//   different surfaces while both stay dark.
// - MOON is the only directional source; the azimuth is the same one the old
//   overcast key light used, so the form shading of every volume does not flip.
// - FILL is the sky term from the anti-moon side. Without it every face turned
//   away from the moon falls to the ambient floor and the walker stops being the
//   brightest silhouette of the frame as soon as the camera orbits behind it.
export const NIGHT = {
    MOON: {
        COLOR: COLORS.MOON_LIGHT,
        INTENSITY: 0.60,
        DIRECTION: { x: 16, y: 52, z: 14 }
    },
    SKY: { COLOR: COLORS.SKY_AMBIENT, INTENSITY: 1.34 },
    GROUND: { COLOR: COLORS.GROUND_BOUNCE, INTENSITY: 0.60 },
    FILL: { COLOR: COLORS.SKY_AMBIENT, INTENSITY: 0.21, DIRECTION: { x: -16, y: 30, z: -14 } },
    // Steep gradient: a roof takes the whole sky dome, a wall barely a third of
    // it. That difference is what separates the volumes at night. FLOOR is the
    // flat term that keeps a down-facing face out of the background tone; the void
    // materials carry true black instead.
    AMBIENT: { HEMISPHERE_EXP: 0.9, FLOOR: 0.015 },
    // The two night budgets, and the only place "how dark is the night" is set.
    // - SURFACE scales the light the sky gives a surface: hemisphere, moon, fill
    //   and the ambient floor.
    // - SKY scales the air itself: the haze colour, the backdrop and the horizon
    //   of the sky pass (render/sky.ts).
    // Practicals (lamps, the searchlight, emissive parts and every additive
    // overlay) are deliberately OUTSIDE both: they are the artificial light of the
    // scene, so darkening the sky raises their contrast instead of dimming them
    // with everything else.
    // The RATIO between the two is the silhouette budget. Hazy air has to stay
    // lighter than the surfaces standing in it, otherwise a roof, the walker and
    // the island edge dissolve into one black field; that ratio is what is left of
    // them when the mean drops to 0.026.
    EXPOSURE: { SURFACE: 0.20, SKY: 0.25 },
    // One number for the whole artificial layer: halo and ground-pool opacity, the
    // searchlight cones and the lamp lenses. As the sky drops, the additive layer
    // has to drop with it, or the frame becomes a black field with white blobs on
    // it instead of a dark courtyard with lights in it.
    PRACTICAL_SCALE: 0.55,
    // Backdrop gradient of the sky pass (render/sky.ts). The horizon is the haze
    // colour itself, so a fully fogged surface meets the sky without a seam; the
    // zenith is darker, and that difference is the silhouette -- the only reason a
    // roof line and the walker still read when the frame is nearly black.
    // HORIZON_SPREAD is the height of the band in frame fractions: below the
    // horizon the horizon tone simply continues.
    BACKDROP: { ZENITH_GAIN: 0.45, HORIZON_SPREAD: 0.35 },
    // Emissive is modulated by the albedo (so a lit window keeps its frame and
    // crossbar instead of becoming a flat rectangle), which costs most of its
    // brightness. The boost is what turns a 50 % grey pane into a light source.
    EMISSIVE_BOOST: 2.2,
    // "Night shader off" diagnostic (?night=off, key N). Plain neutral studio
    // light: flat ambient plus one white key, no moon tint, no lamps, no emissive
    // and no fog. It exists so the geometry and the albedo can be inspected without
    // the night model — that is how a regression in the look is told apart from a
    // regression in the tuning.
    OFF: { AMBIENT: 0.6, DIRECT: 0.72 }
} as const;

// Local lights. MAX is the size of the shader's uniform array: every static
// fixture (7), the three dynamic mech entries, the pilot's headlamp and the
// battery bulbs of the interiors (a stairwell and a flat hall for each of the
// three opened porches) have to fit in it.
export const LAMPS = {
    // Static fixtures, mech lights, interior bulbs and the pilot's headlamp.
    MAX: 17,
    // Spot share of the cone: 0 = hard edge, 1 = the cone fades over its whole
    // angle. Used to build cosInner from cosOuter.
    CONE_INNER_RATIO: 0.45,
    // Wrapped lambert: how much of N·L survives when a face points away from the
    // lamp. 1 = plain lambert (a black wedge on every corner), 0 = no direction at
    // all. 0.7 keeps the modelling and still leaves the albedo readable.
    WRAP: 0.8
} as const;

export const CAMERA = {
    INITIAL_FOV: 22,
    ISO_FOV: 21,
    FP_FOV: 72,
    NEAR: 0.2,
    FAR: 400,
    INITIAL_ASPECT: 1.5,
    ISO_DISTANCE: 66,
    // 46 m was solved against the old 5 × 3.0 m block: with the 30 % taller
    // storeys (5 × 3.9 m) the NE block's roof crosses the sightline and hides
    // the walker at spawn. 70 m keeps the same 45° orbit and lifts the sightline
    // back over the roof (pitch 35° → 47°). Re-solve this if the storey or the
    // spawn moves again.
    ISO_HEIGHT: 70,
    ISO_LOOK_HEIGHT: 2.2,
    // At 108 m the walker can cross half the island; following it at 0.38 would
    // push it out of the narrow 21° frame, so the camera travels most of the way.
    ISO_FOLLOW_RATIO: 0.85,
    // 1.18 m eye line corresponds to an 11-year-old child standing in boots.
    // At this height, doors (2.05 m), ceilings (3.64 m) and window sills (0.8 m)
    // feel spacious, tall and natural, enlarging the relative scale of the world by ~35%.
    FP_EYE_HEIGHT: 1.18,
    FP_HEAD_BOB: 0.04,
    FP_LOOK_DISTANCE: 10,
    YAW_INTERPOLATION: 6,
    ZOOM_INTERPOLATION: 10
} as const;

// Overview pose: same orbit yaw as the isometric camera, steeper pitch, and the
// distance is solved at runtime so the slab plus its rooftops always fits the
// frame with a fixed margin (TZ §11.3).
export const OVERVIEW = {
    PITCH: 0.92,
    FOV: 30,
    MARGIN: 0.1,
    TOP_HEIGHT: 18,
    LOOK_HEIGHT: 0,
    MIN_DISTANCE: 80,
    MAX_DISTANCE: 400,
    STEP: 2,
    BLEND_RATE: 4,
    // A narrow window pushes the solved distance past CAMERA.FAR; the far plane
    // follows it so the far corner of the slab is never clipped.
    FAR_RATIO: 1.4
} as const;

// The searchlight's additive ground pool. It is not shadow-mapped geometry: the
// plane is lifted just above the highest surface under its own footprint and
// pushed toward the camera in depth, so a pool can never fight the pavement it
// lies on. The gap only has to absorb the sampling error of the surface field
// (one overlay plane cannot follow a 4 cm relief). SAMPLE_* is also read by the
// surface field itself.
export const GROUND_OVERLAY = {
    GAP: 0.025,
    SAMPLE_MARGIN: 0.006,
    SAMPLE_SPACING: 1.5,
    // The cap must stay above the longest footprint / spacing, otherwise a 60 m
    // plate is sampled every 7 m and the relief between samples reads wrong.
    SAMPLES_PER_AXIS: [3, 48],
    POOL_RENDER_ORDER: 5,
    // Stronger polygon offset to push overlays firmly behind the depth surface,
    // eliminating the pixel-level flickering at the border of each pool.
    POLYGON_OFFSET_FACTOR: -2,
    POLYGON_OFFSET_UNITS: -2
} as const;

// Ground textures are minified to a sub-texel scale at the far kerb. With plain
// NearestFilter their slab joints alias into a crawling dotted lattice, which the
// quantizer then amplifies into bands — the ground flicker that survives every
// depth fix. Mipmaps are the only way to filter that away.
// Anisotropy is deliberately 1: an anisotropic footprint keeps the joints sharp
// but under-sampled along the view direction, which brings the dots straight back.
export const TEXTURE = {
    MAX_ANISOTROPY: 1
} as const;

// PlayStation 1 internal framebuffer and vertex quantization.
export const PS1 = {
    FRAME_HEIGHT: 256,
    DEFAULT_WIDTH: 384,
    MIN_WIDTH: 240,
    VERTEX_SNAP_RESOLUTION: 120
} as const;

// Night grade of the 2D display canvas (render/gradeShader.ts). Values are in
// 0..255 display units so the curve can be read against the old CPU pass, and the
// anchors are pinned to the night's own operating window: at EXPOSURE 0.20 / 0.25
// the whole courtyard sits below tone 20, so the toe starts there:
// - the toe COMPRESSES the shadows (0.65): the yard has to sit near the void, not
//   above it;
// - above the toe the midtones keep a 1.18 gain, so a lamp pool and the searchlight
//   still separate from the dark;
// - the knee starts above the brightest lit surface and tapers at 0.72, which puts
//   a lamp core at ~210: bright enough to read as a light, below the quantizer's
//   flat white, so a halo never becomes a white blob.
// Tint is a chromaticity multiplier applied to the quantized level: cold blue in
// the shadows, warm sodium in the highlights. Luminance is still the only signal
// that travels through the curve.
export const POST_PROCESS = {
    LUMA_R: 0.299,
    LUMA_G: 0.587,
    LUMA_B: 0.114,
    // Where the shadows end: the darkest courtyard tone is under 20, everything
    // above it is a practical or a snow cap.
    SHADOW_THRESHOLD: 20,
    SHADOW_SCALE: 0.65,
    // 20 x 0.65: the curve is continuous at the toe anchor.
    MID_OFFSET: 13.0,
    MID_SCALE: 1.18,
    HIGHLIGHT_THRESHOLD: 90,
    // 13 + (90 - 20) x 1.18: continuous at the knee as well.
    HIGHLIGHT_OFFSET: 95.6,
    HIGHLIGHT_SCALE: 0.72,
    // Dither is one quantum wide: 8 * 0.125 / 255 of full scale, i.e. exactly the
    // 2/255 step of QUANTIZE_STEP. Anything wider paints a checkerboard.
    DITHER_MIN: 10,
    DITHER_MAX: 245,
    DITHER_WEIGHT: 0.125,
    MIN_LEVEL: 2,
    MAX_LEVEL: 252,
    // 7-bit steps: the courtyard sits around tone 5, where a 4-level step would be
    // most of its brightness and the dither mixing it reads as a hard checkerboard.
    QUANTIZE_STEP: 2,
    // At 12 display levels a 26 % vignette is the whole silhouette budget of the
    // corners, so it is barely a hint now: enough to bend the frame, not enough to
    // erase a rooftop.
    VIGNETTE: { INNER: 0.72, OUTER: 1.12, STRENGTH: 0.12 },
    SHADOW_TINT: { r: 0.42, g: 0.52, b: 0.66 },
    HIGHLIGHT_TINT: { r: 1, g: 0.95, b: 0.86 }
} as const;

export const FRAME = {
    MAX_DELTA: 0.05
} as const;

// Debug frame meter (?perf): rolling window, how often the readout refreshes, and
// the night contract of the finished frame (see docs/ATMOSPHERE.md).
// The band is the measurable form of "a dark night with barely visible
// silhouettes", and it has to hold in every camera pose, so each number is the
// widest reading of the four measured states (isometric spawn, orbit, overview,
// first person):
// - MEAN: the frame is dark -- 0.028 spawn, 0.038 orbit, 0.034 overview, 0.032 FP;
// - P99: nothing but a practical core is bright -- 0.13 spawn, 0.26 orbit (the
//   searchlight cone), 0.10 overview, 0.28 FP;
// - SEP: p95 - p50, the tonal structure a silhouette is read against -- 6 levels at
//   the spawn, 27 in the orbit, 2 in the overview, 31 in first person. The mean and
//   the p99 are the verdict; sep is judged only for "there is structure, but no
//   poster", because its meaning depends on the pose.
export const FRAME_METER = {
    SAMPLES: 120,
    UPDATE_SECONDS: 0.25,
    LUMA: {
        MEAN_MIN: 0.018,
        MEAN_MAX: 0.045,
        P99_MAX: 0.34,
        SEPARATION_MIN: 0.004,
        SEPARATION_MAX: 0.13
    }
} as const;
