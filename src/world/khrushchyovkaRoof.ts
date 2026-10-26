// Flat roof of the Khrushchyovka: dark cornice band, concrete parapet, bitumen
// field, one ventilation shaft per section, the stair bulkhead and skeletal Yagi
// antennas. Ported from the standalone home.html diorama and kept inside the
// 22.5 m silhouette the layout reserved for a building.
//
// Eleven winters later the roof is the one part of a block that reads from the
// isometric camera as pure outline, so the damage lives here: how many masts are
// still standing, which one is bent at the joint, whether the hatch was closed,
// which parapet block the frost pushed out and what lies on the bitumen.
import { TILE, addBox, sectionOffset } from './khrushchyovkaShell.js';
import type { BodyShape, Shell } from './khrushchyovkaShell.js';
import type { RoofDamage, RoofDebris } from './khrushchyovkaDecay.js';

const ROOF = {
    BAND: { EXTRA: 0.24, HEIGHT: 0.3 },
    PARAPET: {
        EXTRA: 0.26,
        HEIGHT: 0.62,
        THICKNESS: 0.3,
        // Width of the knocked-out block and what is left of it on the bitumen.
        GAP: 1.7,
        RUBBLE: {
            COUNT: 4,
            MIN: 0.34,
            MAX: 0.62,
            SPREAD: 1.1,
            INSET: 0.42,
            FALLEN: 0.75
        }
    },
    TAR: { INSET: 0.18, HEIGHT: 0.14 },
    VENT: {
        WIDTH: 1.8,
        DEPTH: 1.2,
        HEIGHT: 1.45,
        Z: 1.5,
        Z_SPREAD: 0.5,
        CAP: { EXTRA: 0.22, HEIGHT: 0.1 },
        LOUVER: { WIDTH: 1.2, HEIGHT: 0.5, DEPTH: 0.04, Y_RATIO: 0.35 },
        // Share of the shaft opening that stays open when the cap is gone.
        OPENING: 0.85
    },
    HATCH: {
        WIDTH: 2.9,
        DEPTH: 2.3,
        HEIGHT: 1.6,
        INSET: 4.5,
        Z: 2.2,
        LID: 0.12,
        LID_OVERHANG: 0.1,
        DOOR: { WIDTH: 1.2, HEIGHT: 1.5, INSET: 0.01, PROUD: 0.05 },
        // The torn leaf lies flat on the bitumen beside the bulkhead.
        LEAF: { X: 1.9, Z: -0.35, THICKNESS: 0.06 }
    },
    ANTENNA: {
        COUNT: 3,
        MAST_HEIGHT: 1.35,
        MAST: 0.09,
        CROSSBAR_WIDTH: 1.5,
        CROSSBAR_HEIGHT: 0.07,
        LOWER_AT: 0.72,
        UPPER_AT: 0.94,
        UPPER_WIDTH_RATIO: 0.72,
        ELEMENTS: 4,
        ELEMENT: 0.5,
        ELEMENT_SHIFT: 0.25,
        SINGLE_RATIO: 0.5,
        STAGGER: 0.6,
        SPREAD_INSET: 3.2,
        Z: -2.6,
        // A mast bent at the joint: the upper run leaves the axis and the top
        // crossbar goes with the wind.
        BEND: { SHIFT: 0.3, JOINT: 0.55, UPPER: 0.42 }
    },
    DEBRIS: {
        SHEET: { WIDTH: 1.5, HEIGHT: 1.3, THICKNESS: 0.06 },
        PIPE: { WIDTH: 0.14, HEIGHT: 1.5 },
        PILE: { WIDTH: 1.1, HEIGHT: 0.55, DEPTH: 0.8, CHUNKS: 3 }
    }
};

function addParapetRun(
    shell: Shell,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    minZ: number,
    maxZ: number
): void {
    addBox(shell.parapet, { minX, maxX, minY, maxY, minZ, maxZ }, TILE.CONCRETE.U, TILE.CONCRETE.V);
}

// What is left of the knocked-out block: chunks on the bitumen at the edge and a
// couple that slid inwards. Sizes cycle through the profile, so the pile is the
// same on every page load without a random draw.
function addParapetRubble(shell: Shell, x: number, innerZ: number, base: number): void {
    const rubble = ROOF.PARAPET.RUBBLE;
    const step = rubble.SPREAD / (rubble.COUNT - 1);
    for (let index = 0; index < rubble.COUNT; index++) {
        const size = rubble.MIN + ((index % 2) * (rubble.MAX - rubble.MIN)) / 2;
        const chunkX = x - rubble.SPREAD / 2 + step * index;
        const fallen = index % 2 === 1;
        const chunkZ = fallen ? innerZ - rubble.FALLEN : innerZ - rubble.INSET;
        addBox(
            shell.plinth,
            {
                minX: chunkX - size / 2,
                maxX: chunkX + size / 2,
                minY: base,
                maxY: base + size * 0.55,
                minZ: chunkZ - size / 2,
                maxZ: chunkZ + size / 2
            },
            TILE.CONCRETE.U,
            TILE.CONCRETE.V
        );
    }
}

function addCornice(shell: Shell, body: BodyShape, sections: number, gapSection: number): void {
    addBox(
        shell.plinth,
        {
            minX: -body.width / 2 - ROOF.BAND.EXTRA / 2,
            maxX: body.width / 2 + ROOF.BAND.EXTRA / 2,
            minY: body.roofY - ROOF.BAND.HEIGHT / 2,
            maxY: body.roofY + ROOF.BAND.HEIGHT / 2,
            minZ: -body.depth / 2 - ROOF.BAND.EXTRA / 2,
            maxZ: body.depth / 2 + ROOF.BAND.EXTRA / 2
        },
        TILE.CONCRETE.U,
        TILE.CONCRETE.V
    );

    // Parapet ring: the only bright top surface of the block, exactly as the
    // reference diorama reads from above. One block of the courtyard face of one
    // building is gone, and the notch is what the eye catches from the iso camera.
    const halfX = body.width / 2 + ROOF.PARAPET.EXTRA / 2;
    const halfZ = body.depth / 2 + ROOF.PARAPET.EXTRA / 2;
    const parapetTop = body.roofY + ROOF.PARAPET.HEIGHT;
    const gapX = gapSection >= 0 ? sectionOffset(gapSection, sections) : null;

    [1, -1].forEach((side) => {
        const z0 = side > 0 ? halfZ - ROOF.PARAPET.THICKNESS : -halfZ;
        const z1 = side > 0 ? halfZ : -halfZ + ROOF.PARAPET.THICKNESS;

        if (gapX !== null && side > 0) {
            const half = ROOF.PARAPET.GAP / 2;
            addParapetRun(shell, -halfX, gapX - half, body.roofY, parapetTop, z0, z1);
            addParapetRun(shell, gapX + half, halfX, body.roofY, parapetTop, z0, z1);
            addParapetRubble(shell, gapX, z0, body.roofY + ROOF.TAR.HEIGHT);
        } else {
            addParapetRun(shell, -halfX, halfX, body.roofY, parapetTop, z0, z1);
        }

        addParapetRun(
            shell,
            side > 0 ? halfX - ROOF.PARAPET.THICKNESS : -halfX,
            side > 0 ? halfX : -halfX + ROOF.PARAPET.THICKNESS,
            body.roofY,
            parapetTop,
            -halfZ + ROOF.PARAPET.THICKNESS,
            halfZ - ROOF.PARAPET.THICKNESS
        );
    });

    // Bitumen field, recessed inside the parapet
    addBox(
        shell.roofTar,
        {
            minX: -body.width / 2 + ROOF.TAR.INSET,
            maxX: body.width / 2 - ROOF.TAR.INSET,
            minY: body.roofY,
            maxY: body.roofY + ROOF.TAR.HEIGHT,
            minZ: -body.depth / 2 + ROOF.TAR.INSET,
            maxZ: body.depth / 2 - ROOF.TAR.INSET
        },
        TILE.ROOF.U,
        TILE.ROOF.V
    );
}

function addVentShaft(shell: Shell, body: BodyShape, sections: number, openVent: number): void {
    const vent = ROOF.VENT;
    for (let section = 0; section < sections; section++) {
        const x = sectionOffset(section, sections);
        const z = section % 2 === 0 ? -vent.Z : -vent.Z + vent.Z_SPREAD;
        const base = body.roofY + ROOF.TAR.HEIGHT;
        addBox(
            shell.trim,
            { minX: x - vent.WIDTH / 2, maxX: x + vent.WIDTH / 2, minY: base, maxY: base + vent.HEIGHT, minZ: z - vent.DEPTH / 2, maxZ: z + vent.DEPTH / 2 },
            TILE.CONCRETE.U,
            TILE.CONCRETE.V
        );

        if (section === openVent) {
            // The cap went down in the wind: an open shaft, black to the bottom.
            const half = (vent.OPENING * vent.WIDTH) / 2;
            const halfDepth = (vent.OPENING * vent.DEPTH) / 2;
            addBox(
                shell.void,
                { minX: x - half, maxX: x + half, minY: base + vent.HEIGHT - 0.02, maxY: base + vent.HEIGHT + 0.02, minZ: z - halfDepth, maxZ: z + halfDepth },
                TILE.CONCRETE.U,
                TILE.CONCRETE.V
            );
            continue;
        }

        addBox(
            shell.plinth,
            {
                minX: x - vent.WIDTH / 2 - vent.CAP.EXTRA / 2,
                maxX: x + vent.WIDTH / 2 + vent.CAP.EXTRA / 2,
                minY: base + vent.HEIGHT,
                maxY: base + vent.HEIGHT + vent.CAP.HEIGHT,
                minZ: z - vent.DEPTH / 2 - vent.CAP.EXTRA / 2,
                maxZ: z + vent.DEPTH / 2 + vent.CAP.EXTRA / 2
            },
            TILE.CONCRETE.U,
            TILE.CONCRETE.V
        );
        addBox(
            shell.iron,
            {
                minX: x - vent.LOUVER.WIDTH / 2,
                maxX: x + vent.LOUVER.WIDTH / 2,
                minY: base + vent.HEIGHT * vent.LOUVER.Y_RATIO,
                maxY: base + vent.HEIGHT * vent.LOUVER.Y_RATIO + vent.LOUVER.HEIGHT,
                minZ: z + vent.DEPTH / 2,
                maxZ: z + vent.DEPTH / 2 + vent.LOUVER.DEPTH
            },
            TILE.RUST.U,
            TILE.RUST.V
        );
    }
}

function addStairBulkhead(shell: Shell, body: BodyShape, torn: boolean): void {
    const hatch = ROOF.HATCH;
    const x = body.width / 2 - hatch.INSET;
    const base = body.roofY + ROOF.TAR.HEIGHT;
    addBox(
        shell.side,
        {
            minX: x - hatch.WIDTH / 2,
            maxX: x + hatch.WIDTH / 2,
            minY: base,
            maxY: base + hatch.HEIGHT,
            minZ: hatch.Z - hatch.DEPTH / 2,
            maxZ: hatch.Z + hatch.DEPTH / 2
        },
        TILE.SIDE.U,
        TILE.SIDE.V
    );
    addBox(
        shell.roofTar,
        {
            minX: x - hatch.WIDTH / 2 - hatch.LID_OVERHANG,
            maxX: x + hatch.WIDTH / 2 + hatch.LID_OVERHANG,
            minY: base + hatch.HEIGHT,
            maxY: base + hatch.HEIGHT + hatch.LID,
            minZ: hatch.Z - hatch.DEPTH / 2 - hatch.LID_OVERHANG,
            maxZ: hatch.Z + hatch.DEPTH / 2 + hatch.LID_OVERHANG
        },
        TILE.ROOF.U,
        TILE.ROOF.V
    );

    const doorMinX = x - hatch.DOOR.WIDTH / 2;
    const doorMaxX = x + hatch.DOOR.WIDTH / 2;
    const doorMinZ = hatch.Z - hatch.DEPTH / 2 - hatch.DOOR.INSET;
    const doorMaxZ = hatch.Z - hatch.DEPTH / 2 + hatch.DOOR.PROUD;

    if (torn) {
        // Nobody closed it for eleven years: the doorway is a hole and the leaf
        // lies flat on the bitumen beside the bulkhead.
        addBox(
            shell.void,
            { minX: doorMinX, maxX: doorMaxX, minY: base, maxY: base + hatch.DOOR.HEIGHT, minZ: doorMinZ, maxZ: doorMaxZ },
            TILE.CONCRETE.U,
            TILE.CONCRETE.V
        );
        addBox(
            shell.rust,
            {
                minX: x + hatch.LEAF.X - hatch.DOOR.WIDTH / 2,
                maxX: x + hatch.LEAF.X + hatch.DOOR.WIDTH / 2,
                minY: base,
                maxY: base + hatch.LEAF.THICKNESS,
                minZ: hatch.Z + hatch.LEAF.Z - hatch.DOOR.HEIGHT / 2,
                maxZ: hatch.Z + hatch.LEAF.Z + hatch.DOOR.HEIGHT / 2
            },
            TILE.RUST.U,
            TILE.RUST.V
        );
        return;
    }

    addBox(
        shell.rust,
        { minX: doorMinX, maxX: doorMaxX, minY: base, maxY: base + hatch.DOOR.HEIGHT, minZ: doorMinZ, maxZ: doorMaxZ },
        TILE.RUST.U,
        TILE.RUST.V
    );
}

function addMast(shell: Shell, x: number, z: number, minY: number, maxY: number): void {
    const mast = ROOF.ANTENNA.MAST;
    addBox(
        shell.rust,
        { minX: x - mast / 2, maxX: x + mast / 2, minY, maxY, minZ: z - mast / 2, maxZ: z + mast / 2 },
        TILE.RUST.U,
        TILE.RUST.V
    );
}

function addCrossbar(shell: Shell, x: number, z: number, y: number, ratio: number, elements: number): void {
    const antenna = ROOF.ANTENNA;
    const width = antenna.CROSSBAR_WIDTH * ratio;
    addBox(
        shell.rust,
        {
            minX: x - width / 2,
            maxX: x + width / 2,
            minY: y - antenna.CROSSBAR_HEIGHT / 2,
            maxY: y + antenna.CROSSBAR_HEIGHT / 2,
            minZ: z - antenna.CROSSBAR_HEIGHT / 2,
            maxZ: z + antenna.CROSSBAR_HEIGHT / 2
        },
        TILE.RUST.U,
        TILE.RUST.V
    );

    const step = width / (antenna.ELEMENTS + 1);
    for (let index = 0; index <= elements; index++) {
        const elementX = x - width / 2 + step * index;
        addBox(
            shell.rust,
            {
                minX: elementX - antenna.CROSSBAR_HEIGHT / 2,
                maxX: elementX + antenna.CROSSBAR_HEIGHT / 2,
                minY: y,
                maxY: y + antenna.CROSSBAR_HEIGHT,
                minZ: z - antenna.ELEMENT / 2,
                maxZ: z + antenna.ELEMENT / 2
            },
            TILE.RUST.U,
            TILE.RUST.V
        );
    }
}

function addAntenna(shell: Shell, x: number, z: number, baseY: number, bent: boolean): void {
    const antenna = ROOF.ANTENNA;

    if (bent) {
        // The mast broke at the joint: the upper run leaves the axis, the top
        // crossbar is gone with the wind and only the lower directors are left.
        const jointY = baseY + antenna.MAST_HEIGHT * antenna.BEND.JOINT;
        addMast(shell, x, z, baseY, jointY);
        addMast(shell, x + antenna.BEND.SHIFT, z, jointY - 0.02, jointY + antenna.MAST_HEIGHT * antenna.BEND.UPPER);
        addCrossbar(shell, x, z, jointY, 1, 2);
        return;
    }

    const mastTop = baseY + antenna.MAST_HEIGHT;
    addMast(shell, x, z, baseY, mastTop);
    addCrossbar(shell, x, z, baseY + antenna.MAST_HEIGHT * antenna.LOWER_AT, 1, antenna.ELEMENTS);
    addCrossbar(shell, x, z, baseY + antenna.MAST_HEIGHT * antenna.UPPER_AT, antenna.UPPER_WIDTH_RATIO, 0);
}

function addAntennas(shell: Shell, body: BodyShape, roof: RoofDamage): void {
    const antenna = ROOF.ANTENNA;
    const base = body.roofY + ROOF.TAR.HEIGHT;
    const spread = body.width / 2 - antenna.SPREAD_INSET;
    const count = Math.max(0, Math.min(antenna.COUNT, roof.antennas));
    for (let index = 0; index < count; index++) {
        const ratio = count === 1 ? antenna.SINGLE_RATIO : index / (count - 1);
        const x = -spread + spread * 2 * ratio;
        addAntenna(shell, x, antenna.Z + (index % 2) * antenna.STAGGER, base, index === roof.bentAntenna);
    }
}

// Loose objects on the bitumen. Only the tall ones matter: they are what breaks
// the parapet line from the isometric camera.
function addDebris(shell: Shell, item: RoofDebris, base: number): void {
    if (item.kind === 'sheet') {
        const sheet = ROOF.DEBRIS.SHEET;
        addBox(
            shell.slate,
            {
                minX: item.x - sheet.WIDTH / 2,
                maxX: item.x + sheet.WIDTH / 2,
                minY: base,
                maxY: base + sheet.HEIGHT,
                minZ: item.z - sheet.THICKNESS / 2,
                maxZ: item.z + sheet.THICKNESS / 2
            },
            TILE.SLATE.U,
            TILE.SLATE.V
        );
        return;
    }

    if (item.kind === 'pipe') {
        const pipe = ROOF.DEBRIS.PIPE;
        addBox(
            shell.rust,
            {
                minX: item.x - pipe.WIDTH / 2,
                maxX: item.x + pipe.WIDTH / 2,
                minY: base,
                maxY: base + pipe.HEIGHT,
                minZ: item.z - pipe.WIDTH / 2,
                maxZ: item.z + pipe.WIDTH / 2
            },
            TILE.RUST.U,
            TILE.RUST.V
        );
        return;
    }

    // A pile of brick and concrete torn off the vent shaft
    const pile = ROOF.DEBRIS.PILE;
    for (let index = 0; index < pile.CHUNKS; index++) {
        const scale = 0.45 + index * 0.18;
        const offsetX = (index - 1) * pile.WIDTH * 0.3;
        const offsetZ = (index % 2 === 0 ? -1 : 1) * pile.DEPTH * 0.2;
        addBox(
            shell.plinth,
            {
                minX: item.x + offsetX - (pile.WIDTH * scale) / 2,
                maxX: item.x + offsetX + (pile.WIDTH * scale) / 2,
                minY: base,
                maxY: base + pile.HEIGHT * scale,
                minZ: item.z + offsetZ - (pile.DEPTH * scale) / 2,
                maxZ: item.z + offsetZ + (pile.DEPTH * scale) / 2
            },
            TILE.CONCRETE.U,
            TILE.CONCRETE.V
        );
    }
}

function addRoofDebris(shell: Shell, body: BodyShape, roof: RoofDamage): void {
    const base = body.roofY + ROOF.TAR.HEIGHT;
    roof.debris.forEach((item) => addDebris(shell, item, base));
}

export function buildKhrushchyovkaRoof(shell: Shell, body: BodyShape, sections: number, decay: RoofDamage): void {
    addCornice(shell, body, sections, decay.parapetGap);
    addVentShaft(shell, body, sections, decay.openVent);
    addStairBulkhead(shell, body, decay.hatch === 'torn');
    addAntennas(shell, body, decay);
    addRoofDebris(shell, body, decay);
}
