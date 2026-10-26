// Courtyard details of a lived-in yard: the laundry frames on the lawns and the
// refuse containers beside the transformer yard. Both are placed by the plan
// (coordinates, colliders and clearance checks come from the descriptors), so this
// module only turns them into geometry.
//
// A laundry frame is two posts and three sagging wires: the posts are solid, the
// wires are lines, and the rug left out on the first frame is the only piece of
// cloth the yard kept. The containers are plain boxes with a lid, which is what
// reads at the isometric distance.
import { COLORS } from '../config/colors.js';
import { darkFrameMat } from '../core/materials.js';
import { makePS1Material } from '../core/ps1Material.js';
import { LAUNDRY_PROFILE, BIN_PROFILE, type ObjectDescriptor } from './layout/footprints.js';
import { objectsOfType, registerColliders } from './placement.js';
import type { Layout } from './layout/createLayout.js';
import type { CollisionWorld } from '../systems/collision.js';
import * as THREE from 'three';

const LAUNDRY = {
    SEGMENTS: 6,
    POST_RADIUS: 0.06,
    WIRE_COLOR: 0x050607,
    WIRE_SEGMENTS: 10,
    // Wires are stacked down the frame from the anchor height of the profile.
    WIRE_STEP: 0.18,
    SAG_FALLOFF: 0.15,
    // Share of the span the rug is pegged at, measured from the west post.
    RUG_OFFSET: 0.55,
    RUG_LIFT: 0.012
};

const BIN = {
    LID_OVERHANG: 0.04,
    RIM_HEIGHT: 0.05
};

function createCatenary(from: THREE.Vector3, to: THREE.Vector3, sag: number): THREE.BufferGeometry {
    const points: THREE.Vector3[] = [];
    for (let step = 0; step <= LAUNDRY.WIRE_SEGMENTS; step++) {
        const t = step / LAUNDRY.WIRE_SEGMENTS;
        points.push(
            new THREE.Vector3(
                from.x + (to.x - from.x) * t,
                from.y - Math.sin(t * Math.PI) * sag,
                from.z + (to.z - from.z) * t
            )
        );
    }
    return new THREE.BufferGeometry().setFromPoints(points);
}

// A rug thrown over the top wire: a cloth, the flap that hangs on the far side of
// the line and the dark seam it casts on the snow. Flat quads, no thickness.
function buildRug(frame: THREE.Object3D, wireY: number, sag: number): void {
    const rug = LAUNDRY_PROFILE.RUG;
    const halfSpan = LAUNDRY_PROFILE.SPAN / 2;
    const centerX = -halfSpan + LAUNDRY_PROFILE.SPAN * LAUNDRY.RUG_OFFSET;
    const sagAtPeg = Math.sin(((centerX + halfSpan) / LAUNDRY_PROFILE.SPAN) * Math.PI) * sag;
    const top = wireY - sagAtPeg;
    const bottom = top - rug.HEIGHT;
    const clothMat = makePS1Material({ color: COLORS.RUG, side: THREE.DoubleSide });

    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(rug.WIDTH, rug.HEIGHT), clothMat);
    cloth.position.set(centerX, bottom + rug.HEIGHT / 2, LAUNDRY.RUG_LIFT);
    cloth.rotation.y = 0.06;
    frame.add(cloth);

    const flap = new THREE.Mesh(new THREE.PlaneGeometry(rug.WIDTH, rug.HEIGHT * 0.22), clothMat);
    flap.position.set(centerX + 0.02, top + rug.HEIGHT * 0.09, -LAUNDRY.RUG_LIFT);
    flap.rotation.y = -0.12;
    frame.add(flap);

    const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(rug.WIDTH * 0.8, rug.HEIGHT * 0.4),
        makePS1Material({ color: COLORS.VOID_SOFT }, { vertexSnap: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(centerX, 0.03, 0);
    frame.add(shadow);
}

function buildLaundryFrame(group: THREE.Group, object: ObjectDescriptor): void {
    const { height, anchorY, sag, wires, span, rug } = object.parameters;
    const halfSpan = span / 2;
    const frame = new THREE.Group();
    frame.name = `laundry-${object.id}`;

    const postMat = makePS1Material({ color: COLORS.LAUNDRY_POLE });
    [-1, 1].forEach((side) => {
        const post = new THREE.Mesh(
            new THREE.CylinderGeometry(LAUNDRY.POST_RADIUS, LAUNDRY.POST_RADIUS, height, LAUNDRY.SEGMENTS),
            postMat
        );
        post.position.set(side * halfSpan, height / 2, 0);
        frame.add(post);
    });

    // Wires run between the two posts, stacked down from the anchor height.
    const wireMat = new THREE.LineBasicMaterial({ color: LAUNDRY.WIRE_COLOR });
    for (let index = 0; index < wires; index++) {
        const y = anchorY - index * LAUNDRY.WIRE_STEP;
        frame.add(
            new THREE.Line(
                createCatenary(
                    new THREE.Vector3(-halfSpan, y, 0),
                    new THREE.Vector3(halfSpan, y, 0),
                    sag * (1 - index * LAUNDRY.SAG_FALLOFF)
                ),
                wireMat
            )
        );
    }

    if (rug) buildRug(frame, anchorY, sag);

    frame.position.set(object.transform.x, object.transform.y, object.transform.z);
    frame.rotation.y = object.transform.rotY;
    group.add(frame);
}

function buildBin(group: THREE.Group, object: ObjectDescriptor): void {
    const width = BIN_PROFILE.WIDTH;
    const depth = BIN_PROFILE.DEPTH;
    const height = BIN_PROFILE.HEIGHT;
    const bin = new THREE.Group();
    bin.name = `bin-${object.id}`;

    const body = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        makePS1Material({ color: COLORS.BIN })
    );
    body.position.y = height / 2;
    bin.add(body);

    // Lid: a separate plate, slightly oversized, so the container is not a crate.
    const lid = new THREE.Mesh(
        new THREE.BoxGeometry(width + BIN.LID_OVERHANG, BIN_PROFILE.LID_HEIGHT, depth + BIN.LID_OVERHANG),
        darkFrameMat
    );
    lid.position.y = height + BIN_PROFILE.LID_HEIGHT / 2;
    bin.add(lid);

    // Rim of packed snow on the lid: the one detail that keeps the containers in
    // the same February frame as the fences and the snow caps.
    const snow = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.7, BIN.RIM_HEIGHT * 0.5, depth * 0.6),
        makePS1Material({ color: COLORS.SNOW_SOIL })
    );
    snow.position.y = height + BIN_PROFILE.LID_HEIGHT + BIN.RIM_HEIGHT * 0.2;
    bin.add(snow);

    bin.position.set(object.transform.x, object.transform.y, object.transform.z);
    bin.rotation.y = object.transform.rotY;
    group.add(bin);
}

export function buildCourtyardDetails(group: THREE.Group, collision: CollisionWorld, layout: Layout): void {
    const frames = objectsOfType(layout, 'laundry-frame');
    const bins = objectsOfType(layout, 'bin');

    frames.forEach((object) => buildLaundryFrame(group, object));
    bins.forEach((object) => buildBin(group, object));

    [...frames, ...bins].forEach((object) => registerColliders(collision, object));
}
