// Road furniture: the cast-iron manhole covers in the carriageway and the
// storm-water grates along the kerbs. Both are flat decor with no collider — a
// plate the walker steps over — so they are measured by the decor policy of the
// plan instead of the solid-footprint rules.
//
// Every lid of a kind is merged into one mesh: five covers and three grates cost
// four draw calls together, not sixteen.
import { COLORS } from '../config/colors.js';
import { SURFACE } from '../config/world.js';
import { createQuadBuilder } from '../core/geometryBuilder.js';
import { mergeGeometries, type MergePart } from '../core/geometryMerge.js';
import { makePS1Material } from '../core/ps1Material.js';
import { MANHOLE_PROFILE, GRATE_PROFILE, type ObjectDescriptor } from './layout/footprints.js';
import { objectsOfType } from './placement.js';
import { addBox, placeAt } from './quadTransform.js';
import type { Layout } from './layout/createLayout.js';
import * as THREE from 'three';

const MANHOLE = {
    HALO: { LIFT: 0.004, HEIGHT: 0.012, SEGMENTS: 10 },
    // The rim the lid sits in: slightly wider and taller than the cover, so the
    // lid still reads as a lid rather than as a dark circle of paint.
    RIM: { LIFT: 0.006, HEIGHT: 0.018, SEGMENTS: 10, RADIUS: 0.43 },
    COVER: { LIFT: 0.008, SEGMENTS: 10 }
};

const GRATE = {
    // The frame sits a few millimetres below the surface plate and the bars cross
    // it: at the iso distance that reads as a hole with iron in it.
    FRAME_LIFT: 0.002,
    BAR_HEIGHT: 0.012,
    BAR_INSET: 0.03,
    WET_LIFT: 0.0016
};

// One ring part per lid: the halo (thawed ground around it), the rim and the
// cover. Every lid of a class is merged, so six covers cost three draw calls.
function manholeParts(layout: Layout): { halo: MergePart[]; rim: MergePart[]; cover: MergePart[] } {
    const profile = MANHOLE_PROFILE;
    const base = SURFACE.ASPHALT;
    const haloTop = base + MANHOLE.HALO.LIFT + MANHOLE.HALO.HEIGHT;
    const parts = { halo: [] as MergePart[], rim: [] as MergePart[], cover: [] as MergePart[] };

    objectsOfType(layout, 'manhole').forEach((object) => {
        const { x, z } = object.transform;
        const place = (y: number, ringRadius: number, height: number, segments: number, yaw: number): MergePart => ({
            geometry: new THREE.CylinderGeometry(ringRadius, ringRadius, height, segments),
            matrix: new THREE.Matrix4().compose(
                new THREE.Vector3(x, y, z),
                new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
                new THREE.Vector3(1, 1, 1)
            )
        });

        parts.halo.push(place(base + MANHOLE.HALO.LIFT + MANHOLE.HALO.HEIGHT / 2, profile.RING_RADIUS, MANHOLE.HALO.HEIGHT, MANHOLE.HALO.SEGMENTS, 0));
        parts.rim.push(place(base + MANHOLE.RIM.LIFT + MANHOLE.RIM.HEIGHT / 2, MANHOLE.RIM.RADIUS, MANHOLE.RIM.HEIGHT, MANHOLE.RIM.SEGMENTS, 0));
        parts.cover.push(
            place(
                haloTop + MANHOLE.COVER.LIFT + profile.COVER_HEIGHT / 2,
                profile.COVER_RADIUS,
                profile.COVER_HEIGHT,
                MANHOLE.COVER.SEGMENTS,
                object.transform.rotY
            )
        );
    });

    return parts;
}

function buildManholes(layout: Layout): THREE.Group {
    const group = new THREE.Group();
    group.name = 'manholes';
    const parts = manholeParts(layout);

    const layers: Array<[string, THREE.Material, MergePart[]]> = [
        ['manhole-halos', makePS1Material({ color: COLORS.CURB }, { vertexSnap: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), parts.halo],
        ['manhole-rims', makePS1Material({ color: COLORS.CONCRETE }, { vertexSnap: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), parts.rim],
        ['manhole-covers', makePS1Material({ color: COLORS.MANHOLE }, { vertexSnap: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), parts.cover]
    ];

    layers.forEach(([name, material, layerParts]) => {
        if (layerParts.length === 0) return;
        const mesh = new THREE.Mesh(mergeGeometries(layerParts), material);
        mesh.name = name;
        group.add(mesh);
    });

    return group;
}

// Storm-water grate: a recessed frame, six bars across it and a wet ring where
// the meltwater runs in. Everything merged into two meshes for all grates.
function buildGrates(layout: Layout): THREE.Group | null {
    const grates = objectsOfType(layout, 'grate');
    if (grates.length === 0) return null;

    const iron = createQuadBuilder();
    const wet = createQuadBuilder();
    const profile = GRATE_PROFILE;
    const halfWidth = profile.WIDTH / 2;
    const halfDepth = profile.DEPTH / 2;

    grates.forEach((object: ObjectDescriptor) => {
        const place = placeAt(object.transform.x, object.transform.z, object.transform.rotY);
        const base = SURFACE.ASPHALT;

        // Wet apron around the mouth of the grate: a thin dark plate flush with the
        // asphalt, so the iron does not float on the surface.
        addBox(
            wet,
            place,
            {
                minX: -halfWidth - 0.12,
                maxX: halfWidth + 0.12,
                minY: base,
                maxY: base + GRATE.WET_LIFT,
                minZ: -halfDepth - 0.1,
                maxZ: halfDepth + 0.1
            },
            2.0
        );

        // Frame: four rails a little proud of the wet plate.
        const frameTop = base + GRATE.FRAME_LIFT + GRATE.BAR_HEIGHT;
        const rail = 0.05;
        addBox(iron, place, { minX: -halfWidth, maxX: halfWidth, minY: base, maxY: frameTop, minZ: -halfDepth, maxZ: -halfDepth + rail }, 1.6);
        addBox(iron, place, { minX: -halfWidth, maxX: halfWidth, minY: base, maxY: frameTop, minZ: halfDepth - rail, maxZ: halfDepth }, 1.6);
        addBox(iron, place, { minX: -halfWidth, maxX: -halfWidth + rail, minY: base, maxY: frameTop, minZ: -halfDepth + rail, maxZ: halfDepth - rail }, 1.6);
        addBox(iron, place, { minX: halfWidth - rail, maxX: halfWidth, minY: base, maxY: frameTop, minZ: -halfDepth + rail, maxZ: halfDepth - rail }, 1.6);

        // Cross bars: they run along the road, so water passes between them.
        const innerDepth = profile.DEPTH - GRATE.BAR_INSET * 2;
        const barWidth = 0.035;
        for (let index = 0; index < profile.BARS; index++) {
            const offset = -innerDepth / 2 + (innerDepth * (index + 0.5)) / profile.BARS;
            addBox(
                iron,
                place,
                {
                    minX: -halfWidth + rail,
                    maxX: halfWidth - rail,
                    minY: base,
                    maxY: frameTop - GRATE.BAR_HEIGHT * 0.25,
                    minZ: offset - barWidth / 2,
                    maxZ: offset + barWidth / 2
                },
                1.6
            );
        }
    });

    const group = new THREE.Group();
    group.name = 'grates';
    if (!wet.isEmpty()) group.add(wet.buildMesh(makePS1Material({ color: COLORS.TAR_PATCH }, { vertexSnap: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), 'grate-wet'));
    if (!iron.isEmpty()) group.add(iron.buildMesh(makePS1Material({ color: COLORS.GRATE_IRON }, { vertexSnap: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), 'grate-iron'));
    return group;
}

export function buildRoadFurniture(group: THREE.Group, layout: Layout): void {
    group.add(buildManholes(layout));
    const grates = buildGrates(layout);
    if (grates) group.add(grates);
}
