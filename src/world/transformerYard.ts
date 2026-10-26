// Transformer substation: the concrete booth (ТП) in the middle of its fenced
// yard. The fence itself lives in fence.js — one implementation shared with the
// PO-2 fragment — and this module only owns the booth, placed by its layout
// descriptor (TZ §9.4).
import { COLORS } from '../config/colors.js';
import { darkFrameMat, innerVoidMat } from '../core/materials.js';
import { makePS1Material } from '../core/ps1Material.js';
import { BOOTH_PROFILE, type ObjectDescriptor } from './layout/footprints.js';
import { objectsOfType, registerColliders } from './placement.js';
import type { Layout } from './layout/createLayout.js';
import type { CollisionWorld } from '../systems/collision.js';
import * as THREE from 'three';

const BOOTH = {
    BODY_SEGMENTS: [2, 2, 2]
};

function buildBooth(parent: THREE.Group, object: ObjectDescriptor): void {
    const profile = BOOTH_PROFILE;
    const booth = new THREE.Group();
    booth.position.set(object.transform.x, 0, object.transform.z);
    booth.rotation.y = object.transform.rotY;

    const concreteMat = makePS1Material({ color: COLORS.CONCRETE });

    const plinth = new THREE.Mesh(
        new THREE.BoxGeometry(profile.PLINTH.WIDTH, profile.PLINTH.HEIGHT, profile.PLINTH.DEPTH),
        innerVoidMat
    );
    plinth.position.y = profile.PLINTH.HEIGHT / 2;
    booth.add(plinth);

    const body = new THREE.Mesh(
        new THREE.BoxGeometry(
            profile.BODY.WIDTH,
            profile.BODY.HEIGHT,
            profile.BODY.DEPTH,
            BOOTH.BODY_SEGMENTS[0],
            BOOTH.BODY_SEGMENTS[1],
            BOOTH.BODY_SEGMENTS[2]
        ),
        concreteMat
    );
    body.position.y = profile.BODY.Y;
    booth.add(body);

    const roof = new THREE.Mesh(
        new THREE.BoxGeometry(profile.ROOF.WIDTH, profile.ROOF.HEIGHT, profile.ROOF.DEPTH),
        darkFrameMat
    );
    roof.position.y = profile.ROOF.Y;
    booth.add(roof);

    // Pitch-black recessed iron door on the −Z face, toward the yard gate
    const door = new THREE.Mesh(
        new THREE.BoxGeometry(profile.DOOR.WIDTH, profile.DOOR.HEIGHT, profile.DOOR.DEPTH),
        innerVoidMat
    );
    door.position.set(0, profile.DOOR.Y, profile.DOOR.Z);
    booth.add(door);

    const vent = new THREE.Mesh(
        new THREE.BoxGeometry(profile.VENT.WIDTH, profile.VENT.HEIGHT, profile.VENT.DEPTH),
        innerVoidMat
    );
    vent.position.set(0, profile.VENT.Y, profile.VENT.Z);
    booth.add(vent);

    // Stencilled inventory plate beside the door
    const plate = new THREE.Mesh(
        new THREE.BoxGeometry(profile.PLATE.WIDTH, profile.PLATE.HEIGHT, profile.PLATE.DEPTH),
        makePS1Material({ color: COLORS.HIGHLIGHT })
    );
    plate.position.set(profile.PLATE.X, profile.PLATE.Y, profile.PLATE.Z);
    booth.add(plate);

    parent.add(booth);
}

export function buildTransformerYard(group: THREE.Group, collision: CollisionWorld, layout: Layout): void {
    const [booth] = objectsOfType(layout, 'booth');
    if (!booth) throw new Error('layout object missing: TP');

    buildBooth(group, booth);
    registerColliders(collision, booth);
}
