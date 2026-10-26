// Volumetric searchlight cones belong to the outside view: the pilot stands
// inside them, so they fade out as the camera enters the cockpit while the real
// beam keeps lighting the courtyard normally.
//
// The beam itself is no longer a THREE.SpotLight: it is two entries of the shader
// lamp array (the cone and the bounce on the asphalt), derived every frame from
// the world transform of the pod mount. Same transform feeds the visible cone, so
// they can never point in two directions.
import type { LampEmitter } from '../core/atmosphere.js';
import { RENDER_FLAGS } from '../core/renderFlags.js';
import type { buildMech } from '../mech/mech.js';
import * as THREE from 'three';

// Below this opacity the cones contribute nothing and are skipped entirely.
const CONE_MIN_VISIBILITY = 0.01;

const scratchQuaternion = new THREE.Quaternion();

type SearchlightRig = ReturnType<typeof buildMech>['searchlight'];

export function updateSearchlightCones(searchlight: SearchlightRig, fpBlend: number): void {
    // The cones are pure light: they belong to the night model and vanish with it.
    const visibility = (1 - fpBlend) * (RENDER_FLAGS.night ? 1 : 0);

    searchlight.beamMaterial.opacity = searchlight.beamOpacity * visibility;
    searchlight.coreMaterial.opacity = searchlight.coreOpacity * visibility;
    searchlight.beam.visible = visibility > CONE_MIN_VISIBILITY;
    searchlight.core.visible = searchlight.beam.visible;
}

// The three emitters are created once and mutated in place: the atmosphere holds a
// stable list, so the per-frame update cannot allocate.
export function createSearchlightEmitters(searchlight: SearchlightRig): LampEmitter[] {
    return [
        {
            position: new THREE.Vector3(),
            color: searchlight.spot.color,
            intensity: searchlight.spot.intensity,
            range: searchlight.spot.range,
            direction: searchlight.spot.axis.clone(),
            cosOuter: Math.cos(searchlight.spot.angle),
            right: new THREE.Vector3(1, 0, 0),
            cosOuterVertical: -Math.cos(searchlight.spot.angle)
        },
        {
            position: new THREE.Vector3(),
            color: searchlight.bounce.color,
            intensity: searchlight.bounce.intensity,
            range: searchlight.bounce.range
        },
        // Subtle rear engine-bay glow: a simple point light behind the hull.
        {
            position: new THREE.Vector3(),
            color: searchlight.rear.color,
            intensity: searchlight.rear.intensity,
            range: searchlight.rear.range
        }
    ];
}

export function updateSearchlightEmitters(searchlight: SearchlightRig, emitters: LampEmitter[]): void {
    const spot = emitters[0];
    const bounce = emitters[1];
    const rear = emitters[2];
    if (!spot || !bounce || !rear) return;

    const anchor = searchlight.anchor;
    // The rig is animated by the simulation, not by the renderer, so the world
    // matrix has to be refreshed before it is read.
    anchor.updateWorldMatrix(true, false);

    spot.position.setFromMatrixPosition(anchor.matrixWorld);
    if (spot.direction) {
        anchor.getWorldQuaternion(scratchQuaternion);
        spot.direction.copy(searchlight.spot.axis).applyQuaternion(scratchQuaternion).normalize();
        if (spot.right) {
            spot.right.set(1, 0, 0).applyQuaternion(scratchQuaternion).normalize();
        }
    }

    bounce.position.copy(searchlight.bounce.local).applyMatrix4(anchor.matrixWorld);

    // The rear light sits on the hull/tower root, rather than inheriting the
    // searchlight mount offset. This keeps the warm wash behind the mech and
    // makes its interaction with nearby walls agree with the visible exhaust.
    const rearAnchor = searchlight.rearAnchor;
    rearAnchor.updateWorldMatrix(true, false);
    rear.position.copy(searchlight.rear.local).applyMatrix4(rearAnchor.matrixWorld);
}
