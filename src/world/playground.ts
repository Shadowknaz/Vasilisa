// Abandoned Soviet courtyard playground: sandbox, rocket jungle-gym and swing set.
// All three items share one local frame centred on the PLAY zone, and each item is
// positioned by its own layout descriptor — mesh and collider come from the same
// transform, so world and local coordinates can no longer mix (TZ §9.3).
import { COLORS } from '../config/colors.js';
import { innerVoidMat } from '../core/materials.js';
import { makePS1Material } from '../core/ps1Material.js';
import { PLAYGROUND_PROFILE, type ObjectDescriptor } from './layout/footprints.js';
import { layoutObject, registerColliders } from './placement.js';
import type { Layout } from './layout/createLayout.js';
import type { CollisionWorld } from '../systems/collision.js';
import * as THREE from 'three';

// Render-only details. Every value that the validator measures lives in
// PLAYGROUND_PROFILE and is imported, never duplicated here.
const SANDBOX = {
    CURB_COUNT: 4,
    // The PLAY zone and the sandbox footprint flatten the ground to y = 0, so a
    // fixed lift keeps the dark sand plate clear of the relief mesh.
    FLOOR_LIFT: 0.02
};

const ROCKET = {
    CORE: { TOP_RADIUS: 0.52, BOTTOM_RADIUS: 0.72, HEIGHT: 3.2, SEGMENTS: 6, Y: 2.5 },
    BODY: { TOP_RADIUS: 0.65, BOTTOM_RADIUS: 0.85, HEIGHT: 3.4, SEGMENTS: 6, HEIGHT_SEGMENTS: 2, Y: 2.5 },
    NOSE: { RADIUS: 0.68, HEIGHT: 1.5, SEGMENTS: 6, Y: 4.95 },
    FIN: { COUNT: 3, WIDTH: 0.14, HEIGHT: 1.4, DEPTH: 0.9, RADIUS: 0.9, Y: 0.7 },
    TILT: 0.08
};

const SWING = {
    TOP_BAR: { RADIUS: 0.06, LENGTH: 3.2, SEGMENTS: 5, Y: 2.7 },
    LEG: { RADIUS: 0.05, LENGTH: 2.85, SEGMENTS: 5, X: 1.4, Z: 0.6, Y: 1.38, TILT: 0.35 },
    ROD: { RADIUS: 0.02, LENGTH: 1.85, SEGMENTS: 4, OFFSET_X: 0.35, Y: -0.92 },
    SEAT: { WIDTH: 0.85, HEIGHT: 0.08, DEPTH: 0.35, Y: -1.85 }
};

// Local offset of an item inside the shared playground frame.
interface LocalOffset {
    x: number;
    z: number;
}

function localOffset(object: ObjectDescriptor, origin: LocalOffset): LocalOffset {
    return { x: object.transform.x - origin.x, z: object.transform.z - origin.z };
}

function buildSandbox(parent: THREE.Group, offset: LocalOffset): void {
    const profile = PLAYGROUND_PROFILE.SANDBOX;
    const sandboxGroup = new THREE.Group();
    sandboxGroup.position.set(offset.x, 0, offset.z);
    parent.add(sandboxGroup);

    // Pitch-black sandbox interior + muted concrete curb. This is the sand plate,
    // not a shadow: it is opaque and sits a fixed lift above the flattened zone.
    const sandboxFloor = new THREE.Mesh(
        new THREE.PlaneGeometry(profile.SIZE, profile.SIZE),
        innerVoidMat
    );
    sandboxFloor.rotation.x = -Math.PI / 2;
    sandboxFloor.position.y = SANDBOX.FLOOR_LIFT;
    sandboxGroup.add(sandboxFloor);

    const curbMat = makePS1Material({ color: COLORS.CURB });
    for (let i = 0; i < SANDBOX.CURB_COUNT; i++) {
        const curb = new THREE.Mesh(
            new THREE.BoxGeometry(profile.CURB_LENGTH, profile.CURB_HEIGHT, profile.CURB_THICKNESS),
            curbMat
        );
        const angle = (i * Math.PI * 2) / SANDBOX.CURB_COUNT;
        curb.position.set(
            Math.sin(angle) * profile.CURB_RADIUS,
            profile.CURB_HEIGHT / 2,
            Math.cos(angle) * profile.CURB_RADIUS
        );
        curb.rotation.y = angle;
        sandboxGroup.add(curb);
    }
}

function buildRocket(parent: THREE.Group, offset: LocalOffset, rustMat: THREE.Material, darkMetalMat: THREE.Material): void {
    const rocketGroup = new THREE.Group();
    rocketGroup.position.set(offset.x, 0, offset.z);

    const coreVoid = new THREE.Mesh(
        new THREE.CylinderGeometry(
            ROCKET.CORE.TOP_RADIUS,
            ROCKET.CORE.BOTTOM_RADIUS,
            ROCKET.CORE.HEIGHT,
            ROCKET.CORE.SEGMENTS
        ),
        innerVoidMat
    );
    coreVoid.position.y = ROCKET.CORE.Y;
    rocketGroup.add(coreVoid);

    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(
            ROCKET.BODY.TOP_RADIUS,
            ROCKET.BODY.BOTTOM_RADIUS,
            ROCKET.BODY.HEIGHT,
            ROCKET.BODY.SEGMENTS,
            ROCKET.BODY.HEIGHT_SEGMENTS,
            true
        ),
        rustMat
    );
    body.position.y = ROCKET.BODY.Y;
    rocketGroup.add(body);

    const nose = new THREE.Mesh(
        new THREE.ConeGeometry(ROCKET.NOSE.RADIUS, ROCKET.NOSE.HEIGHT, ROCKET.NOSE.SEGMENTS),
        makePS1Material({ color: COLORS.ROCKET_NOSE })
    );
    nose.position.y = ROCKET.NOSE.Y;
    rocketGroup.add(nose);

    // Iconic Soviet courtyard rocket jungle-gym as a dark silhouette with black interior void
    for (let i = 0; i < ROCKET.FIN.COUNT; i++) {
        const fin = new THREE.Mesh(
            new THREE.BoxGeometry(ROCKET.FIN.WIDTH, ROCKET.FIN.HEIGHT, ROCKET.FIN.DEPTH),
            darkMetalMat
        );
        const angle = (i * Math.PI * 2) / ROCKET.FIN.COUNT;
        fin.position.set(
            Math.sin(angle) * ROCKET.FIN.RADIUS,
            ROCKET.FIN.Y,
            Math.cos(angle) * ROCKET.FIN.RADIUS
        );
        fin.rotation.y = angle;
        rocketGroup.add(fin);
    }

    rocketGroup.rotation.z = ROCKET.TILT;
    parent.add(rocketGroup);
}

function buildSwing(parent: THREE.Group, offset: LocalOffset, darkMetalMat: THREE.Material): void {
    const swingGroup = new THREE.Group();
    swingGroup.position.set(offset.x, 0, offset.z);

    const topBar = new THREE.Mesh(
        new THREE.CylinderGeometry(SWING.TOP_BAR.RADIUS, SWING.TOP_BAR.RADIUS, SWING.TOP_BAR.LENGTH, SWING.TOP_BAR.SEGMENTS),
        darkMetalMat
    );
    topBar.rotation.z = Math.PI / 2;
    topBar.position.y = SWING.TOP_BAR.Y;
    swingGroup.add(topBar);

    // Creaking swing set frame
    [-SWING.LEG.X, SWING.LEG.X].forEach((sx) => {
        [-SWING.LEG.Z, SWING.LEG.Z].forEach((sz) => {
            const leg = new THREE.Mesh(
                new THREE.CylinderGeometry(SWING.LEG.RADIUS, SWING.LEG.RADIUS, SWING.LEG.LENGTH, SWING.LEG.SEGMENTS),
                darkMetalMat
            );
            leg.position.set(sx, SWING.LEG.Y, sz / 2);
            leg.rotation.x = sz * SWING.LEG.TILT;
            swingGroup.add(leg);
        });
    });

    const swingPivot = new THREE.Group();
    swingPivot.position.set(0, SWING.TOP_BAR.Y, 0);

    [-SWING.ROD.OFFSET_X, SWING.ROD.OFFSET_X].forEach((rx) => {
        const rod = new THREE.Mesh(
            new THREE.CylinderGeometry(SWING.ROD.RADIUS, SWING.ROD.RADIUS, SWING.ROD.LENGTH, SWING.ROD.SEGMENTS),
            darkMetalMat
        );
        rod.position.set(rx, SWING.ROD.Y, 0);
        swingPivot.add(rod);
    });

    const seat = new THREE.Mesh(
        new THREE.BoxGeometry(SWING.SEAT.WIDTH, SWING.SEAT.HEIGHT, SWING.SEAT.DEPTH),
        darkMetalMat
    );
    seat.position.set(0, SWING.SEAT.Y, 0);
    swingPivot.add(seat);
    swingGroup.add(swingPivot);

    parent.add(swingGroup);
}

export function buildPlayground(group: THREE.Group, collision: CollisionWorld, layout: Layout): void {
    const zone = layout.zones.find((entry) => entry.zoneKind === 'playground');
    if (!zone) throw new Error('layout zone not found: PLAY');
    const origin = {
        x: (zone.rect.minX + zone.rect.maxX) / 2,
        z: (zone.rect.minZ + zone.rect.maxZ) / 2
    };

    const playgroundGroup = new THREE.Group();
    playgroundGroup.position.set(origin.x, 0, origin.z);
    group.add(playgroundGroup);

    const rustMat = makePS1Material({ color: COLORS.RUST });
    const darkMetalMat = new THREE.MeshBasicMaterial({ color: COLORS.METAL_DARK });

    const sandbox = layoutObject(layout, 'PLAY-SANDBOX');
    const rocket = layoutObject(layout, 'PLAY-ROCKET');
    const swing = layoutObject(layout, 'PLAY-SWING');

    buildSandbox(playgroundGroup, localOffset(sandbox, origin));
    buildRocket(playgroundGroup, localOffset(rocket, origin), rustMat, darkMetalMat);
    buildSwing(playgroundGroup, localOffset(swing, origin), darkMetalMat);

    [rocket, swing].forEach((object) => registerColliders(collision, object));
}
