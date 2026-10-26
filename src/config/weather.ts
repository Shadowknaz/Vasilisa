// Standalone winter atmosphere tuning. The weather system only needs a Scene, so
// it can be reused by another level without importing the diorama.
//
// The snowfall volume is anchored to the world, not to the camera: a flake that
// falls and a flake that is carried by the wind wrap inside the same box, so the
// field keeps a constant density and the flakes get a real parallax instead of
// travelling with the viewer.
export const WEATHER = {
    SNOW: {
        // The field covers the 108 m slab, so the budget is spread over ~3x the
        // volume the old camera-centred cloud used and is scaled to match it.
        COUNT: 1800,
        // Fixed seed: a reload and a pixel-scan comparison see the same flakes.
        SEED: 0x51a7,
        // Torus the flakes wrap in: half extents in x/z and the height above the
        // ground plane. 58 m covers the 54 m slab half with a margin.
        VOLUME: { HALF_X: 58, HALF_Z: 58, HEIGHT: 26 },
        FALL_SPEED: 2.8,
        WIND: { X: 0.7, Z: -0.35 },
        SIZE: { MIN: 1.2, MAX: 3.8 },
        // Projected flake size: `SIZE * SCALE / view depth`, clamped to
        // [1, MAX_PIXELS]. At the 79 m isometric distance the 1.2-3.8 range lands
        // on 1-3 px; closer to the pilot the clamp stops a flake from covering
        // the frame.
        POINT: { SCALE: 60, MAX_PIXELS: 5 },
        OPACITY: 0.74,
        COLOR: 0xc9d6df,
        // How much of a lamp's light a flake picks up as it crosses the pool. The
        // snowfall is what makes a night lamp read as a source rather than a decal.
        LAMP_TINT: 0.55
    }
} as const;
