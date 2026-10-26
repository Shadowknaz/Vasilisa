// Placement of every practical light in the courtyard.
//
// Nothing here invents a coordinate: a pole lamp hangs off the arm the layout
// already owns, a porch bulb sits under the canopy the layout already owns, and
// the kiosk lamp hangs off the prefab front. That keeps the frozen plan untouched
// — lamps are visual objects with no collider, so plan-check counts the same
// 1353 checks and the configHash does not move.
//
// The same table feeds two consumers: world/streetLamps.ts builds the fixtures and
// the halos from it, and core/atmosphere.ts uploads the emitters to the shader.
import { COLORS } from '../../config/colors.js';
import { BUILDINGS, KIOSK, POLES } from '../../config/layout.js';
import type { LampEmitter } from '../../core/atmosphere.js';
import { KHRUSHCHYOVKA, POLE_PROFILE, porchLocalXs, transformPoint } from './footprints.js';
import * as THREE from 'three';

// One table per fixture kind. The mesh, the halo, the ground pool AND the shader
// emitter are all built from it, so a fixture and the light leaving it cannot
// drift apart -- and there is exactly one place to rebalance a lamp.
//
// LIGHT is the only description of what a fixture casts. Every practical is a
// CONE: an omnidirectional bulb leaks up the facade from below, washes the roofs
// and flattens exactly the silhouettes the night is built around.
export const LAMP_PROFILE = {
    pole: {
        HEAD: { WIDTH: 0.66, HEIGHT: 0.2, DEPTH: 0.28 },
        // The head hangs under the end of the existing arm and overhangs it a
        // little, the way a cobra lamp does.
        DROP: 0.34,
        REACH: 0.5,
        // The cobra head fills the service strip; the 26 m reach lets the pool
        // spill over the kerb into the courtyard.
        LIGHT: { COLOR: COLORS.LAMP_SODIUM, INTENSITY: 1.15, RANGE: 26, CONE_DEG: 70, TILT_DEG: 8 },
        HALO: { SIZE: 4.4, OPACITY: 0.5 },
        POOL: { WIDTH: 15, DEPTH: 15, OPACITY: 0.4 }
    },
    kiosk: {
        BODY: { WIDTH: 0.5, HEIGHT: 0.24, DEPTH: 0.12 },
        DROP: 0.3,
        // Leaned out of the prefab front, so the window and the step are lit and
        // the wall behind the lamp stays dark.
        LIGHT: { COLOR: COLORS.LAMP_KIOSK, INTENSITY: 0.9, RANGE: 12, CONE_DEG: 60, TILT_DEG: 15 },
        HALO: { SIZE: 2.4, OPACITY: 0.45 },
        POOL: { WIDTH: 8, DEPTH: 8, OPACITY: 0.32 }
    },
    entrance: {
        BODY: { WIDTH: 0.24, HEIGHT: 0.12, DEPTH: 0.42 },
        // Under the canopy, aimed down the porch and out onto the path.
        LIGHT: { COLOR: COLORS.LAMP_ENTRANCE, INTENSITY: 0.7, RANGE: 10, CONE_DEG: 50, TILT_DEG: 30 },
        HALO: { SIZE: 1.9, OPACITY: 0.4 },
        POOL: { WIDTH: 6, DEPTH: 6, OPACITY: 0.3 }
    }
} as const;

const UP = new THREE.Vector3(0, 1, 0);

// The axis a fixture looks ALONG: straight down, leaned TILT_DEG away from the
// surface it is mounted on (local +Z of its frame) and turned by the fixture yaw.
// systems/searchlight.ts fills the same field for the walker's beam, so every
// practical in the scene reaches the shader as a spot.
function spotAxis(yaw: number, tiltDeg: number): THREE.Vector3 {
    const tilt = THREE.MathUtils.degToRad(tiltDeg);
    return new THREE.Vector3(0, -Math.cos(tilt), Math.sin(tilt)).applyAxisAngle(UP, yaw).normalize();
}

// The shader compares against the cosine of the OUTER half-angle, not the full
// cone, so a 70 deg lamp is 35 deg off its axis.
function cosOuterAngle(coneDeg: number): number {
    return Math.cos(THREE.MathUtils.degToRad(coneDeg) / 2);
}

type LampKind = keyof typeof LAMP_PROFILE;

interface LampFixture {
    kind: LampKind;
    emitter: LampEmitter;
    // Rotation of the fixture body around Y, so a porch bulb faces out of the wall
    // it hangs on.
    yaw: number;
}

// Local Z of the courtyard facade of a block, plus the proud of the porch bulb.
const FACADE_Z = KHRUSHCHYOVKA.DEPTH / 2;
// The bulb hangs in the canopy gap of khrushchyovkaFacade.ts (ENTRANCE.LAMP).
const PORCH_LAMP_Y = 2.75;
const PORCH_LAMP_PROUD = 0.36;

function poleFixtures(): LampFixture[] {
    const headX = POLES.x + POLE_PROFILE.ARM.X_OFFSET + POLE_PROFILE.ARM.WIDTH / 2 - LAMP_PROFILE.pole.REACH;
    const headY = POLES.anchorY - LAMP_PROFILE.pole.DROP;
    const light = LAMP_PROFILE.pole.LIGHT;

    return POLES.z.map((z) => ({
        kind: 'pole',
        yaw: 0,
        emitter: {
            position: new THREE.Vector3(headX, headY, z),
            color: light.COLOR,
            intensity: light.INTENSITY,
            range: light.RANGE,
            // The head overhangs the service strip, so the beam leans back over
            // the courtyard. The lean direction is the yardward normal of the
            // head, derived from the plan -- never a hardcoded sign.
            direction: spotAxis(Math.atan2(-headX, -z), light.TILT_DEG),
            cosOuter: cosOuterAngle(light.CONE_DEG)
        }
    }));
}

function kioskFixture(): LampFixture {
    // Front of the prefab is local +Z; the plan owns the rotation.
    const front = transformPoint({ x: KIOSK.x, y: 0, z: KIOSK.z, rotY: KIOSK.rotY }, 0, 2.3);
    const light = LAMP_PROFILE.kiosk.LIGHT;
    return {
        kind: 'kiosk',
        yaw: KIOSK.rotY,
        emitter: {
            position: new THREE.Vector3(front.x, 2.5, front.z),
            color: light.COLOR,
            intensity: light.INTENSITY,
            range: light.RANGE,
            direction: spotAxis(KIOSK.rotY, light.TILT_DEG),
            cosOuter: cosOuterAngle(light.CONE_DEG)
        }
    };
}

// Two porch bulbs: the two northern blocks, which are the ones the isometric
// camera has in frame from the spawn. The bulb hangs over the first porch.
const LIT_PORCH = 0;
const LIT_BUILDINGS = BUILDINGS.slice(0, 2);
const LIT_PORCHES = new Set(LIT_BUILDINGS.map((building) => `${building.id}:${LIT_PORCH}`));

// A porch carries a bulb only if this table says so. The facade skin asks the
// same question before it paints a glowing lens: a lit fitting on a porch without
// an emitter is a light the shader knows nothing about, and the frame contradicts
// it as soon as the night model is on.
export function hasPorchBulb(buildingId: string, porchIndex: number): boolean {
    return LIT_PORCHES.has(`${buildingId}:${porchIndex}`);
}

function entranceFixtures(): LampFixture[] {
    const light = LAMP_PROFILE.entrance.LIGHT;
    return LIT_BUILDINGS.map((building) => {
        const porchX = porchLocalXs(building.sections)[LIT_PORCH];
        const point = transformPoint(
            { x: building.x, y: 0, z: building.z, rotY: building.rotY },
            porchX,
            FACADE_Z + PORCH_LAMP_PROUD
        );
        return {
            kind: 'entrance' as const,
            yaw: building.rotY,
            emitter: {
                position: new THREE.Vector3(point.x, PORCH_LAMP_Y, point.z),
                color: light.COLOR,
                intensity: light.INTENSITY,
                range: light.RANGE,
                // Local +Z of the block is its courtyard facade, so the porch
                // lamp leans out of the wall it hangs on.
                direction: spotAxis(building.rotY, light.TILT_DEG),
                cosOuter: cosOuterAngle(light.CONE_DEG)
            }
        };
    });
}

export const LAMP_FIXTURES: LampFixture[] = [...poleFixtures(), kioskFixture(), ...entranceFixtures()];

// What the shader sees. The searchlight appends its own two dynamic emitters at
// runtime, which is why LAMPS.MAX leaves room for them.
export const LAMP_EMITTERS: LampEmitter[] = LAMP_FIXTURES.map((fixture) => fixture.emitter);

// Colour of the glowing lens itself, one step brighter than the light it casts.
export const LENS_COLOR = COLORS.HALO;
