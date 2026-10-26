// Dust/smoke puff particle pool reused by footsteps and the exhaust chimney.
// Each puff fades in over the first 20% of its life and fades out over the last
// 50%, so the smoke reads as a dissolving cloud, not a dodecahedron popping in
// and out of existence. Lateral drift gives the plume an organic shape.
import { COLORS } from '../config/colors.js';
import { DUST } from '../config/controls.js';
import * as THREE from 'three';

interface DustPuff {
    mesh: THREE.Sprite;
    material: THREE.SpriteMaterial;
    vy: number;
    vx: number;
    vz: number;
    life: number;
    maxLife: number;
    scaleSpeed: number;
    active: boolean;
}

const POOL_SIZE = 72;
// Fade-in ends at 20% of lifetime, fade-out starts at 50%.
const FADE_IN_END = 0.2;
const FADE_OUT_START = 0.5;
const MAX_OPACITY = 0.38;
// Lateral drift: the puff wanders as it rises, so a column of smoke reads as a
// plume rather than a straight stack.
const DRIFT_SPEED = 0.15;

export function createDustSystem(scene: THREE.Scene) {
    const group = new THREE.Group();
    group.name = 'dust-particle-pool';
    scene.add(group);

    // A soft radial card avoids the hard polygon edges that used to shimmer as
    // the camera quantizes across the smoke column. Sprites remain depth-tested,
    // so the plume still disappears behind the hull and nearby walls.
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to create smoke texture');
    const gradient = context.createRadialGradient(32, 32, 2, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(35, 39, 43, 0.9)');
    gradient.addColorStop(0.55, 'rgba(30, 34, 38, 0.45)');
    gradient.addColorStop(1, 'rgba(20, 23, 26, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    const smokeTexture = new THREE.CanvasTexture(canvas);
    smokeTexture.generateMipmaps = true;
    smokeTexture.minFilter = THREE.LinearMipmapLinearFilter;
    smokeTexture.magFilter = THREE.LinearFilter;

    const pool: DustPuff[] = [];
    for (let i = 0; i < POOL_SIZE; i++) {
        const material = new THREE.SpriteMaterial({
            color: COLORS.DUST_PUFF,
            map: smokeTexture,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            depthTest: true,
            blending: THREE.NormalBlending,
            fog: true
        });
        const mesh = new THREE.Sprite(material);
        mesh.visible = false;
        group.add(mesh);
        pool.push({
            mesh,
            material,
            vy: 0,
            vx: 0,
            vz: 0,
            life: 0,
            maxLife: DUST.LIFETIME,
            scaleSpeed: 1,
            active: false
        });
    }

    let nextIndex = 0;

    function spawn(x: number, y: number, z: number, scaleSpeed = 1.0): void {
        let puff: DustPuff | null = null;
        for (let i = 0; i < POOL_SIZE; i++) {
            const candidate = pool[(nextIndex + i) % POOL_SIZE];
            if (!candidate.active) {
                puff = candidate;
                nextIndex = (nextIndex + i + 1) % POOL_SIZE;
                break;
            }
        }
        if (!puff) {
            puff = pool[nextIndex];
            nextIndex = (nextIndex + 1) % POOL_SIZE;
        }

        puff.active = true;
        puff.life = 0;
        puff.maxLife = DUST.LIFETIME + Math.random() * 0.4;
        puff.vy = DUST.RISE_MIN + Math.random() * DUST.RISE_RANDOM;
        puff.vx = (Math.random() - 0.5) * DRIFT_SPEED;
        puff.vz = (Math.random() - 0.5) * DRIFT_SPEED;
        puff.scaleSpeed = scaleSpeed;

        puff.mesh.position.set(
            x + (Math.random() - 0.5) * DUST.SPREAD,
            y,
            z + (Math.random() - 0.5) * DUST.SPREAD
        );
        puff.mesh.scale.set(DUST.SIZE, DUST.SIZE, 1);
        puff.material.opacity = 0;
        puff.mesh.visible = true;
    }

    function update(dt: number): void {
        for (let i = 0; i < POOL_SIZE; i++) {
            const puff = pool[i];
            if (!puff.active) continue;

            puff.life += dt;
            if (puff.life >= puff.maxLife) {
                puff.active = false;
                puff.mesh.visible = false;
                continue;
            }

            const t = puff.life / puff.maxLife;

            // Smooth opacity envelope: fade in, hold, fade out
            let opacity: number;
            if (t < FADE_IN_END) {
                opacity = MAX_OPACITY * (t / FADE_IN_END);
            } else if (t > FADE_OUT_START) {
                opacity = MAX_OPACITY * (1 - (t - FADE_OUT_START) / (1 - FADE_OUT_START));
            } else {
                opacity = MAX_OPACITY;
            }
            puff.material.opacity = Math.max(0, opacity);

            puff.mesh.position.y += puff.vy * dt;
            puff.mesh.position.x += puff.vx * dt;
            puff.mesh.position.z += puff.vz * dt;
            // Slow the rise as the puff expands (buoyancy drop).
            puff.vy *= 1 - 0.3 * dt;
            const scale = DUST.SIZE * (1 + puff.life * DUST.GROWTH * puff.scaleSpeed);
            puff.mesh.scale.set(scale, scale, 1);
        }
    }

    function dispose(): void {
        scene.remove(group);
        smokeTexture.dispose();
        for (const puff of pool) puff.material.dispose();
    }

    return { spawn, update, dispose };
}
