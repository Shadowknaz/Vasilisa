// Strict monochrome material palette of the walker. Every part builder and the
// searchlight read the same instances, so the hull never mixes two greys for one
// plate and the whole rig costs one material switch per texture.
import { COLORS } from '../config/colors.js';
import { makePS1Material } from '../core/ps1Material.js';
import { mechTextures } from './mechTextures.js';
import * as THREE from 'three';

export function createMechMaterials() {
    return {
        // Structural plates and armour
        hullLight: makePS1Material({ map: mechTextures.aeroPanel, color: COLORS.MECH_HULL }),
        hullMid: makePS1Material({ map: mechTextures.aeroPanel, color: COLORS.MECH_HULL_MID }),
        hullDark: makePS1Material({ map: mechTextures.darkIndustrial, color: COLORS.MECH_HULL_DARK }),
        patch: makePS1Material({ map: mechTextures.patchMetal, color: COLORS.MECH_PATCH }),
        door: makePS1Material({ map: mechTextures.armoredDoor, color: COLORS.MECH_DOOR }),
        plate: makePS1Material({ map: mechTextures.numberPlate, color: COLORS.MECH_PLATE }),

        // Mechanical details
        steel: makePS1Material({ color: COLORS.MECH_STEEL }),
        castIron: makePS1Material({ map: mechTextures.darkIndustrial, color: COLORS.MECH_CAST_IRON }),
        piston: makePS1Material({ color: COLORS.MECH_PISTON }),
        enamel: makePS1Material({ color: COLORS.MECH_ENAMEL }),
        rivet: makePS1Material({ color: COLORS.MECH_RIVET }),

        // Monochrome lit sensors
        visor: makePS1Material({
            map: mechTextures.cathodeVisor,
            color: COLORS.MECH_PLATE,
            emissive: COLORS.MECH_VISOR_EMISSIVE
        }),
        lens: makePS1Material({
            map: mechTextures.opticalDome,
            color: COLORS.MECH_PLATE,
            emissive: COLORS.MECH_LENS_EMISSIVE
        }),
        beacon: makePS1Material({
            color: COLORS.MECH_PLATE,
            emissive: COLORS.MECH_BEACON_EMISSIVE
        }),

        // Diegetic boarding plafond above the flank door. It is the only material
        // the pilot's proximity pulse recolours, so it must stay unlit basic.
        boardingLamp: new THREE.MeshBasicMaterial({ color: COLORS.BOARDING_LAMP_IDLE })
    };
}

export type MechMaterials = ReturnType<typeof createMechMaterials>;
