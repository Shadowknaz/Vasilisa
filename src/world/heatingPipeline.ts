// District heating pipeline fragment (теплотрасса) along the southern service
// strip: a straight twin-pipe bundle on low concrete pillars, no arch over the
// courtyard. The whole run registers as one continuous blocker, so the Mech can
// never slip between two pillars (TZ §9.6).
import { COLORS } from '../config/colors.js';
import { makePS1Material } from '../core/ps1Material.js';
import { PIPELINE_PROFILE } from './layout/footprints.js';
import { objectsOfType, registerColliders } from './placement.js';
import type { Layout } from './layout/createLayout.js';
import type { CollisionWorld } from '../systems/collision.js';
import * as THREE from 'three';

const RUN = {
    PILLAR_TOP_GAP: 0.05
};

function buildPillar(group: THREE.Group, x: number, z: number, height: number, pillarMat: THREE.Material): void {
    const profile = PIPELINE_PROFILE.PILLAR;
    const pillar = new THREE.Mesh(
        new THREE.BoxGeometry(profile.WIDTH, height, profile.DEPTH),
        pillarMat
    );
    pillar.position.set(x, height / 2, z);
    group.add(pillar);
}

// One straight segment of both pipes, plus the dark beam under them.
function buildSegment(group: THREE.Group, pipeMat: THREE.Material, underMat: THREE.Material, fromX: number, toX: number, y: number, z: number): void {
    const length = Math.abs(toX - fromX);
    const midX = (fromX + toX) / 2;

    [-PIPELINE_PROFILE.PIPE_Z_OFFSET, PIPELINE_PROFILE.PIPE_Z_OFFSET].forEach((zOffset) => {
        const pipe = new THREE.Mesh(
            new THREE.CylinderGeometry(
                PIPELINE_PROFILE.PIPE_RADIUS,
                PIPELINE_PROFILE.PIPE_RADIUS,
                length,
                PIPELINE_PROFILE.PIPE_SEGMENTS
            ),
            pipeMat
        );
        pipe.position.set(midX, y, z + zOffset);
        pipe.rotation.z = Math.PI / 2;
        group.add(pipe);

        const under = new THREE.Mesh(
            new THREE.BoxGeometry(length, PIPELINE_PROFILE.UNDER_BEAM.HEIGHT, PIPELINE_PROFILE.UNDER_BEAM.DEPTH),
            underMat
        );
        under.position.set(midX, y - PIPELINE_PROFILE.UNDER_BEAM.HEIGHT, z + zOffset);
        group.add(under);
    });
}

export function buildHeatingPipeline(group: THREE.Group, collision: CollisionWorld, layout: Layout): void {
    const [object] = objectsOfType(layout, 'heating-pipeline');
    if (!object) throw new Error('layout object missing: PIPE-SOUTH');

    const { z, fromX, toX, pillarX, height } = object.parameters;
    const pipeGroup = new THREE.Group();
    const pipeMat = makePS1Material({ color: COLORS.PIPELINE });
    const underMat = new THREE.MeshBasicMaterial({ color: COLORS.PIPELINE_UNDER });
    const pillarMat = new THREE.MeshBasicMaterial({ color: COLORS.PIPELINE_PILLAR });

    const pillarHeight = height - RUN.PILLAR_TOP_GAP;
    pillarX.forEach((x: number) => buildPillar(pipeGroup, x, z, pillarHeight, pillarMat));
    buildSegment(pipeGroup, pipeMat, underMat, fromX, toX, height, z);

    group.add(pipeGroup);
    registerColliders(collision, object);
}
