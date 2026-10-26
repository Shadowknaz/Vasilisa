// Material palette of the first-person heroine. One instance per meaning, shared
// by the body, the camera-anchored arms and the hidden head, so a sleeve cuff and
// a coat lapel can never end up as two different greys.
//
// Every lit surface goes through makePS1Material: the night model, the PS1 vertex
// snap and the shared atmosphere uniforms come with it. `PLAYER_FILL` is the only
// emissive term — a two-tone self-glow that keeps the mittens readable in an
// unlit stairwell without turning her into a lamp outdoors.
import { COLORS } from '../config/colors.js';
import { makePS1Material } from '../core/ps1Material.js';
import { playerTextures } from './playerTextures.js';
import * as THREE from 'three';

export function createPlayerMaterials() {
    const fill = COLORS.PLAYER_FILL;

    const materials = {
        // Skin and face
        skin: makePS1Material({ map: playerTextures.skin, color: COLORS.PLAYER_SKIN, emissive: fill }),
        skinShadow: makePS1Material({ map: playerTextures.skin, color: COLORS.PLAYER_SKIN_SHADOW, emissive: fill }),
        skinBlush: makePS1Material({ map: playerTextures.skin, color: COLORS.PLAYER_SKIN_BLUSH, emissive: fill }),
        eyeSocket: makePS1Material({ color: COLORS.PLAYER_EYE_SOCKET }),
        eyeWhite: makePS1Material({ color: COLORS.PLAYER_EYE_WHITE }),
        eyeDark: makePS1Material({ color: COLORS.PLAYER_EYE_DARK }),
        eyeHighlight: makePS1Material({ color: COLORS.PLAYER_EYE_HIGHLIGHT }),
        hair: makePS1Material({ map: playerTextures.knit, color: COLORS.PLAYER_HAIR, emissive: fill }),
        hairTie: makePS1Material({ color: COLORS.PLAYER_HAIR_TIE, emissive: fill }),

        // Old sheepskin tulup, its patches and the fur trim. The coat shells are
        // open (a front slit, no end caps), so the tulup and the hem are two-sided:
        // from above the camera sees the inside of the coat around the legs instead
        // of a hole with the trim floating in it.
        tulup: makePS1Material({
            map: playerTextures.tulupHide,
            color: COLORS.PLAYER_TULUP,
            emissive: fill,
            side: THREE.DoubleSide
        }),
        tulupDark: makePS1Material({ map: playerTextures.tulupHide, color: COLORS.PLAYER_TULUP_DARK, emissive: fill }),
        tulupPatch: makePS1Material({ map: playerTextures.canvas, color: COLORS.PLAYER_TULUP_PATCH, emissive: fill }),
        sheepskin: makePS1Material({ map: playerTextures.sheepskin, color: COLORS.PLAYER_SHEEPSKIN, emissive: fill }),
        sheepskinDirty: makePS1Material({
            map: playerTextures.sheepskin,
            color: COLORS.PLAYER_SHEEPSKIN_DIRTY,
            emissive: fill,
            side: THREE.DoubleSide
        }),
        scarf: makePS1Material({ map: playerTextures.knit, color: COLORS.PLAYER_SCARF, emissive: fill }),

        // Winter hat and the battered helmet with its unlit headlamp
        hat: makePS1Material({ map: playerTextures.knit, color: COLORS.PLAYER_HAT, emissive: fill }),
        hatFur: makePS1Material({ map: playerTextures.sheepskin, color: COLORS.PLAYER_HAT_FUR, emissive: fill }),
        helmet: makePS1Material({ map: playerTextures.helmetMetal, color: COLORS.PLAYER_HELMET, emissive: fill }),
        helmetRim: makePS1Material({ map: playerTextures.helmetMetal, color: COLORS.PLAYER_HELMET_RIM, emissive: fill }),
        lampHousing: makePS1Material({ map: playerTextures.helmetMetal, color: COLORS.PLAYER_LAMP_HOUSING, emissive: fill }),
        lampLens: makePS1Material({ color: COLORS.PLAYER_LAMP_LENS, emissive: fill }),

        // Quilted trousers, felt boots and the cloth wraps
        pants: makePS1Material({ map: playerTextures.tulupHide, color: COLORS.PLAYER_PANTS, emissive: fill }),
        feltBoots: makePS1Material({ map: playerTextures.tulupHide, color: COLORS.PLAYER_FELT_BOOTS, emissive: fill }),
        bootSole: makePS1Material({ color: COLORS.PLAYER_BOOT_SOLE }),
        legWraps: makePS1Material({ map: playerTextures.knit, color: COLORS.PLAYER_LEG_WRAPS, emissive: fill }),

        // Patterned mittens and their cords
        mittens: makePS1Material({ map: playerTextures.mitten, color: COLORS.PLAYER_MITTENS, emissive: fill }),
        mittenCuff: makePS1Material({ map: playerTextures.knit, color: COLORS.PLAYER_MITTEN_CUFF, emissive: fill }),
        cord: makePS1Material({ color: COLORS.PLAYER_CORD, emissive: fill }),

        // Canvas survival pack
        backpackBody: makePS1Material({ map: playerTextures.canvas, color: COLORS.PLAYER_BACKPACK, emissive: fill }),
        backpackFlap: makePS1Material({ map: playerTextures.canvas, color: COLORS.PLAYER_BACKPACK_FLAP, emissive: fill }),
        backpackPocket: makePS1Material({ map: playerTextures.canvas, color: COLORS.PLAYER_BACKPACK_POCKET, emissive: fill }),
        strap: makePS1Material({ color: COLORS.PLAYER_STRAP, emissive: fill, side: THREE.DoubleSide }),
        buckle: makePS1Material({ color: COLORS.PLAYER_BUCKLE, emissive: fill }),
        bedroll: makePS1Material({ map: playerTextures.knit, color: COLORS.PLAYER_BEDROLL, emissive: fill }),
        charm: makePS1Material({ color: COLORS.PLAYER_CHARM, emissive: fill })
    };

    // The part collector names every merged mesh after its material, which is what
    // makes a frame check ("player-hip-left-tulup") possible in the scene graph.
    (Object.keys(materials) as Array<keyof typeof materials>).forEach((key) => {
        materials[key].name = key;
    });

    return materials;
}

export type PlayerMaterials = ReturnType<typeof createPlayerMaterials>;
