// The single atmosphere state of the frame.
//
// Every custom shader (the lit surface shader and the snow shader) shares this one
// uniform object: fog, moon, hemisphere ambient, drift time and the local lamp
// array. It is mutated exactly once per frame, so a value can never mean two
// different things in two shaders — the failure mode of the previous setup, where
// three's `fog_fragment` and the snow shader each carried their own fade.
//
// `scene.fog` stays the source of truth for the haze: the camera rig blends the
// per-mode density into it and this module mirrors it, so the built-in materials
// (voids, dust, beam cones) and the custom ones dissolve into the same tone.
import { FOG, LAMPS, NIGHT } from '../config/render.js';
import { RENDER_FLAGS } from './renderFlags.js';
import * as THREE from 'three';

export interface LampEmitter {
    position: THREE.Vector3;
    // Hex colour of the light itself, not of its housing.
    color: number;
    intensity: number;
    // Reach in metres: the falloff is exactly zero at the range boundary.
    range: number;
    // A spot carries an axis and the cosine of its outer angle; a plain point
    // light leaves both undefined.
    direction?: THREE.Vector3;
    cosOuter?: number;
    // Optional horizontal basis and vertical edge for an elliptical spot.
    right?: THREE.Vector3;
    cosOuterVertical?: number;
}

const MOON_DIRECTION = new THREE.Vector3(
    NIGHT.MOON.DIRECTION.x,
    NIGHT.MOON.DIRECTION.y,
    NIGHT.MOON.DIRECTION.z
).normalize();

const FILL_DIRECTION = new THREE.Vector3(
    NIGHT.FILL.DIRECTION.x,
    NIGHT.FILL.DIRECTION.y,
    NIGHT.FILL.DIRECTION.z
).normalize();

const EXPOSURE = NIGHT.EXPOSURE;

// The two budgets are held here, not inlined into the uniforms, because
// applyNightExposure() has to be able to re-scale every sky-given term once the
// boot parameters are known (the acceptance harness sweeps both from the URL).
let surfaceExposure: number = EXPOSURE.SURFACE;
let skyExposure: number = EXPOSURE.SKY;
const cachedSkyTone = new THREE.Color(FOG.COLOR).multiplyScalar(skyExposure);

// Sky-given light is exposed, artificial light is not. The fog colour is also the
// backdrop (core/stage.ts) and the horizon of the sky pass (render/sky.ts), and
// all three read this one function, so a "darker night" cannot leave a luminous
// haze wall over a black yard -- or a sky that disagrees with the haze it sits
// behind. Practicals, emissive parts and the additive overlays stay at full
// strength on purpose.
export function skyTone(target?: THREE.Color): THREE.Color {
    return target ? target.copy(cachedSkyTone) : cachedSkyTone.clone();
}

// Every sky-given light term of the shader is rebuilt from one place. The values
// are raw config numbers in the literal below and get their exposure here, so a
// term can never be scaled twice or forgotten.
export function applyNightExposure(surface: number = surfaceExposure, sky: number = skyExposure): void {
    surfaceExposure = Number.isFinite(surface) && surface > 0 ? surface : EXPOSURE.SURFACE;
    skyExposure = Number.isFinite(sky) && sky > 0 ? sky : EXPOSURE.SKY;
    cachedSkyTone.set(FOG.COLOR).multiplyScalar(skyExposure);

    atmosphereUniforms.uMoonIntensity.value = NIGHT.MOON.INTENSITY * surfaceExposure;
    atmosphereUniforms.uFillIntensity.value = NIGHT.FILL.INTENSITY * surfaceExposure;
    atmosphereUniforms.uSkyIntensity.value = NIGHT.SKY.INTENSITY * surfaceExposure;
    atmosphereUniforms.uGroundIntensity.value = NIGHT.GROUND.INTENSITY * surfaceExposure;
    atmosphereUniforms.uAmbientFloor.value = NIGHT.AMBIENT.FLOOR * surfaceExposure;
    atmosphereUniforms.uFogColor.value.copy(cachedSkyTone);
}

function createVec4Array(size: number): THREE.Vector4[] {
    const array: THREE.Vector4[] = [];
    for (let index = 0; index < size; index += 1) array.push(new THREE.Vector4());
    return array;
}

// `-2` in the w slot of a lamp direction marks "no cone": the shader treats the
// entry as a point light.
const NO_CONE = -2;

export const atmosphereUniforms = {
    uTime: { value: 0 },
    // 1 = night model, 0 = neutral studio light (key N / ?night=off). The surface
    // shader reads it, so one flag switches the whole look instead of a dozen.
    uNightMode: { value: 1 },
    // Plain light used when the night model is off.
    uNeutralAmbient: { value: NIGHT.OFF.AMBIENT as number },
    uNeutralDirect: { value: NIGHT.OFF.DIRECT as number },

    uFogColor: { value: new THREE.Color(FOG.COLOR) },
    // The config literal is the starting value; the camera rig owns it per frame.
    uFogDensity: { value: FOG.DENSITY.GAME as number },
    uFogHeightFalloff: { value: FOG.HEIGHT.FALLOFF },
    uFogHeightMix: { value: FOG.HEIGHT.MIX },
    uFogNoiseScale: { value: FOG.NOISE.SCALE },
    uFogNoiseAmount: { value: FOG.NOISE.AMOUNT },
    uFogDrift: { value: new THREE.Vector2(FOG.NOISE.DRIFT_X, FOG.NOISE.DRIFT_Z) },

    // Raw config values: the night exposure is applied to all of them by
    // applyNightExposure() below, so no term can be scaled twice or forgotten.
    uMoonColor: { value: new THREE.Color(NIGHT.MOON.COLOR) },
    uMoonIntensity: { value: NIGHT.MOON.INTENSITY as number },
    uMoonDirection: { value: MOON_DIRECTION.clone() },
    uFillColor: { value: new THREE.Color(NIGHT.FILL.COLOR) },
    uFillIntensity: { value: NIGHT.FILL.INTENSITY as number },
    uFillDirection: { value: FILL_DIRECTION.clone() },
    uSkyColor: { value: new THREE.Color(NIGHT.SKY.COLOR) },
    uSkyIntensity: { value: NIGHT.SKY.INTENSITY as number },
    uGroundColor: { value: new THREE.Color(NIGHT.GROUND.COLOR) },
    uGroundIntensity: { value: NIGHT.GROUND.INTENSITY as number },
    uHemisphereExp: { value: NIGHT.AMBIENT.HEMISPHERE_EXP },
    uAmbientFloor: { value: NIGHT.AMBIENT.FLOOR as number },

    uLampPos: { value: createVec4Array(LAMPS.MAX) },
    uLampColor: { value: createVec4Array(LAMPS.MAX) },
    uLampDir: { value: createVec4Array(LAMPS.MAX) },
    uLampRight: { value: createVec4Array(LAMPS.MAX) },
    uLampCount: { value: 0 }
};

// The uniforms above are declared with the raw config once; this call is what
// turns them into the night of this boot.
applyNightExposure();

const lampColor = new THREE.Color();

function packLamps(lamps: LampEmitter[]): void {
    const count = RENDER_FLAGS.lights && RENDER_FLAGS.night ? Math.min(lamps.length, LAMPS.MAX) : 0;

    for (let index = 0; index < count; index += 1) {
        const lamp = lamps[index];
        atmosphereUniforms.uLampPos.value[index].set(
            lamp.position.x,
            lamp.position.y,
            lamp.position.z,
            lamp.range
        );

        lampColor.setHex(lamp.color);
        atmosphereUniforms.uLampColor.value[index].set(
            lampColor.r,
            lampColor.g,
            lampColor.b,
            lamp.intensity
        );

        const direction = lamp.direction;
        const cosOuter = lamp.cosOuter;
        if (direction && typeof cosOuter === 'number') {
            atmosphereUniforms.uLampDir.value[index].set(direction.x, direction.y, direction.z, cosOuter);
            const right = lamp.right;
            const cosOuterVertical = lamp.cosOuterVertical;
            if (right && typeof cosOuterVertical === 'number') {
                atmosphereUniforms.uLampRight.value[index].set(right.x, right.y, right.z, cosOuterVertical);
            } else {
                atmosphereUniforms.uLampRight.value[index].set(0, 0, 0, NO_CONE);
            }
        } else {
            atmosphereUniforms.uLampDir.value[index].set(0, -1, 0, NO_CONE);
            atmosphereUniforms.uLampRight.value[index].set(0, 0, 0, NO_CONE);
        }
    }

    atmosphereUniforms.uLampCount.value = count;
}

// Called once per frame from the simulation, after the camera rig has settled the
// fog preset and before anything renders.
export function updateAtmosphere(dt: number, fog: THREE.FogBase | null, lamps: LampEmitter[]): void {
    atmosphereUniforms.uTime.value += dt;
    // The night switch is mirrored here rather than read inside the shader, so every
    // consumer sees the same value in the same frame.
    atmosphereUniforms.uNightMode.value = RENDER_FLAGS.night ? 1 : 0;
    if (fog instanceof THREE.FogExp2) {
        atmosphereUniforms.uFogDensity.value = fog.density;
        atmosphereUniforms.uFogColor.value.copy(fog.color);
    }
    packLamps(lamps);
}
