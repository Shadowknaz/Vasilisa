// Courtyard kiosk (продуктовый ларёк): painted box on a plinth, shed roof, folded
// shutter over the counter window and a muted stencilled sign. Local +Z is the
// shop front; the plan turns it by -pi/2 so the window faces the west approach
// (TZ §9.5). Dimensions come from KIOSK_PROFILE, the same profile the validator
// measured.
import { COLORS } from '../config/colors.js';
import { darkFrameMat, innerVoidMat } from '../core/materials.js';
import { makePS1Material } from '../core/ps1Material.js';
import { textures } from '../core/textures.js';
import { KIOSK_PROFILE, type ObjectDescriptor } from './layout/footprints.js';
import { objectsOfType, registerColliders } from './placement.js';
import type { Layout } from './layout/createLayout.js';
import type { CollisionWorld } from '../systems/collision.js';
import * as THREE from 'three';

const KIOSK = {
    BODY_SEGMENTS: [2, 2, 2],
    WINDOW: { WIDTH: 2.6, HEIGHT: 1.3, DEPTH: 0.08, Y: 1.5 },
    SIGN_LIFT: 0.002
};

function createKiosk(parent: THREE.Group, object: ObjectDescriptor): void {
    const profile = KIOSK_PROFILE;
    const group = new THREE.Group();
    group.position.set(object.transform.x, 0, object.transform.z);
    group.rotation.y = object.transform.rotY;

    const frontZ = profile.BODY.DEPTH / 2;
    // The roof overhangs the front (customer side) further than the back.
    const roofDepth = profile.BODY.DEPTH + profile.ROOF.FRONT_OVERHANG + profile.ROOF.BACK_OVERHANG;
    const roofCenterZ = (profile.ROOF.FRONT_OVERHANG - profile.ROOF.BACK_OVERHANG) / 2;

    // Black plinth gap under the body
    const plinth = new THREE.Mesh(
        new THREE.BoxGeometry(profile.PLINTH.WIDTH, profile.PLINTH.HEIGHT, profile.PLINTH.DEPTH),
        innerVoidMat
    );
    plinth.position.y = profile.PLINTH.HEIGHT / 2;
    group.add(plinth);

    const body = new THREE.Mesh(
        new THREE.BoxGeometry(
            profile.BODY.WIDTH,
            profile.BODY.HEIGHT,
            profile.BODY.DEPTH,
            KIOSK.BODY_SEGMENTS[0],
            KIOSK.BODY_SEGMENTS[1],
            KIOSK.BODY_SEGMENTS[2]
        ),
        makePS1Material({ map: textures.rawConcrete, color: COLORS.FACADE_SIDE })
    );
    body.position.y = profile.BODY.Y;
    group.add(body);

    // Pitch-black counter opening behind the folded shutter
    const windowVoid = new THREE.Mesh(
        new THREE.BoxGeometry(KIOSK.WINDOW.WIDTH, KIOSK.WINDOW.HEIGHT, KIOSK.WINDOW.DEPTH),
        innerVoidMat
    );
    windowVoid.position.set(0, KIOSK.WINDOW.Y, frontZ);
    group.add(windowVoid);

    // Roller shutter pulled down to counter height, with a folded lower edge
    const shutter = new THREE.Mesh(
        new THREE.BoxGeometry(profile.SHUTTER.WIDTH, profile.SHUTTER.HEIGHT, profile.SHUTTER.DEPTH),
        makePS1Material({ color: COLORS.FENCE })
    );
    shutter.position.set(0, profile.SHUTTER.Y, profile.SHUTTER.Z);
    group.add(shutter);

    const counter = new THREE.Mesh(
        new THREE.BoxGeometry(profile.COUNTER.WIDTH, profile.COUNTER.HEIGHT, profile.COUNTER.DEPTH),
        makePS1Material({ color: COLORS.CURB })
    );
    counter.position.set(0, profile.COUNTER.Y, profile.COUNTER.Z);
    group.add(counter);

    // Shed roof: tilted down toward the customer side
    const roof = new THREE.Mesh(
        new THREE.BoxGeometry(profile.ROOF.WIDTH, profile.ROOF.HEIGHT, roofDepth),
        darkFrameMat
    );
    roof.position.set(0, profile.ROOF.Y, roofCenterZ);
    roof.rotation.x = Math.atan2(profile.ROOF.RISE, roofDepth);
    group.add(roof);

    const signPlate = new THREE.Mesh(
        new THREE.BoxGeometry(profile.SIGN.WIDTH, profile.SIGN.HEIGHT, profile.SIGN.DEPTH),
        darkFrameMat
    );
    signPlate.position.set(0, profile.SIGN.Y, profile.SIGN.Z);
    group.add(signPlate);

    // Stencil face sits a hair in front of the plate so the shallow box never
    // fights it for depth.
    const signFace = new THREE.Mesh(
        new THREE.PlaneGeometry(profile.SIGN.WIDTH, profile.SIGN.HEIGHT),
        makePS1Material({ map: textures.kioskSign, color: COLORS.HIGHLIGHT })
    );
    signFace.position.set(0, profile.SIGN.Y, profile.SIGN.Z + profile.SIGN.DEPTH / 2 + KIOSK.SIGN_LIFT);
    group.add(signFace);

    // Service door on the back face, toward the yard side
    const door = new THREE.Mesh(
        new THREE.BoxGeometry(profile.DOOR.WIDTH, profile.DOOR.HEIGHT, profile.DOOR.DEPTH),
        innerVoidMat
    );
    door.position.set(profile.DOOR.X, profile.DOOR.Y, profile.DOOR.Z);
    group.add(door);

    parent.add(group);
}

export function buildKiosk(group: THREE.Group, collision: CollisionWorld, layout: Layout): void {
    const [kiosk] = objectsOfType(layout, 'kiosk');
    if (!kiosk) throw new Error('layout object missing: KIOSK');

    createKiosk(group, kiosk);
    registerColliders(collision, kiosk);
}
