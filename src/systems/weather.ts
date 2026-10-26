// Reusable winter weather: GPU snow kept independent from the diorama.
//
// The field is world-anchored: the volume box stands still over the level and the
// flakes wrap inside it (see winterShader.ts), so snowfall neither follows the
// camera nor thins out over time.
//
// The shader shares the frame's atmosphere uniform object instead of keeping a
// private copy of the fog: the haze, the clock and the lamp array are the same
// objects the geometry reads, so a flake can never fade on a different curve than
// the yard behind it.
import { atmosphereUniforms } from '../core/atmosphere.js';
import { getVertexSnapResolution } from '../core/ps1Material.js';
import { WEATHER } from '../config/weather.js';
import { WINTER_SNOW_FRAGMENT, WINTER_SNOW_VERTEX } from '../render/winterShader.js';
import * as THREE from 'three';

export interface WeatherSystem {
    setEnabled(enabled: boolean): void;
    dispose(): void;
}

// Deterministic scatter: the same seed always builds the same field, so two
// reloads can be compared pixel by pixel.
function createRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function createWeatherSystem(scene: THREE.Scene): WeatherSystem {
    const tuning = WEATHER.SNOW;
    const count = tuning.COUNT;
    const random = createRandom(tuning.SEED);
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
        positions[i * 3] = (random() * 2 - 1) * tuning.VOLUME.HALF_X;
        positions[i * 3 + 1] = random() * tuning.VOLUME.HEIGHT;
        positions[i * 3 + 2] = (random() * 2 - 1) * tuning.VOLUME.HALF_Z;
        phases[i] = random();
        sizes[i] = tuning.SIZE.MIN + random() * (tuning.SIZE.MAX - tuning.SIZE.MIN);
    }

    const uniforms = {
        // Fog, moon, drift clock and lamps: shared by reference with every lit
        // material in the scene.
        ...atmosphereUniforms,
        uHeight: { value: tuning.VOLUME.HEIGHT },
        uHalfExtents: { value: new THREE.Vector2(tuning.VOLUME.HALF_X, tuning.VOLUME.HALF_Z) },
        // 0 disables the clip-space snap together with the rest of the frame.
        uSnapResolution: { value: getVertexSnapResolution() },
        uFallSpeed: { value: tuning.FALL_SPEED },
        uPointScale: { value: tuning.POINT.SCALE },
        uMaxPointSize: { value: tuning.POINT.MAX_PIXELS },
        uWind: { value: new THREE.Vector2(tuning.WIND.X, tuning.WIND.Z) },
        uColor: { value: new THREE.Color(tuning.COLOR) },
        uOpacity: { value: tuning.OPACITY },
        uLampTint: { value: tuning.LAMP_TINT }
    };

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
    geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
    const material = new THREE.ShaderMaterial({
        vertexShader: WINTER_SNOW_VERTEX,
        fragmentShader: WINTER_SNOW_FRAGMENT,
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending
    });
    const snowfall = new THREE.Points(geometry, material);
    snowfall.frustumCulled = false;
    snowfall.renderOrder = 8;
    scene.add(snowfall);

    return {
        setEnabled(value) { snowfall.visible = value; },
        dispose() { scene.remove(snowfall); geometry.dispose(); material.dispose(); }
    };
}
