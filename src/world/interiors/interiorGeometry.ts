// Geometry of the interiors. One merged quad builder per material and per block:
// three interiors of the district cost seven draw calls each at worst, not one
// per wall. Boxes keep the face-local UVs of the facade (`addBox` of the shell),
// floors and ceilings are single horizontal planes, panes are one sash quad.
//
// Door leaves are the only separate meshes: a leaf has a hinge and a state, and a
// merged wall cannot turn.
import { COLORS } from '../../config/colors.js';
import { createQuadBuilder, type QuadBuilder } from '../../core/geometryBuilder.js';
import { makePS1Material } from '../../core/ps1Material.js';
import { addBox } from '../khrushchyovkaShell.js';
import { KHRUSHCHYOVKA_TEXTURES } from '../khrushchyovkaTextures.js';
import { INTERIOR } from './interiorProfile.js';
import { INTERIOR_TEXTURES } from './interiorTextures.js';
import type { InteriorMaterial, PlanPane, StairPlan } from './stairwell.js';
import * as THREE from 'three';

// Metres per texture tile per axis.
const TILE: Record<InteriorMaterial, number> = {
    plaster: 1.70,
    concrete: 0.90,
    lino: 2.20,
    whitewash: 1.90,
    wood: 1.10,
    iron: 1.00,
    pane: 1.50
};

// The interiors are the one place the night needs a floor of its own: a room
// behind three walls gets no moon, and a lamp cannot reach a back room. The fill
// is a very dim self-glow of the surfaces, three tones under the courtyard, so a
// dark flat stays readable without turning into a lit one.
const FILL = COLORS.INTERIOR_FILL;

const MATERIALS: Record<InteriorMaterial, THREE.Material> = {
    plaster: makePS1Material({ map: INTERIOR_TEXTURES.plaster, color: COLORS.INTERIOR_WALL, emissive: FILL }),
    concrete: makePS1Material({ map: INTERIOR_TEXTURES.stepConcrete, color: COLORS.INTERIOR_CONCRETE, emissive: FILL }),
    lino: makePS1Material({ map: INTERIOR_TEXTURES.lino, color: COLORS.INTERIOR_FLOOR, emissive: FILL }),
    whitewash: makePS1Material({ map: INTERIOR_TEXTURES.whitewash, color: COLORS.INTERIOR_CEILING, emissive: FILL }),
    wood: makePS1Material({ map: INTERIOR_TEXTURES.doorWood, color: COLORS.INTERIOR_WOOD, emissive: FILL }),
    iron: makePS1Material({ color: COLORS.INTERIOR_IRON }),
    // The pane is the facade's own sash texture seen from the room: dead glass,
    // albedo only. It is not emissive — eleven years without power is the canon.
    pane: makePS1Material({ map: KHRUSHCHYOVKA_TEXTURES.windowDark, color: COLORS.INTERIOR_PANE })
};

type InteriorShell = Record<InteriorMaterial, QuadBuilder>;

export function createInteriorShell(): InteriorShell {
    return {
        plaster: createQuadBuilder(),
        concrete: createQuadBuilder(),
        lino: createQuadBuilder(),
        whitewash: createQuadBuilder(),
        wood: createQuadBuilder(),
        iron: createQuadBuilder(),
        pane: createQuadBuilder()
    };
}

function addPane(quads: QuadBuilder, pane: PlanPane): void {
    quads.addQuad(
        [
            [pane.minX, pane.minY, pane.z],
            [pane.maxX, pane.minY, pane.z],
            [pane.maxX, pane.maxY, pane.z],
            [pane.minX, pane.maxY, pane.z]
        ],
        [0, 0, pane.facing],
        [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1]
        ]
    );
}

export function addInteriorToShell(shell: InteriorShell, plan: StairPlan): void {
    plan.solids.forEach((solid) => {
        const tile = TILE[solid.material];
        addBox(shell[solid.material], solid.box, tile, tile);
    });

    plan.plates.forEach((plate) => {
        shell[plate.material].addPlane(plate.rect, plate.y, TILE[plate.material], plate.up ? 1 : -1);
    });

    plan.panes.forEach((pane) => addPane(shell.pane, pane));

    plan.doors.forEach((door) => {
        door.frame.forEach((box) => addBox(shell.wood, box, TILE.wood, TILE.wood));
    });
}

export function flushInteriorShell(shell: InteriorShell, group: THREE.Group, name: string): number {
    let meshes = 0;
    (Object.keys(shell) as InteriorMaterial[]).forEach((key) => {
        if (shell[key].isEmpty()) return;
        group.add(shell[key].buildMesh(MATERIALS[key], `${name}-interior-${key}`));
        meshes += 1;
    });
    return meshes;
}

// Shut leaves of the flats nobody opened. They are plain meshes, not hinges: a
// door in this district is either a doorway or a panel in the wall.
export function addInteriorLeaves(plan: StairPlan, group: THREE.Group): number {
    plan.doors.forEach((door) => {
        const leaf = new THREE.Mesh(
            new THREE.BoxGeometry(INTERIOR.DOOR.LEAF, door.height, door.width),
            MATERIALS.wood
        );
        leaf.name = `interior-leaf-${door.id}`;
        leaf.position.set(
            door.hingeX,
            INTERIOR.FLOOR + door.level * INTERIOR.STOREY + door.height / 2,
            door.hingeZ - door.width / 2
        );
        group.add(leaf);
    });
    return plan.doors.length;
}
