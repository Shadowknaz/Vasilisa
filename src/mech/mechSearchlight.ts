// Caged infrared searchlight on the command tower's front-right cheek: the pod
// the pilot sees, plus the beam that actually lights the courtyard. The pod rides
// with the tower, while the volumetric cones fade out as the camera enters the
// cockpit (systems/searchlight.ts). The additive ground pool lives in its own
// world-space pivot: the rig's gait can never tilt it off the pavement.
//
// There is no THREE.SpotLight here any more. The mount itself is the transform
// carrier: systems/searchlight.ts reads its world position and axis and feeds the
// shader's lamp array, so the visible cone and the light it casts cannot diverge.
import { COLORS } from '../config/colors.js';
import { MECH_RIG } from '../config/mech.js';
import { NIGHT } from '../config/render.js';
import { createGroundPool, createHalo } from '../core/glow.js';
import { textures } from '../core/textures.js';
import type { MechMaterials } from './mechMaterials.js';
import { box, cyl } from './mechGeometry.js';
import * as THREE from 'three';

const SEARCHLIGHT = {
    // Tower-local mount on the front-right cheek (mirrored by the optical pod).
    MOUNT: { X: 0.36, Y: -0.18, Z: 0.66 },
    HEAD: { TOP_RADIUS: 0.15, BOTTOM_RADIUS: 0.12, HEIGHT: 0.2, SEGMENTS: 8 },
    LENS: { RADIUS: 0.13, HEIGHT: 0.03, SEGMENTS: 8, Z: 0.1 },
    GRILLE: { LENGTH: 0.28, BAR: 0.02, Z: 0.12 },
    // The visible cone only hints at the beam: a narrow alpha gradient that fades
    // out with distance, never a flat white wedge across the frame.
    BEAM: { RADIUS: 4.6, HEIGHT: 16, SEGMENTS: 32, OPACITY: 0.22, Z: 0.14, TILT: 0.28 },
    CORE: { RADIUS: 1.9, HEIGHT: 14, SEGMENTS: 32, OPACITY: 0.30 },
    // The cone the shader reconstructs. Intensity raised for better surface
    // interaction — the courtyard's asphalt and nearby walls must pick up the wash.
    // Decay is low on purpose: a searchlight keeps working down the courtyard
    // instead of dying a couple of metres from the lens.
    SPOT: { INTENSITY: 6.0, DISTANCE: 44, ANGLE: Math.PI / 4.4 },
    // Impact point on the asphalt, in mount space: it lies on the cone axis and
    // also seeds the bounce light the pool sells.
    TARGET: { Y: -2.98, Z: 11.0 },
    BOUNCE: { INTENSITY: 0.9, DISTANCE: 20, Y: 1.2, Z: 10.5 },
    POOL: { WIDTH: 10.5, DEPTH: 13.5, Z: 11.4, OPACITY: 0.75 },
    HALO: { SIZE: 2.4, OPACITY: 0.45 },
    // Subtle rear glow from the exhaust and engine bay — warm, dim and short-ranged.
    // It fills the hull's shadow side so the back of the mech is not a black void
    // and nearby walls behind the walker pick up a faint orange wash.
    REAR: { INTENSITY: 0.34, DISTANCE: 18, COLOR: 0xffa860, LOCAL: { X: -0.46, Y: 0.5, Z: -0.7 } }
} as const;

export interface MechSearchlight {
    beam: THREE.Mesh;
    core: THREE.Mesh;
    beamMaterial: THREE.MeshBasicMaterial;
    coreMaterial: THREE.MeshBasicMaterial;
    beamOpacity: number;
    coreOpacity: number;
    groundLightPool: THREE.Mesh;
    // World transform the shader lamp is derived from, plus the numbers the
    // emitters need. systems/searchlight.ts owns the per-frame update.
    anchor: THREE.Object3D;
    // The rear lamp belongs to the tower root, not the searchlight mount.
    rearAnchor: THREE.Object3D;
    spot: { color: number; intensity: number; range: number; angle: number; axis: THREE.Vector3 };
    bounce: { color: number; intensity: number; range: number; local: THREE.Vector3 };
    // Subtle rear engine-bay glow that fills the hull's shadow side.
    rear: { color: number; intensity: number; range: number; local: THREE.Vector3 };
}

const BEAM_AXIS = new THREE.Vector3(0, SEARCHLIGHT.TARGET.Y, SEARCHLIGHT.TARGET.Z - SEARCHLIGHT.BEAM.Z).normalize();
const BOUNCE_LOCAL = new THREE.Vector3(SEARCHLIGHT.MOUNT.X, SEARCHLIGHT.BOUNCE.Y, SEARCHLIGHT.BOUNCE.Z);
const REAR_LOCAL = new THREE.Vector3(SEARCHLIGHT.REAR.LOCAL.X, SEARCHLIGHT.REAR.LOCAL.Y, SEARCHLIGHT.REAR.LOCAL.Z);

function createCone(radius: number, height: number, segments: number, material: THREE.MeshBasicMaterial): THREE.Mesh {
    const geometry = new THREE.ConeGeometry(radius, height, segments, 1, true);
    geometry.translate(0, -height / 2, 0);
    geometry.rotateX(-Math.PI / 2);
    return new THREE.Mesh(geometry, material);
}

export function createSearchlight(
    towerGroup: THREE.Group,
    poolPivot: THREE.Group,
    materials: MechMaterials
): MechSearchlight {
    const mount = new THREE.Group();
    mount.position.set(SEARCHLIGHT.MOUNT.X, SEARCHLIGHT.MOUNT.Y, SEARCHLIGHT.MOUNT.Z);
    towerGroup.add(mount);

    // Caged pod: dark housing, the only self-lit lens of the walker, cross grille
    mount.add(cyl(
        SEARCHLIGHT.HEAD.TOP_RADIUS,
        SEARCHLIGHT.HEAD.BOTTOM_RADIUS,
        SEARCHLIGHT.HEAD.HEIGHT,
        SEARCHLIGHT.HEAD.SEGMENTS,
        materials.steel,
        0,
        0,
        0,
        Math.PI / 2
    ));
    mount.add(cyl(
        SEARCHLIGHT.LENS.RADIUS,
        SEARCHLIGHT.LENS.RADIUS,
        SEARCHLIGHT.LENS.HEIGHT,
        SEARCHLIGHT.LENS.SEGMENTS,
        materials.beacon,
        0,
        0,
        SEARCHLIGHT.LENS.Z,
        Math.PI / 2
    ));
    mount.add(box(SEARCHLIGHT.GRILLE.LENGTH, SEARCHLIGHT.GRILLE.BAR, SEARCHLIGHT.GRILLE.BAR, materials.piston, 0, 0, SEARCHLIGHT.GRILLE.Z));
    mount.add(box(SEARCHLIGHT.GRILLE.BAR, SEARCHLIGHT.GRILLE.LENGTH, SEARCHLIGHT.GRILLE.BAR, materials.piston, 0, 0, SEARCHLIGHT.GRILLE.Z));

    // Halo on the lens itself: at night the pod has to read as a light source even
    // when the cone points away from the camera.
    const lensHalo = createHalo({ size: SEARCHLIGHT.HALO.SIZE, opacity: SEARCHLIGHT.HALO.OPACITY, color: COLORS.SEARCHLIGHT });
    lensHalo.position.set(0, 0, SEARCHLIGHT.LENS.Z + 0.1);
    mount.add(lensHalo);

    // Outer volumetric cone: additive and faded along its length. Both cones take
    // the practical budget, so the beam belongs to the same artificial layer as
    // every halo and pool in the frame.
    const beamOpacity = SEARCHLIGHT.BEAM.OPACITY * NIGHT.PRACTICAL_SCALE;
    const coreOpacity = SEARCHLIGHT.CORE.OPACITY * NIGHT.PRACTICAL_SCALE;
    const beamMaterial = new THREE.MeshBasicMaterial({
        color: COLORS.BEAM_OUTER,
        map: textures.beamFalloff,
        transparent: true,
        opacity: beamOpacity,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    const beam = createCone(SEARCHLIGHT.BEAM.RADIUS, SEARCHLIGHT.BEAM.HEIGHT, SEARCHLIGHT.BEAM.SEGMENTS, beamMaterial);
    beam.position.set(0, 0, SEARCHLIGHT.BEAM.Z);
    beam.rotation.x = SEARCHLIGHT.BEAM.TILT;
    mount.add(beam);

    // Inner core with the same falloff: a hot core near the lens
    const coreMaterial = new THREE.MeshBasicMaterial({
        color: COLORS.SEARCHLIGHT,
        map: textures.beamFalloff,
        transparent: true,
        opacity: coreOpacity,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    const core = createCone(SEARCHLIGHT.CORE.RADIUS, SEARCHLIGHT.CORE.HEIGHT, SEARCHLIGHT.CORE.SEGMENTS, coreMaterial);
    core.position.set(0, 0, SEARCHLIGHT.BEAM.Z);
    core.rotation.x = SEARCHLIGHT.BEAM.TILT;
    mount.add(core);

    // Soft additive pool that anchors the beam to the asphalt. The pool lives in a
    // world-space pivot, so its offset and footprint follow the rig scale by hand:
    // the beam's ground impact moves out with the enlarged walker.
    const groundLightPool = createGroundPool({
        width: SEARCHLIGHT.POOL.WIDTH * MECH_RIG.SCALE,
        depth: SEARCHLIGHT.POOL.DEPTH * MECH_RIG.SCALE,
        opacity: SEARCHLIGHT.POOL.OPACITY,
        map: textures.searchlightPool
    });
    groundLightPool.position.set(
        SEARCHLIGHT.MOUNT.X * MECH_RIG.SCALE,
        0,
        SEARCHLIGHT.POOL.Z * MECH_RIG.SCALE
    );
    poolPivot.add(groundLightPool);

    return {
        beam,
        core,
        beamMaterial,
        coreMaterial,
        beamOpacity,
        coreOpacity,
        groundLightPool,
        anchor: mount,
        rearAnchor: towerGroup,
        spot: {
            color: COLORS.SEARCHLIGHT,
            intensity: SEARCHLIGHT.SPOT.INTENSITY,
            range: SEARCHLIGHT.SPOT.DISTANCE,
            angle: SEARCHLIGHT.SPOT.ANGLE,
            axis: BEAM_AXIS
        },
        bounce: {
            color: COLORS.SEARCHLIGHT,
            intensity: SEARCHLIGHT.BOUNCE.INTENSITY,
            range: SEARCHLIGHT.BOUNCE.DISTANCE,
            local: BOUNCE_LOCAL
        },
        rear: {
            color: SEARCHLIGHT.REAR.COLOR,
            intensity: SEARCHLIGHT.REAR.INTENSITY,
            range: SEARCHLIGHT.REAR.DISTANCE,
            local: REAR_LOCAL
        }
    };
}
