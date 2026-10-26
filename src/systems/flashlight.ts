import { COLORS } from '../config/colors.js';
import { NIGHT } from '../config/render.js';
import { RENDER_FLAGS } from '../core/renderFlags.js';
import { textures } from '../core/textures.js';
import type { LampEmitter } from '../core/atmosphere.js';
import type { ViewState } from '../state/viewState.js';
import * as THREE from 'three';

const FLASHLIGHT = {
    COLOR: COLORS.SEARCHLIGHT,
    INTENSITY: 3.6,
    RANGE: 22,
    ANGLE: Math.PI / 4.6,
    // Keep the emitter just in front of the eye to avoid lighting the surface
    // behind the pilot when she looks down.
    FORWARD: 0.15,
    BEAM: { RADIUS: 1.6, HEIGHT: 14, SEGMENTS: 24, OPACITY: 0.12 }
} as const;

const direction = new THREE.Vector3();
const right = new THREE.Vector3();
const up = new THREE.Vector3();

export interface FlashlightEmitter extends LampEmitter {
    beam?: THREE.Mesh;
    beamMaterial?: THREE.MeshBasicMaterial;
}

export function createFlashlightEmitter(scene?: THREE.Scene): FlashlightEmitter {
    let beam: THREE.Mesh | undefined;
    let beamMaterial: THREE.MeshBasicMaterial | undefined;

    if (scene) {
        const geometry = new THREE.ConeGeometry(
            FLASHLIGHT.BEAM.RADIUS,
            FLASHLIGHT.BEAM.HEIGHT,
            FLASHLIGHT.BEAM.SEGMENTS,
            1,
            true
        );
        geometry.translate(0, -FLASHLIGHT.BEAM.HEIGHT / 2, 0);
        geometry.rotateX(-Math.PI / 2);

        beamMaterial = new THREE.MeshBasicMaterial({
            color: COLORS.SEARCHLIGHT,
            map: textures.beamFalloff,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        beam = new THREE.Mesh(geometry, beamMaterial);
        beam.visible = false;
        scene.add(beam);
    }

    return {
        position: new THREE.Vector3(),
        color: FLASHLIGHT.COLOR,
        intensity: 0,
        range: FLASHLIGHT.RANGE,
        direction: new THREE.Vector3(0, 0, -1),
        cosOuter: Math.cos(FLASHLIGHT.ANGLE * 0.72),
        right: new THREE.Vector3(1, 0, 0),
        cosOuterVertical: Math.cos(FLASHLIGHT.ANGLE * 0.42),
        beam,
        beamMaterial
    };
}

export function updateFlashlightEmitter(
    camera: THREE.PerspectiveCamera,
    viewState: ViewState,
    emitter: FlashlightEmitter
): void {
    camera.updateWorldMatrix(true, false);
    camera.getWorldDirection(direction);
    right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    emitter.position.copy(camera.position).addScaledVector(direction, FLASHLIGHT.FORWARD);
    emitter.direction?.copy(direction);
    emitter.right?.copy(right);

    // Fade with the existing mode blend so the headlamp belongs to first person
    // during the hatch transition and is fully off in the mech view.
    const blend = viewState.mode === 'FP'
        ? 1
        : viewState.mode === 'TRANSITION_TO_FP'
            ? viewState.transitionProgress
            : viewState.mode === 'TRANSITION_TO_MECH'
                ? 1 - viewState.transitionProgress
                : 0;
    emitter.intensity = FLASHLIGHT.INTENSITY * Math.max(0, Math.min(1, blend));

    // Volumetric flashlight beam following the first-person perspective
    if (emitter.beam && emitter.beamMaterial) {
        const visible = blend > 0.01 && RENDER_FLAGS.night;
        emitter.beam.visible = visible;
        if (visible) {
            emitter.beamMaterial.opacity = FLASHLIGHT.BEAM.OPACITY * blend * NIGHT.PRACTICAL_SCALE;
            up.crossVectors(direction, right).normalize();
            // Offset slightly down and right from the eye (chest/handheld lamp pose)
            emitter.beam.position
                .copy(camera.position)
                .addScaledVector(direction, 0.20)
                .addScaledVector(right, 0.10)
                .addScaledVector(up, -0.14);
            emitter.beam.quaternion.copy(camera.quaternion);
        }
    }
}
