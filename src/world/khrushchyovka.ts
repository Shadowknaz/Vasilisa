// Khrushchyovka district. The model is the five-storey prefab panel block of the
// standalone home.html diorama, rebuilt at the 1:1 scale of this courtyard and
// stitched to the frozen layout: the plan owns the section count, the porch bays
// and every collider, the three facade/roof modules only add the skin, and the
// interior layer adds the walkable stairwell of the one porch the district opened.
import { COLORS } from '../config/colors.js';
import { makePS1Material } from '../core/ps1Material.js';
import { GAS_PIPE, createBodyShape, createShell, flushShell } from './khrushchyovkaShell.js';
import { buildKhrushchyovkaFacade } from './khrushchyovkaFacade.js';
import { buildKhrushchyovkaRoof } from './khrushchyovkaRoof.js';
import { decayFor } from './khrushchyovkaDecay.js';
import { buildBuildingInteriors, type InteriorInstance } from './interiors/index.js';
import { INTERIOR } from './interiors/interiorProfile.js';
import { KHRUSHCHYOVKA, type ObjectDescriptor } from './layout/footprints.js';
import { objectsOfType, registerColliders } from './placement.js';
import type { WallHole } from './khrushchyovkaShell.js';
import type { BodyShape } from './khrushchyovkaShell.js';
import type { InteriorDescriptor } from './interiors/interiorSelection.js';
import type { Layout } from './layout/createLayout.js';
import type { CollisionWorld } from '../systems/collision.js';
import * as THREE from 'three';

const gasPipeMat = makePS1Material({ color: COLORS.GAS_PIPE });

function addGasPipe(group: THREE.Group, width: number, body: BodyShape): void {
    const z = body.frontPlane + GAS_PIPE.PROUD;
    const y = body.plinthHeight + GAS_PIPE.HEIGHT_ABOVE_PLINTH;
    const length = width - GAS_PIPE.END_INSET * 2;

    // Yellow-ochre distribution line running along the first floor facade
    const line = new THREE.Mesh(
        new THREE.CylinderGeometry(GAS_PIPE.RADIUS, GAS_PIPE.RADIUS, length, GAS_PIPE.SEGMENTS),
        gasPipeMat
    );
    line.rotation.z = Math.PI / 2;
    line.position.set(0, y, z);
    group.add(line);

    // Riser down to the courtyard at the east end, clear of the last canopy
    const dropX = width / 2 - GAS_PIPE.END_INSET;
    const dropHeight = y - GAS_PIPE.DROP_BOTTOM;
    const drop = new THREE.Mesh(
        new THREE.CylinderGeometry(GAS_PIPE.RADIUS, GAS_PIPE.RADIUS, dropHeight, GAS_PIPE.SEGMENTS),
        gasPipeMat
    );
    drop.position.set(dropX, GAS_PIPE.DROP_BOTTOM + dropHeight / 2, z);
    group.add(drop);
}

function createKhrushchyovka(
    group: THREE.Group,
    collision: CollisionWorld,
    object: ObjectDescriptor,
    interiors: InteriorInstance[]
): void {
    const sections: number = object.parameters.sections;
    const porchXs: number[] = object.parameters.porchXs;
    const interior = object.parameters.interior as InteriorDescriptor | null;
    const body = createBodyShape(sections);
    const shell = createShell();
    // The block, not the district, owns its history: which sashes are gone, which
    // balcony patchwork it wears and which flat burned.
    const decay = decayFor(object.id);

    // The doorway of an opened porch is a hole in the panel, not a black decal:
    // its visible bottom is the plinth top, which is where the interior floor is.
    const doorway: WallHole | null = interior
        ? {
              minX: interior.porchX - INTERIOR.PORCH_DOOR.WIDTH / 2,
              maxX: interior.porchX + INTERIOR.PORCH_DOOR.WIDTH / 2,
              minY: KHRUSHCHYOVKA.PLINTH_HEIGHT,
              maxY: KHRUSHCHYOVKA.PLINTH_HEIGHT + INTERIOR.PORCH_DOOR.HEIGHT
          }
        : null;

    buildKhrushchyovkaFacade(shell, body, sections, porchXs, decay, doorway, interior ? interior.porchIndex : -1);
    buildKhrushchyovkaRoof(shell, body, sections, decay.roof);

    const buildingGroup = new THREE.Group();
    buildingGroup.name = object.id;
    buildingGroup.position.set(object.transform.x, object.transform.y, object.transform.z);
    buildingGroup.rotation.y = object.transform.rotY;
    flushShell(shell, buildingGroup);
    addGasPipe(buildingGroup, body.width, body);
    buildBuildingInteriors(buildingGroup, interiors);

    group.add(buildingGroup);
    registerColliders(collision, object);
}

// Body + one porch box per entrance: 4 AABBs per building, 16 in the district.
// A block with an opened interior adds the notch around its doorway and splits
// that porch into two flanks, so the walkway to the door is real.
export function buildKhrushchyovkaDistrict(
    group: THREE.Group,
    collision: CollisionWorld,
    layout: Layout,
    interiors: InteriorInstance[]
): void {
    objectsOfType(layout, 'khrushchyovka').forEach((object) => {
        const owned = interiors.filter((instance) => instance.buildingId === object.id);
        createKhrushchyovka(group, collision, object, owned);
    });
}
