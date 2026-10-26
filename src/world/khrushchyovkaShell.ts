// Shared skin of the Khrushchyovka: one merged-quad builder per material plus the
// body shape every part is measured from. A five-section block carries ~1500
// parts; merging them into a dozen meshes keeps the draw-call budget flat while
// the geometry still comes from the same profile the layout validated (TZ §9).
import { COLORS } from '../config/colors.js';
import { createQuadBuilder, type QuadBuilder } from '../core/geometryBuilder.js';
import { innerVoidMat, snowSoilMat, topHighlightMat } from '../core/materials.js';
import { makePS1Material } from '../core/ps1Material.js';
import { KHRUSHCHYOVKA } from './layout/footprints.js';
import { KHRUSHCHYOVKA_TEXTURES } from './khrushchyovkaTextures.js';
import type * as THREE from 'three';

// Yellow-ochre distribution line of the block. Declared here rather than in the
// builder because the weathering layer needs its height: rust runs down the wall
// from the pipe, not from a number the facade guessed.
export const GAS_PIPE = {
    RADIUS: 0.07,
    SEGMENTS: 5,
    // Above the first-floor window heads: the line clears the porch canopies and
    // the doors instead of crossing them (TZ §9 keeps the approach walkable).
    HEIGHT_ABOVE_PLINTH: 2.65,
    PROUD: 0.16,
    END_INSET: 0.5,
    DROP_BOTTOM: 0.45
};

// The facade box is slightly shallower than the end-wall box so the two textures
// never fight: the end slabs poke out by SIDE_EXTRA, the panel field covers the
// rest. Both stay inside the 10.5 m layout collider, which keeps the plan
// conservative instead of chasing the skin.
const BODY_INSET = {
    PANEL: 0.12,
    SIDE: 0.24,
    SIDE_EXTRA: 0.04
};

// Metres per texture tile per axis. Panel bays follow one section (6 m) and one
// storey (3.9 m), so the painted joint lands on the real structural seam.
export const TILE = {
    PANEL: { U: KHRUSHCHYOVKA.SECTION_WIDTH, V: KHRUSHCHYOVKA.FLOOR_HEIGHT },
    SIDE: { U: KHRUSHCHYOVKA.SECTION_WIDTH, V: KHRUSHCHYOVKA.FLOOR_HEIGHT },
    CONCRETE: { U: 2.4, V: 1.6 },
    SLATE: { U: 1.2, V: 1.2 },
    RUST: { U: 1.0, V: 1.0 },
    ROOF: { U: 2.6, V: 2.6 },
    // Snow caps are centimetres deep: a fine tile keeps the drift readable instead
    // of stretching one texel along the whole ledge.
    SNOW: { U: 0.8, V: 0.8 }
};

const MATERIALS = {
    panel: makePS1Material({ map: KHRUSHCHYOVKA_TEXTURES.panelWall, color: COLORS.FACADE }),
    side: makePS1Material({ map: KHRUSHCHYOVKA_TEXTURES.sidePanel, color: COLORS.BUILDING_SIDE }),
    plinth: makePS1Material({ map: KHRUSHCHYOVKA_TEXTURES.plinthConcrete, color: COLORS.BUILDING_PLINTH }),
    trim: makePS1Material({ map: KHRUSHCHYOVKA_TEXTURES.plinthConcrete, color: COLORS.CONCRETE_TRIM }, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    // Parapet ring: the one bright surface of the block, so the roof silhouette
    // still frames the courtyard from the isometric camera.
    parapet: topHighlightMat,
    roofTar: makePS1Material({ map: KHRUSHCHYOVKA_TEXTURES.roofTar, color: COLORS.BUILDING_PLINTH }),
    slate: makePS1Material({ map: KHRUSHCHYOVKA_TEXTURES.balconySlate, color: COLORS.BALCONY_SLATE }),
    wood: makePS1Material({ map: KHRUSHCHYOVKA_TEXTURES.balconySlate, color: COLORS.BALCONY_WOOD }),
    rust: makePS1Material({ map: KHRUSHCHYOVKA_TEXTURES.rustMetal, color: COLORS.BUILDING_RUST }),
    iron: makePS1Material({ color: COLORS.FRAME_DARK }),
    lamp: makePS1Material({ color: COLORS.BUILDING_LAMP, emissive: COLORS.BUILDING_LAMP_EMISSIVE }),
    // Every sash state is unlit: the courtyard has had no power for eleven years.
    // They differ by what is left of the glass, not by whether it glows.
    winDark: makePS1Material({ map: KHRUSHCHYOVKA_TEXTURES.windowDark }, { depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    winCracked: makePS1Material({ map: KHRUSHCHYOVKA_TEXTURES.windowCracked }, { depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    winEmpty: makePS1Material({ map: KHRUSHCHYOVKA_TEXTURES.windowEmpty }, { depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    winBoarded: makePS1Material({ map: KHRUSHCHYOVKA_TEXTURES.windowBoarded }, { depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    // Washed soot over the one flat that burned, tinted with the facade colour so
    // its top edge lands on the panel tone and the stain has no rectangle.
    soot: makePS1Material({ map: KHRUSHCHYOVKA_TEXTURES.sootPlume, color: COLORS.FACADE }, { depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    // Eleven years of water off the sills and the gas line: the same stain
    // texture, tinted as concrete dirt or as rust.
    grime: makePS1Material({ map: KHRUSHCHYOVKA_TEXTURES.wallStain, color: COLORS.FACADE }, { depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    rustBleed: makePS1Material({ map: KHRUSHCHYOVKA_TEXTURES.wallStain, color: COLORS.BUILDING_RUST }, { depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    // A panel corner the frost broke out: exposed aggregate and rebar.
    spall: makePS1Material({ map: KHRUSHCHYOVKA_TEXTURES.panelSpall, color: COLORS.FACADE }, { depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    graffiti: makePS1Material({ map: KHRUSHCHYOVKA_TEXTURES.graffitiTag, color: COLORS.FACADE }, { depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    // Snow on a ten-centimetre ledge is packed and dirty, not the fresh field of
    // the courtyard: the soil tone keeps the mech the brightest silhouette in a
    // night frame and stops the sills turning into a grid of white dashes.
    snow: snowSoilMat,
    void: innerVoidMat
} satisfies Record<string, THREE.Material>;

export type ShellKey = keyof typeof MATERIALS;
export type WindowKey = 'winDark' | 'winCracked' | 'winEmpty' | 'winBoarded';
export type Shell = Record<ShellKey, QuadBuilder>;

interface Box {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
}

// A facade face the parts are attached to: 'z' faces front/back, 'x' the gable
// ends. `u` coordinates of a part are X on a 'z' face and Z on an 'x' face;
// `plane` is the wall surface the part grows out of.
export interface FacadePanel {
    axis: 'x' | 'z';
    side: 1 | -1;
    plane: number;
}

export interface BodyShape {
    width: number;
    depth: number;
    plinthHeight: number;
    wallHeight: number;
    roofY: number;
    frontPlane: number;
    sidePlane: number;
}

export function createBodyShape(sections: number): BodyShape {
    const plinthHeight = KHRUSHCHYOVKA.PLINTH_HEIGHT;
    const wallHeight = KHRUSHCHYOVKA.FLOORS * KHRUSHCHYOVKA.FLOOR_HEIGHT;
    return {
        width: sections * KHRUSHCHYOVKA.SECTION_WIDTH,
        depth: KHRUSHCHYOVKA.DEPTH,
        plinthHeight,
        wallHeight,
        roofY: plinthHeight + wallHeight,
        frontPlane: (KHRUSHCHYOVKA.DEPTH - BODY_INSET.PANEL) / 2,
        sidePlane: (sections * KHRUSHCHYOVKA.SECTION_WIDTH + BODY_INSET.SIDE_EXTRA) / 2
    };
}

export function panelDepth(): number {
    return KHRUSHCHYOVKA.DEPTH - BODY_INSET.PANEL;
}

export function sideDepth(): number {
    return KHRUSHCHYOVKA.DEPTH - BODY_INSET.SIDE;
}

// Local X of a section centre. The layout and the facade share this one formula.
export function sectionOffset(section: number, sections: number): number {
    return (section - (sections - 1) / 2) * KHRUSHCHYOVKA.SECTION_WIDTH;
}

export function floorBaseY(floor: number): number {
    return KHRUSHCHYOVKA.PLINTH_HEIGHT + floor * KHRUSHCHYOVKA.FLOOR_HEIGHT;
}

export function createShell(): Shell {
    const keys = Object.keys(MATERIALS) as ShellKey[];
    return Object.fromEntries(keys.map((key) => [key, createQuadBuilder()])) as Shell;
}

export function flushShell(shell: Shell, group: THREE.Group): void {
    (Object.keys(MATERIALS) as ShellKey[]).forEach((key) => {
        const builder = shell[key];
        if (builder.isEmpty()) return;
        group.add(builder.buildMesh(MATERIALS[key], `khrushchyovka-${key}`));
    });
}

// Axis-aligned box with face-local UVs: every face starts its own texture frame
// and repeats once per tile. The world-space addBox of the surface layers would
// stretch a single texel column across the whole 30 m facade.
// `skipFront` omits the +Z face: the panel wall of a block with an opened porch
// builds that face separately, cut around the doorway (addFrontFace).
export function addBox(quads: QuadBuilder, box: Box, tileU: number, tileV: number, skipFront = false): void {
    const spanX = box.maxX - box.minX;
    const spanY = box.maxY - box.minY;
    const spanZ = box.maxZ - box.minZ;
    const faceUvs = (width: number, height: number) => [
        [0, 0],
        [width / tileU, 0],
        [width / tileU, height / tileV],
        [0, height / tileV]
    ];

    quads.addQuad(
        [
            [box.minX, box.maxY, box.minZ],
            [box.maxX, box.maxY, box.minZ],
            [box.maxX, box.maxY, box.maxZ],
            [box.minX, box.maxY, box.maxZ]
        ],
        [0, 1, 0],
        faceUvs(spanX, spanZ)
    );
    quads.addQuad(
        [
            [box.minX, box.minY, box.maxZ],
            [box.maxX, box.minY, box.maxZ],
            [box.maxX, box.minY, box.minZ],
            [box.minX, box.minY, box.minZ]
        ],
        [0, -1, 0],
        faceUvs(spanX, spanZ)
    );
    if (!skipFront) addFrontFace(quads, box, tileU, tileV);
    quads.addQuad(
        [
            [box.maxX, box.minY, box.minZ],
            [box.minX, box.minY, box.minZ],
            [box.minX, box.maxY, box.minZ],
            [box.maxX, box.maxY, box.minZ]
        ],
        [0, 0, -1],
        faceUvs(spanX, spanY)
    );
    quads.addQuad(
        [
            [box.maxX, box.minY, box.maxZ],
            [box.maxX, box.minY, box.minZ],
            [box.maxX, box.maxY, box.minZ],
            [box.maxX, box.maxY, box.maxZ]
        ],
        [1, 0, 0],
        faceUvs(spanZ, spanY)
    );
    quads.addQuad(
        [
            [box.minX, box.minY, box.minZ],
            [box.minX, box.minY, box.maxZ],
            [box.minX, box.maxY, box.maxZ],
            [box.minX, box.maxY, box.minZ]
        ],
        [-1, 0, 0],
        faceUvs(spanZ, spanY)
    );
}

export interface WallHole {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

// The +Z face of a box, cut around rectangular holes that do not overlap in X.
// That is the doorway of an opened porch: the eye has to see into the stairwell,
// so the panel is a real opening, not the black decal of a sealed block.
export function addFrontFace(quads: QuadBuilder, box: Box, tileU: number, tileV: number, holes: WallHole[] = []): void {
    const z = box.maxZ;

    const rect = (x0: number, x1: number, y0: number, y1: number): void => {
        if (x1 - x0 <= 1e-6 || y1 - y0 <= 1e-6) return;
        quads.addQuad(
            [
                [x0, y0, z],
                [x1, y0, z],
                [x1, y1, z],
                [x0, y1, z]
            ],
            [0, 0, 1],
            [
                [(x0 - box.minX) / tileU, (y0 - box.minY) / tileV],
                [(x1 - box.minX) / tileU, (y0 - box.minY) / tileV],
                [(x1 - box.minX) / tileU, (y1 - box.minY) / tileV],
                [(x0 - box.minX) / tileU, (y1 - box.minY) / tileV]
            ]
        );
    };

    const sorted = holes
        .map((hole) => ({
            minX: Math.max(box.minX, hole.minX),
            maxX: Math.min(box.maxX, hole.maxX),
            minY: Math.max(box.minY, hole.minY),
            maxY: Math.min(box.maxY, hole.maxY)
        }))
        .filter((hole) => hole.maxX - hole.minX > 1e-6 && hole.maxY - hole.minY > 1e-6)
        .sort((left, right) => left.minX - right.minX);

    let cursor = box.minX;
    sorted.forEach((hole) => {
        rect(cursor, hole.minX, box.minY, box.maxY);
        rect(hole.minX, hole.maxX, box.minY, hole.minY);
        rect(hole.minX, hole.maxX, hole.maxY, box.maxY);
        cursor = Math.max(cursor, hole.maxX);
    });
    rect(cursor, box.maxX, box.minY, box.maxY);
}

// Box attached to a facade face. `from`/`to` are signed distances outward from
// the wall plane, so a recessed frame is (-0.10, 0.03) and a balcony slab is
// (0, 1.45).
export function panelBox(
    panel: FacadePanel,
    u0: number,
    u1: number,
    y0: number,
    y1: number,
    from: number,
    to: number
): Box {
    const near = panel.plane + panel.side * Math.min(from, to);
    const far = panel.plane + panel.side * Math.max(from, to);
    if (panel.axis === 'z') {
        return { minX: Math.min(u0, u1), maxX: Math.max(u0, u1), minY: y0, maxY: y1, minZ: near, maxZ: far };
    }
    return { minX: near, maxX: far, minY: y0, maxY: y1, minZ: Math.min(u0, u1), maxZ: Math.max(u0, u1) };
}

// Textured plane laid on the wall (a window sash or its pane): UVs stay 0..1 so
// one texture covers exactly one sash regardless of the facade size.
export function addPanelDecal(
    quads: QuadBuilder,
    panel: FacadePanel,
    u: number,
    y: number,
    width: number,
    height: number,
    lift: number
): void {
    const u0 = u - width / 2;
    const u1 = u + width / 2;
    const y0 = y - height / 2;
    const y1 = y + height / 2;
    const at = panel.plane + panel.side * lift;
    const uvs = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1]
    ];

    if (panel.axis === 'z') {
        quads.addQuad(
            [
                [u0, y0, at],
                [u1, y0, at],
                [u1, y1, at],
                [u0, y1, at]
            ],
            [0, 0, panel.side],
            uvs
        );
        return;
    }
    quads.addQuad(
        [
            [at, y0, u0],
            [at, y0, u1],
            [at, y1, u1],
            [at, y1, u0]
        ],
        [panel.side, 0, 0],
        uvs
    );
}
