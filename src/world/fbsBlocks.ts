// Concrete roadblock slabs (ФБС блоки) dropped by the northern curb: leftovers of
// some long-finished works. Every block, its stack height and its lean are placed
// by the layout (TZ §9.7) — the builder never invents a coordinate or a tilt.
import { darkFrameMat } from '../core/materials.js';
import { FBS_PROFILE, type ObjectDescriptor } from './layout/footprints.js';
import { objectsOfType, registerColliders } from './placement.js';
import type { Layout } from './layout/createLayout.js';
import type { CollisionWorld } from '../systems/collision.js';
import * as THREE from 'three';

const BLOCK = {
    SEGMENTS: [2, 1, 1],
    // Every block of a stack is nudged a little: a perfect pile reads as a wall.
    STACK_JITTER: { X: 0.09, Z: 0.07, YAW: 0.06 }
};

function createBlock(group: THREE.Group, object: ObjectDescriptor): void {
    const { x, y, z, rotY } = object.transform;
    const stack: number = object.parameters.stack || 1;
    const lean: number = object.parameters.lean || 0;

    const blockGroup = new THREE.Group();

    for (let level = 0; level < stack; level++) {
        const block = new THREE.Mesh(
            new THREE.BoxGeometry(
                FBS_PROFILE.WIDTH,
                FBS_PROFILE.HEIGHT,
                FBS_PROFILE.DEPTH,
                BLOCK.SEGMENTS[0],
                BLOCK.SEGMENTS[1],
                BLOCK.SEGMENTS[2]
            ),
            darkFrameMat
        );
        block.position.y = FBS_PROFILE.HEIGHT * (level + 0.5);
        if (level > 0) {
            block.position.x = (level % 2 === 0 ? -1 : 1) * BLOCK.STACK_JITTER.X * level;
            block.position.z = BLOCK.STACK_JITTER.Z * level;
            block.rotation.y = BLOCK.STACK_JITTER.YAW * level;
        }
        blockGroup.add(block);
    }

    // A leaning block rests on one edge: lift its centre until the corner of the
    // low side touches the ground, so it never sinks into the snow or floats.
    if (lean !== 0) {
        blockGroup.rotation.z = lean;
        blockGroup.position.y = (FBS_PROFILE.WIDTH / 2) * Math.sin(Math.abs(lean));
    }

    blockGroup.position.x += x;
    blockGroup.position.y += y;
    blockGroup.position.z += z;
    blockGroup.rotation.y += rotY;
    group.add(blockGroup);
}

export function buildFbsBlocks(group: THREE.Group, collision: CollisionWorld, layout: Layout): void {
    const blocks = objectsOfType(layout, 'fbs');
    blocks.forEach((object) => createBlock(group, object));
    blocks.forEach((object) => registerColliders(collision, object));
}
