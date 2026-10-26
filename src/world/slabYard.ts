// PAG-14 plate field in the kiosk apron, ported from code_artifact.html §5.2:
// cracked concrete slabs with a frozen joint, frost heave and pockets of snow in
// the seams. It is a paving inlay, not a second floor: the plates ride 1.5 cm
// above the apron plate, and the descriptor's footprint flattens the terrain
// under them through the surface field.
import { COLORS } from '../config/colors.js';
import { SURFACE } from '../config/world.js';
import { createQuadBuilder } from '../core/geometryBuilder.js';
import { snowCapMat } from '../core/materials.js';
import { makePS1Material } from '../core/ps1Material.js';
import { createSeededRandom } from '../core/random.js';
import { PAG_SLAB_PROFILE, pagSlabSize, type ObjectDescriptor } from './layout/footprints.js';
import { objectsOfType } from './placement.js';
import type { Layout } from './layout/createLayout.js';
import * as THREE from 'three';

const SLAB = {
    // Bottom of the plates, above the apron paving (SURFACE.PAVING).
    BASE_LIFT: 0.015,
    SUBBASE: { LIFT: 0.002 },
    // Frozen ground heaves every seventh plate; the rest only jitter a few mm.
    HEAVE: { EVERY: 7, LIFT: 0.012, JITTER: 0.006 },
    SNOW: { EVERY: 3, WIDTH: 0.16, HEIGHT: 0.012 },
    TILE: { CONCRETE: 1.2, SNOW: 1.8 }
};

function buildSlabYard(group: THREE.Group, object: ObjectDescriptor): void {
    const { x, z } = object.transform;
    const parameters = object.parameters;
    const cols: number = parameters.cols;
    const rows: number = parameters.rows;
    const size = pagSlabSize(cols, rows);
    const random = createSeededRandom(parameters.seed);

    const light = createQuadBuilder();
    const dark = createQuadBuilder();
    const subBase = createQuadBuilder();
    const snow = createQuadBuilder();

    const base = SURFACE.PAVING + SLAB.BASE_LIFT;
    const plateWidth = PAG_SLAB_PROFILE.PLATE_WIDTH;
    const plateDepth = PAG_SLAB_PROFILE.PLATE_DEPTH;

    subBase.addBox(
        {
            minX: -size.width / 2,
            maxX: size.width / 2,
            minZ: -size.depth / 2,
            maxZ: size.depth / 2,
            minY: SURFACE.PAVING + SLAB.SUBBASE.LIFT,
            maxY: base
        },
        SLAB.TILE.CONCRETE
    );

    const startX = -size.width / 2 + plateWidth / 2;
    const startZ = -size.depth / 2 + plateDepth / 2;

    for (let row = 0; row < rows; row++) {
        for (let column = 0; column < cols; column++) {
            const cx = startX + column * (plateWidth + PAG_SLAB_PROFILE.GAP);
            const cz = startZ + row * (plateDepth + PAG_SLAB_PROFILE.GAP);
            const heaved = (row * 5 + column * 3) % SLAB.HEAVE.EVERY === 0;
            const lift = heaved ? SLAB.HEAVE.LIFT : random() * SLAB.HEAVE.JITTER;
            const bottom = base + lift;
            const top = bottom + PAG_SLAB_PROFILE.THICKNESS;
            const builder = (row * 3 + column) % 3 === 0 ? dark : light;

            builder.addBox(
                {
                    minX: cx - plateWidth / 2,
                    maxX: cx + plateWidth / 2,
                    minZ: cz - plateDepth / 2,
                    maxZ: cz + plateDepth / 2,
                    minY: bottom,
                    maxY: top
                },
                SLAB.TILE.CONCRETE
            );

            // Snow packed into some of the seams: a strip along one plate edge,
            // not a plate of its own (a white plate on a plate reads as paper).
            if ((row + column * 2) % SLAB.SNOW.EVERY === 0) {
                const alongX = row % 2 === 0;
                snow.addBox(
                    alongX
                        ? {
                              minX: cx - plateWidth / 2,
                              maxX: cx + plateWidth / 2,
                              minZ: cz - plateDepth / 2,
                              maxZ: cz - plateDepth / 2 + SLAB.SNOW.WIDTH,
                              minY: top,
                              maxY: top + SLAB.SNOW.HEIGHT
                          }
                        : {
                              minX: cx - plateWidth / 2,
                              maxX: cx - plateWidth / 2 + SLAB.SNOW.WIDTH,
                              minZ: cz - plateDepth / 2,
                              maxZ: cz + plateDepth / 2,
                              minY: top,
                              maxY: top + SLAB.SNOW.HEIGHT
                          },
                    SLAB.TILE.SNOW
                );
            }
        }
    }

    const field = new THREE.Group();
    field.name = `slab-yard-${object.id}`;
    field.position.set(x, 0, z);
    field.add(subBase.buildMesh(makePS1Material({ color: COLORS.FRAME_DARK }), 'slab-sub-base'));
    if (!light.isEmpty()) field.add(light.buildMesh(makePS1Material({ color: COLORS.CONCRETE }), 'slab-light'));
    if (!dark.isEmpty()) field.add(dark.buildMesh(makePS1Material({ color: COLORS.CURB }), 'slab-dark'));
    if (!snow.isEmpty()) field.add(snow.buildMesh(snowCapMat, 'slab-snow'));
    group.add(field);
}

export function buildSlabYards(group: THREE.Group, layout: Layout): void {
    objectsOfType(layout, 'pag-slab').forEach((object) => buildSlabYard(group, object));
}
