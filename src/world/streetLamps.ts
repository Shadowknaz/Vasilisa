// Street lamps of the frozen plan: a cobra head on each utility pole, the kiosk
// window lamp and two porch bulbs. The geometry here matches one-to-one the
// emitters the shader receives from world/layout/lighting.ts — the fixture and the
// light it casts cannot drift apart, because both are built from the same table.
//
// A lamp is three objects: the housing (lit surface), the glowing lens (unlit,
// always bright) and the halo (additive sprite that survives the haze). The pool
// on the ground is shared with the searchlight and comes from core/glow.ts.
import { COLORS } from '../config/colors.js';
import { GROUND_OVERLAY, NIGHT } from '../config/render.js';
import { createGroundPool, createHalo } from '../core/glow.js';
import { makePS1Material } from '../core/ps1Material.js';
import { LAMP_FIXTURES, LAMP_PROFILE, LENS_COLOR } from './layout/lighting.js';
import type { SurfaceField } from './surfaceField.js';
import * as THREE from 'three';

// The lens is the light itself, so it is scaled by the practical budget rather
// than by the sky: a lens that dimmed with the moon would stop reading as a source.
// Values are premultiplied once here instead of per material.
const LENS_COLOR_SCALED = new THREE.Color(LENS_COLOR).multiplyScalar(NIGHT.PRACTICAL_SCALE);

// Lens materials are per kind, not per lamp: three kinds of fixture, three unlit
// materials, and every lamp of a kind shares the same colour anyway.
function createLensMaterials(): Record<string, THREE.MeshBasicMaterial> {
    const materials: Record<string, THREE.MeshBasicMaterial> = {};
    LAMP_FIXTURES.forEach((fixture) => {
        if (materials[fixture.kind]) return;
        materials[fixture.kind] = new THREE.MeshBasicMaterial({
            color: LENS_COLOR_SCALED,
            side: THREE.DoubleSide
        });
    });
    return materials;
}

// Housing of every lamp is the same painted cast iron, so one shared material.
const housingMat = makePS1Material({ color: COLORS.LAMP_HOUSING });

function buildPoleLamp(x: number, y: number, z: number, lens: THREE.MeshBasicMaterial): THREE.Object3D {
    const profile = LAMP_PROFILE.pole;
    const head = new THREE.Object3D();

    const body = new THREE.Mesh(
        new THREE.BoxGeometry(profile.HEAD.WIDTH, profile.HEAD.HEIGHT, profile.HEAD.DEPTH),
        housingMat
    );
    body.position.set(0, profile.HEAD.HEIGHT / 2, 0);
    head.add(body);

    // The lens is the underside of the head: a flat plate, not a second box, so it
    // reads as a lit surface at the isometric distance.
    const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(profile.HEAD.WIDTH * 0.8, profile.HEAD.DEPTH * 0.8),
        lens
    );
    glow.rotation.x = Math.PI / 2;
    glow.position.set(0, 0.01, 0);
    head.add(glow);

    head.position.set(x, y, z);
    return head;
}

function buildSimpleLamp(
    x: number,
    y: number,
    z: number,
    yaw: number,
    size: { WIDTH: number; HEIGHT: number; DEPTH: number },
    lens: THREE.MeshBasicMaterial
): THREE.Object3D {
    const head = new THREE.Object3D();
    const body = new THREE.Mesh(new THREE.BoxGeometry(size.WIDTH, size.HEIGHT, size.DEPTH), housingMat);
    body.position.set(0, size.HEIGHT / 2, 0);
    head.add(body);

    const glow = new THREE.Mesh(new THREE.PlaneGeometry(size.WIDTH * 0.8, size.DEPTH * 0.8), lens);
    glow.rotation.x = Math.PI / 2;
    glow.position.set(0, 0.01, 0);
    head.add(glow);

    head.position.set(x, y, z);
    head.rotation.y = yaw;
    return head;
}

export function buildStreetLamps(group: THREE.Group, surface: SurfaceField): void {
    const lensMaterials = createLensMaterials();

    LAMP_FIXTURES.forEach((fixture) => {
        const { x, y, z } = fixture.emitter.position;
        const lens = lensMaterials[fixture.kind];

        if (fixture.kind === 'pole') {
            group.add(buildPoleLamp(x, y, z, lens));
        } else {
            const size = LAMP_PROFILE[fixture.kind].BODY;
            group.add(buildSimpleLamp(x, y, z, fixture.yaw, size, lens));
        }

        const haloProfile = LAMP_PROFILE[fixture.kind].HALO;
        const halo = createHalo({
            size: haloProfile.SIZE,
            opacity: haloProfile.OPACITY,
            color: fixture.emitter.color
        });
        halo.position.set(x, y + 0.05, z);
        group.add(halo);

        const poolProfile = LAMP_PROFILE[fixture.kind].POOL;
        const pool = createGroundPool({
            width: poolProfile.WIDTH,
            depth: poolProfile.DEPTH,
            opacity: poolProfile.OPACITY,
            color: fixture.emitter.color
        });
        const footprint = {
            minX: x - poolProfile.WIDTH / 2,
            minZ: z - poolProfile.DEPTH / 2,
            maxX: x + poolProfile.WIDTH / 2,
            maxZ: z + poolProfile.DEPTH / 2
        };
        pool.position.set(x, surface.maxHeightInRect(footprint) + GROUND_OVERLAY.GAP, z);
        group.add(pool);
    });
}
