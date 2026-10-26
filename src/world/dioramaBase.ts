// Diorama island: courtyard ground, subterranean pedestal, cut-away pipes and stencil pad.
// The ground is flattened under every pavement/building mask before the surface
// plates are laid, otherwise the terrain pokes through the asphalt (TZ §6.1). The
// relief is read from the same surface field the pavement plates and the
// searchlight pool use, so the two can never disagree about how high the ground is.
import { COLORS } from '../config/colors.js';
import { DIORAMA, SURFACE } from '../config/world.js';
import { makePS1Material } from '../core/ps1Material.js';
import { textures } from '../core/textures.js';
import { STENCIL_PAD, type SurfaceField } from './surfaceField.js';
import * as THREE from 'three';

const FLAT_ROTATION = -Math.PI / 2;
const PEDESTAL_SEGMENTS_XZ = 8;
const PEDESTAL_SEGMENTS_Y = 2;
const SIDE_PIPE = {
    OUTER_RADIUS: 0.65,
    LENGTH: 3.2,
    INNER_RADIUS: 0.48,
    INNER_LENGTH: 3.3,
    SEGMENTS: 8,
    PROTRUSION: 0.6
};
const PIPE_PLACEMENTS = [
    { x: DIORAMA.SIZE / 2 + SIDE_PIPE.PROTRUSION, y: -2.4, z: 8, rotY: 0 },
    { x: DIORAMA.SIZE / 2 + SIDE_PIPE.PROTRUSION, y: -2.4, z: 10.2, rotY: 0 },
    { x: -12, y: -3.1, z: DIORAMA.SIZE / 2 + SIDE_PIPE.PROTRUSION, rotY: Math.PI / 2 },
    { x: 14, y: -2.0, z: DIORAMA.SIZE / 2 + SIDE_PIPE.PROTRUSION, rotY: Math.PI / 2 }
];
const STENCIL_PAD_PLATE = {
    SEGMENTS_X: 4,
    SEGMENTS_Y: 2,
    Y: SURFACE.PAVING
};

function buildGround(group: THREE.Group, surface: SurfaceField): THREE.Mesh {
    // Dense vertex grid so the Mech's spotlight & impact light strongly brighten the ground
    const geometry = new THREE.PlaneGeometry(
        DIORAMA.SIZE,
        DIORAMA.SIZE,
        DIORAMA.GROUND_SEGMENTS,
        DIORAMA.GROUND_SEGMENTS
    );
    const position = geometry.attributes.position;

    for (let i = 0; i < position.count; i++) {
        const vx = position.getX(i);
        // The plane is rotated flat afterwards, so local +Y maps to world -Z and
        // local +Z maps to world up.
        const worldZ = -position.getY(i);
        const height = surface.groundHeightAt(vx, worldZ);
        if (height === 0) continue;
        position.setZ(i, height);
    }
    geometry.computeVertexNormals();

    const uv = geometry.attributes.uv;
    const SNOW_TILE = 2.4;
    for (let i = 0; i < uv.count; i++) {
        const vx = position.getX(i);
        const worldZ = -position.getY(i);
        uv.setXY(i, (vx + DIORAMA.SIZE / 2) / SNOW_TILE, (worldZ + DIORAMA.SIZE / 2) / SNOW_TILE);
    }

    // No vertex snap: the terrain is one half of every ground/plate depth pair,
    // and a snapped tessellation fights an unsnapped one (see core/ps1Material.ts).
    const material = makePS1Material({ map: textures.winterSnow, color: COLORS.SNOW }, { vertexSnap: false });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = FLAT_ROTATION;
    mesh.name = 'ground';
    group.add(mesh);
    return mesh;
}

function buildPedestal(group: THREE.Group): void {
    // Deep black subterranean cut block for stark silhouette framing of the diorama island
    const pedestal = new THREE.Mesh(
        new THREE.BoxGeometry(
            DIORAMA.SIZE,
            DIORAMA.DEPTH,
            DIORAMA.SIZE,
            PEDESTAL_SEGMENTS_XZ,
            PEDESTAL_SEGMENTS_Y,
            PEDESTAL_SEGMENTS_XZ
        ),
        makePS1Material({ color: COLORS.PEDESTAL }, { vertexSnap: false })
    );
    pedestal.position.y = -DIORAMA.DEPTH / 2 - DIORAMA.PEDESTAL_GAP;
    group.add(pedestal);

    // Pitch-black bottom trim of the diorama
    const subBase = new THREE.Mesh(
        new THREE.BoxGeometry(
            DIORAMA.SIZE - DIORAMA.SUB_BASE_INSET,
            DIORAMA.SUB_BASE_HEIGHT,
            DIORAMA.SIZE - DIORAMA.SUB_BASE_INSET
        ),
        new THREE.MeshBasicMaterial({ color: COLORS.SUB_BASE })
    );
    subBase.position.y = -DIORAMA.DEPTH - DIORAMA.SUB_BASE_HEIGHT / 2;
    group.add(subBase);
}

function addSidePipe(group: THREE.Group, { x, y, z, rotY }: { x: number; y: number; z: number; rotY: number }): void {
    const pipeGroup = new THREE.Group();

    const outer = new THREE.Mesh(
        new THREE.CylinderGeometry(
            SIDE_PIPE.OUTER_RADIUS,
            SIDE_PIPE.OUTER_RADIUS,
            SIDE_PIPE.LENGTH,
            SIDE_PIPE.SEGMENTS
        ),
        makePS1Material({ color: COLORS.SIDE_PIPE })
    );
    outer.rotation.z = Math.PI / 2;
    pipeGroup.add(outer);

    const inner = new THREE.Mesh(
        new THREE.CylinderGeometry(
            SIDE_PIPE.INNER_RADIUS,
            SIDE_PIPE.INNER_RADIUS,
            SIDE_PIPE.INNER_LENGTH,
            SIDE_PIPE.SEGMENTS
        ),
        new THREE.MeshBasicMaterial({ color: COLORS.VOID })
    );
    inner.rotation.z = Math.PI / 2;
    pipeGroup.add(inner);

    pipeGroup.position.set(x, y, z);
    pipeGroup.rotation.y = rotY;
    group.add(pipeGroup);
}

function buildSidePipes(group: THREE.Group): void {
    // Subterranean sewer/heating pipes protruding from the cut sides of the diorama
    PIPE_PLACEMENTS.forEach((placement) => addSidePipe(group, placement));
}

function buildStencilPad(group: THREE.Group): void {
    // Stenciled concrete landing pad next to the Mech (diegetic controls reminder)
    const pad = new THREE.Mesh(
        new THREE.PlaneGeometry(
            STENCIL_PAD.WIDTH,
            STENCIL_PAD.DEPTH,
            STENCIL_PAD_PLATE.SEGMENTS_X,
            STENCIL_PAD_PLATE.SEGMENTS_Y
        ),
        makePS1Material({ map: textures.stencilPad }, { vertexSnap: false })
    );
    pad.rotation.x = FLAT_ROTATION;
    pad.position.set(STENCIL_PAD.X, STENCIL_PAD_PLATE.Y, STENCIL_PAD.Z);
    group.add(pad);
}

export function buildDioramaBase(group: THREE.Group, surface: SurfaceField): { groundMesh: THREE.Mesh } {
    const groundMesh = buildGround(group, surface);
    buildPedestal(group);
    buildSidePipes(group);
    buildStencilPad(group);
    return { groundMesh };
}
