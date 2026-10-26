// Central color palette: every literal color of the diorama lives here so that
// modules share a single source of truth instead of repeating hex values.
//
// The palette is a NIGHT palette. The value hierarchy of the frame is unchanged —
// the void behind the island is the darkest tone, the courtyard environment sits
// one step above it, the Mech stays the brightest silhouette — but every
// environment albedo was pulled down by roughly a third and shifted cool, because
// the light that used to be a flat overcast fill is now a weak moon plus a handful
// of warm practicals (see config/render.ts NIGHT and LAMPS). An albedo that was
// correct under 0.95 hemisphere fill burns out under a night sky exposed to 0.20.
//
// There is no background colour here on purpose: the backdrop is not a colour of
// the palette but the haze itself (COLORS.FOG through the SKY budget), so the sky,
// the horizon and the fog can never be three different tones.

export const COLORS = {
    // Atmosphere — the darkest layer of the frame
    // The haze is lighter than the void behind the island: at night the air itself
    // catches the moon, so distance reads as a pale blue veil instead of as a hole.
    // Everything far enough away dissolves into this tone, near things stay dark.
    // The void behind it is VOID below.
    FOG: 0x384a63,
    // Moonlight and the two halves of the hemisphere ambient. These are LIGHT
    // colours, not surface albedos: the shader multiplies them by an intensity and
    // then by the albedo of the surface, so they stay near white while the frame
    // stays dark.
    MOON_LIGHT: 0xa8bcd6,
    SKY_AMBIENT: 0x9fb2c8,
    GROUND_BOUNCE: 0x6a5b48,

    // "Чёрные провалы" — pure black voids, cracks and underside cavities
    VOID: 0x030405,
    VOID_SOFT: 0x060708,
    VOID_DEEP: 0x020304,

    // Structural accents
    HIGHLIGHT: 0x878d92,
    FRAME_DARK: 0x121417,
    GROUND: 0x7c8288,

    // Diorama base
    PEDESTAL: 0x0b0d0f,
    SUB_BASE: 0x050607,
    SIDE_PIPE: 0x191b1e,

    // Khrushchyovka
    FACADE: 0x7d8388,
    FACADE_SIDE: 0x42474c,
    // Gable end slabs: the same concrete as the panel field, only damp-stained,
    // so the block never reads as a bright front glued to a black side.
    BUILDING_SIDE: 0x6f757a,
    BUILDING_PLINTH: 0x4a4e52,
    CONCRETE_TRIM: 0x646a6e,
    BALCONY_SLATE: 0x787e81,
    BALCONY_WOOD: 0x7a7166,
    BUILDING_RUST: 0x726b62,
    GAS_PIPE: 0x5a5232,
    // No flat is lit: the windows are dead glass, cavities, shards and boards.
    // What still glows in the frame is the mech searchlight, the street lamps and
    // the porch bulb the two northern blocks kept alive.
    BUILDING_LAMP: 0xe6dec8,
    BUILDING_LAMP_EMISSIVE: 0xffe6c0,

    // Interiors. Eleven years without a caretaker: painted plaster gone beige and
    // grey-green, lino worn to a dull brown, whitewash yellowed, the concrete of
    // the stair grey. Everything stays under COLORS.MECH_HULL — a dark stairwell
    // is the point, and the walker outside keeps the brightest silhouette.
    INTERIOR_WALL: 0x6b675e,
    INTERIOR_CEILING: 0x77736b,
    INTERIOR_FLOOR: 0x584d41,
    INTERIOR_CONCRETE: 0x54585b,
    INTERIOR_WOOD: 0x4b3d30,
    INTERIOR_IRON: 0x14171a,
    // Dead glass of an interior window: the same sash the facade draws, seen from
    // the room side. Albedo only — the courtyard has had no light to emit since.
    INTERIOR_PANE: 0x8f989e,
    // One dying bulb per stairwell. Warm, weak and short-ranged: it has to read as
    // a battery lamp somebody left, not as a working porch light. It also has to
    // reach the halls of the flats: the surface shader carries no shadows, so the
    // light of the landing is the only light a room behind three walls will get.
    INTERIOR_LAMP: 0xffdca8,
    INTERIOR_LAMP_INTENSITY: 1.8,
    INTERIOR_LAMP_RANGE: 7.0,
    // Fill of the sky that comes through the windows, baked as a very dim
    // self-glow of the interior materials. It is three tones below the moonlit
    // courtyard and exists so a room without a lamp is dark, not blind.
    INTERIOR_FILL: 0x080806,

    // Fence / pipeline / utilities
    FENCE: 0x3a3f44,
    PIPELINE: 0x33373b,
    PIPELINE_UNDER: 0x0a0b0d,
    PIPELINE_PILLAR: 0x0e1013,

    // Playground
    RUST: 0x3b4045,
    METAL_DARK: 0x0e1012,
    CURB: 0x52575c,
    ROCKET_NOSE: 0x35393d,

    // Vegetation / props
    TREE_BARK: 0x0f1113,
    // Winter dressing: snow is an accent, not a surface. Every snow tone stays
    // below MECH_HULL so the walker remains the brightest silhouette of the frame,
    // and below the post-process highlight knee so a lit cap never rolls off into
    // flat white. Snow keeps more albedo than the concrete around it: under a
    // night sky it is the surface that actually catches the moon.
    SNOW: 0xb0b6ba,
    SNOW_SOIL: 0x6d7276,
    TREE_FROST: 0x7f858a,
    TREE_WHITEWASH: 0x9aa0a0,
    FENCE_WHITEWASH: 0xa8acac,
    IRON_FENCE: 0x14171a,
    MANHOLE: 0x212427,
    // Courtyard furniture: laundry posts, refuse containers and the one rug left
    // out to air. The rug is the only warm albedo in the yard, and it is dull on
    // purpose — a bright cloth would take the frame away from the mech.
    LAUNDRY_POLE: 0x2f3235,
    RUG: 0x6b4239,
    BIN: 0x2b2f33,
    // Winter road dressing: frozen ruts, tar repairs, ice plates and the iron of a
    // storm-water grate. All of them stay under COLORS.SNOW, so the snow caps are
    // still the brightest ground tone of the frame.
    ICE: 0x8b9296,
    TAR_PATCH: 0x33373b,
    GRATE_IRON: 0x14171a,
    ROAD_MARKING: 0x9aa0a3,
    CONCRETE: 0x3d4247,
    BARREL: 0x15181b,

    // Mech «ВНИИТЭ-68» (light-grey aero panels over dark cast iron). The dark
    // half of the palette stays above the courtyard albedo: at the isometric
    // distance the walker has to read as the brightest silhouette of the frame,
    // not dissolve into the asphalt it walks on.
    MECH_HULL: 0xc2c2c2,
    MECH_HULL_MID: 0x9a9a9a,
    MECH_HULL_DARK: 0x6e6e6e,
    MECH_PATCH: 0xaaaaaa,
    MECH_DOOR: 0xb0b0b0,
    MECH_PLATE: 0xffffff,
    MECH_STEEL: 0x2a2a2a,
    MECH_CAST_IRON: 0x454545,
    MECH_PISTON: 0xdcdcdc,
    MECH_ENAMEL: 0xededed,
    MECH_RIVET: 0xb5b5b5,
    // Self-lit monochrome sensors: the cathode visor, the optical dome and the
    // boarding plafond are the only parts of the hull that emit instead of reflect.
    MECH_VISOR_EMISSIVE: 0xa9c6e0,
    MECH_LENS_EMISSIVE: 0x8fa6c4,
    MECH_BEACON_EMISSIVE: 0xd8c08a,

    // First-person heroine. The tulup, the felt boots and the mittens are the
    // only warm albedos the night grade sees up close; every tone the FP camera
    // sees still sits below MECH_HULL, so the walker stays the brightest
    // silhouette of the isometric frame these parts never appear in. The
    // reference skin / sheepskin values were pulled down and shifted cool, the
    // same way the courtyard palette was.
    PLAYER_SKIN: 0xb3a094,
    PLAYER_SKIN_SHADOW: 0x87786d,
    PLAYER_SKIN_BLUSH: 0x966f6a,
    PLAYER_HAIR: 0x3a312a,
    PLAYER_HAIR_TIE: 0x673b37,
    PLAYER_TULUP: 0x574c40,
    PLAYER_TULUP_DARK: 0x41382f,
    PLAYER_TULUP_PATCH: 0x4a4f45,
    PLAYER_SHEEPSKIN: 0x8d8272,
    PLAYER_SHEEPSKIN_DIRTY: 0x71685c,
    PLAYER_SCARF: 0x675c52,
    PLAYER_HAT: 0x49433c,
    PLAYER_HAT_FUR: 0x7a7061,
    PLAYER_HELMET: 0x3f4449,
    PLAYER_HELMET_RIM: 0x2a2e32,
    PLAYER_LAMP_HOUSING: 0x222629,
    PLAYER_LAMP_LENS: 0x59636b,
    PLAYER_PANTS: 0x707882,
    PLAYER_FELT_BOOTS: 0x67625b,
    PLAYER_BOOT_SOLE: 0x33363b,
    PLAYER_LEG_WRAPS: 0x81776a,
    PLAYER_MITTENS: 0x86675f,
    PLAYER_MITTEN_CUFF: 0x625a52,
    PLAYER_CORD: 0x2f2a26,
    PLAYER_BACKPACK: 0x4b4f43,
    PLAYER_BACKPACK_FLAP: 0x3c4036,
    PLAYER_BACKPACK_POCKET: 0x42463b,
    PLAYER_STRAP: 0x232120,
    PLAYER_BUCKLE: 0x4a5158,
    PLAYER_BEDROLL: 0x4e453c,
    PLAYER_CHARM: 0x8a6743,
    PLAYER_EYE_SOCKET: 0x161518,
    PLAYER_EYE_DARK: 0x0c0c10,
    PLAYER_EYE_WHITE: 0x9aa4ad,
    PLAYER_EYE_HIGHLIGHT: 0xc8d2da,
    // The face is hidden from the first-person camera, so the cold breath and the
    // snow patch of the reference are not carried over: no contact decals.
    // A viewmodel fill keeps the mittens and the coat hem readable in a dark yard
    // and in an unlit stairwell: the camera-anchored body has no nearby practical
    // of its own, so it would otherwise fall to pure black on every unlit face.
    PLAYER_FILL: 0x252830,

    // Diegetic lights. The fixtures below are the only warm light in the frame:
    // sodium street lamps on the utility poles, the kiosk window, the two porch
    // bulbs. Everything else is moon or nothing.
    LAMP_SODIUM: 0xffc98a,
    LAMP_KIOSK: 0xffd9a8,
    LAMP_ENTRANCE: 0xffe6c0,
    HALO: 0xffd9a0,
    LAMP_HOUSING: 0x2a2d30,

    BOARDING_LAMP_IDLE: 0x383c3e,
    BOARDING_LAMP_OFF: 0x181a1c,
    BOARDING_LAMP_ON: 0xffffff,
    BOARDING_LAMP_DIM: 0x7a8084,
    SEARCHLIGHT: 0xfff0d4,
    BEAM_OUTER: 0xffe2b5,

    // Particles
    DUST_PUFF: 0x1a1c1e
} as const;
