// Courtyard and rear facades of the Khrushchyovka, ported from the standalone
// home.html diorama: a panel field with mastic seams, sash windows in four dead
// states, three self-built balcony types, three podъezd entrances with concrete
// canopies, basement vents and the yellow gas line. Every X coordinate is either
// a section centre from the layout or a porch bay the layout already owns, and
// every state of the skin comes from the block's own decay profile, so no two
// blocks of the district are the same building twice.
import {
    TILE,
    addBox,
    addFrontFace,
    addPanelDecal,
    floorBaseY,
    panelBox,
    panelDepth,
    sectionOffset,
    sideDepth
} from './khrushchyovkaShell.js';
import type { BodyShape, FacadePanel, Shell, WallHole, WindowKey } from './khrushchyovkaShell.js';
import { FACADE_FACE, isBurntAnchor, isDecayEnabled, sashState, stairState, weatheringRoll, type DecayProfile } from './khrushchyovkaDecay.js';
import { WEATHERING, addBalconyStain, addBlockWeathering, addSillStain } from './khrushchyovkaWeathering.js';
import { hasPorchBulb } from './layout/lighting.js';
import { KHRUSHCHYOVKA } from './layout/footprints.js';

const WINDOW = {
    WIDTH: 1.5,
    HEIGHT: 1.5,
    CENTER_FROM_FLOOR: 1.55,
    COLUMN_OFFSET: 1.45,
    BAY_CLEARANCE: 1.2,
    END_COLUMN_Z: 2.4,
    STAIR: { WIDTH: 1.25, HEIGHT: 1.8 },
    FRAME: { EXTRA: 0.16, INWARD: 0.1, PROUD: 0.03 },
    SILL: { EXTRA: 0.2, HEIGHT: 0.1, PROUD: 0.16, INSET: 0.02 },
    PANE_LIFT: 0.045,
    BAR: { THICKNESS: 0.04, PROUD: 0.1, COUNT: 5, HEIGHT_INSET: 0.08, RAIL_FRACTION: 0.35, RAIL_DEPTH: 0.03 }
};

const BALCONY = {
    WIDTH: 3.0,
    DEPTH: 1.5,
    SLAB_HEIGHT: 0.22,
    // Slab top sits at the window sill: the railing hides the lower third of the
    // sash exactly as it does on the reference block.
    SLAB_DROP: 1.4,
    RAIL_HEIGHT: 1.2,
    RAIL_THICKNESS: 0.08,
    BAR_SIZE: 0.04,
    BAR_SPACING: 0.3,
    SLATE_CAP: 0.06,
    GLASS_INSET: 0.04,
    LAUNDRY: { WIDTH: 1.15, HEIGHT: 0.8, THICKNESS: 0.05, INSET: 0.55, TOP_GAP: 0.12 },
    WOOD_HEIGHT: 0.95,
    GLASS_HEIGHT: 1.05,
    VISOR: { HEIGHT: 0.12, OVERHANG: 0.18, INSET: 0.04 }
};

const ENTRANCE = {
    STEP: { LOWER_HEIGHT: 0.05, UPPER_HEIGHT: 0.10, SPLIT: 0.65, START_GAP: 0.01, END_GAP: 0.02 },
    DOOR: { WIDTH: 1.65, HEIGHT: 2.25, RECESS_EXTRA: 0.26, RECESS_INWARD: 0.12, RECESS_PROUD: 0.02, HEAD_GAP: 0.1, LEAF_PROUD: 0.1 },
    BLIND: { WIDTH: 0.34, HEIGHT: 2.1, PROUD: 0.02 },
    CANOPY: {
        HEIGHT: 0.2,
        TOP: 0.06,
        DROP: 0.02,
        SUPPORT: 0.08,
        HEAD_GAP: 0.1,
        EDGE: 0.02,
        WALL_GAP: 0.02,
        SUPPORT_INSET: 0.15,
        // Rebar left standing out of a spalled canopy edge
        REBAR: { THICKNESS: 0.035, PROUD: 0.16, INSET: 0.12, OFFSETS: [-0.72, 0.4] }
    },
    LAMP: { WIDTH: 0.24, HEIGHT: 0.12, PROUD: 0.42, WALL_GAP: 0.3, BOTTOM_GAP: 0.02 },
    BENCH: { OFFSET: 2.0, WIDTH: 1.4, SEAT_HEIGHT: 0.46, SEAT_DEPTH: 0.5, SEAT_THICKNESS: 0.08, LEG: 0.08, LEG_INSET: 0.15, LEG_START: 0.06, LEG_END: 0.12 },
    URN: {
        OFFSET: 1.9,
        WIDTH: 0.36,
        HEIGHT: 0.62,
        DEPTH: 0.36,
        WALL_GAP: 0.04,
        LID: 0.06,
        // The same bin on its side, rolled away from the door
        TIPPED: { LENGTH: 0.58, HEIGHT: 0.34, OFFSET: 0.46 }
    },
    // The steel leaf, torn off and dumped across the bottom steps
    LEAF: { WIDTH: 1.62, DEPTH: 1.05, THICKNESS: 0.05, OFFSET_X: 0.18, Z_FROM: 0.72 },
    // Planks nailed over a doorway nobody was going to open again
    BOARD: { COUNT: 4, HEIGHT: 0.30, GAP: 0.20, START: 0.18, PROUD: 0.1, WIDTH_EXTRA: 0.12, EDGE_CLEAR: 0.05 },
    STAIR_FLOOR_START: 1
};

// Concrete plinth and its drip ledge above the wall field.
const BASE = {
    PLINTH_EXTRA: 0.16,
    LEDGE: { EXTRA: 0.15, INSET: 0.02, HEIGHT: 0.06, PROUD: 0.02 }
};

// Snow that settled where the wind cannot sweep it. Eleven winters, so the sills
// and every blown opening carry a cap; the balcony rails do not — a four-centimetre
// handrail sheds its snow, and a full row of white bars reads as a printed pattern.
const SNOW = {
    SILL: { HEIGHT: 0.035, INSET: 0.04, PROUD: 0.012 },
    // Drift left in a blown opening: it banks up against the frame and spills a
    // little over the sill.
    OPENING: { HEIGHT: 0.07, INSET: 0.14, PROUD: 0.02, EMBED: 0.5 }
};

const VENT = {
    WIDTH: 0.6,
    HEIGHT: 0.18,
    Y: 0.18,
    PROUD: 0.12,
    ANCHOR: 0.02,
    STEP: 3.2,
    EDGE_INSET: 2.0,
    PORCH_CLEARANCE: 2.8
};

const RIB = {
    THICKNESS: 0.12,
    WIDTH_EXTRA: 0.2,
    DEPTH_EXTRA: 0.04,
    VERTICAL_WIDTH: 0.14,
    VERTICAL_PROUD: 0.05,
    ANCHOR: 0.02
};

type BalconyStyle = 'open' | 'slate' | 'glazed';
type Side = 'front' | 'back';

// Soot of the burned flat: a washed stain running up the wall from the window
// head. Tall enough to cross the storey band (the slab edge then cuts it, as it
// would in brick) and short enough never to reach the window of the flat above.
const PLUME = {
    WIDTH: 1.55,
    HEIGHT: 0.9,
    LIFT: 0.012
};

// Hand-placed front balconies, one entry per window column (left to right) and
// floor 2..5. null keeps the panel bare; the patchwork is content, not a random
// pattern, so neighbouring columns never repeat the same improvisation. Each
// block reads the plan from a different row and, on the southern pair, upside
// down — four blocks, one authored patchwork, four different walls.
const FRONT_BALCONY_PLAN: (BalconyStyle | null)[][] = [
    [null, 'slate', null, 'glazed'],
    ['open', 'glazed', 'slate', null],
    ['slate', null, 'open', 'glazed'],
    [null, 'open', 'glazed', 'slate'],
    ['glazed', 'slate', null, 'open'],
    [null, 'slate', 'open', null],
    ['open', null, 'glazed', 'slate']
];

const BACK_STYLES: BalconyStyle[] = ['open', 'slate', 'glazed'];

function frontWindowColumns(sections: number, porchXs: number[]): number[] {
    const columns: number[] = [];
    for (let section = 0; section < sections; section++) {
        const centre = sectionOffset(section, sections);
        const left = centre - WINDOW.COLUMN_OFFSET;
        // The porch occupies the left bay of a section: no sash there, the door
        // and the stair column take its place.
        const porchNearby = porchXs.some((porchX) => Math.abs(porchX - left) < WINDOW.BAY_CLEARANCE);
        if (!porchNearby) columns.push(left);
        columns.push(centre + WINDOW.COLUMN_OFFSET);
    }
    return columns;
}

function backWindowColumns(sections: number): number[] {
    const columns: number[] = [];
    for (let section = 0; section < sections; section++) {
        const centre = sectionOffset(section, sections);
        columns.push(centre - WINDOW.COLUMN_OFFSET, centre + WINDOW.COLUMN_OFFSET);
    }
    return columns;
}

function balconyStyle(side: Side, column: number, floor: number, decay: DecayProfile): BalconyStyle | null {
    const shift = decay.balconyShift;
    if (side === 'front') {
        const row = FRONT_BALCONY_PLAN[(column + shift) % FRONT_BALCONY_PLAN.length];
        const plan = decay.balconyMirror ? [...row].reverse() : row;
        return plan[floor - 1] || null;
    }
    // Rear face: every second bay, style cycles so the yard reads as a lived-in
    // patchwork instead of a repeated module.
    const key = column + floor + shift;
    return key % 2 === 0 ? BACK_STYLES[key % BACK_STYLES.length] : null;
}

interface SashSettings {
    width: number;
    height: number;
    barred?: boolean;
    // Snow settled on this particular sill. Not every sill holds it: the wind
    // sweeps a facade unevenly, and a row of identical caps reads as a pattern.
    snowy?: boolean;
}

function addWindow(
    shell: Shell,
    panel: FacadePanel,
    u: number,
    y: number,
    mode: WindowKey,
    { width, height, barred = false, snowy = false }: SashSettings
): number {
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const frameHalfWidth = halfWidth + WINDOW.FRAME.EXTRA / 2;
    const frameHalfHeight = halfHeight + WINDOW.FRAME.EXTRA / 2;

    // Recessed dark reveal behind the sash
    addBox(
        shell.plinth,
        panelBox(
            panel,
            u - frameHalfWidth,
            u + frameHalfWidth,
            y - frameHalfHeight,
            y + frameHalfHeight,
            -WINDOW.FRAME.INWARD,
            WINDOW.FRAME.PROUD
        ),
        TILE.CONCRETE.U,
        TILE.CONCRETE.V
    );

    addPanelDecal(shell[mode], panel, u, y, width, height, WINDOW.PANE_LIFT);

    // Concrete drip sill
    const sillTop = y - frameHalfHeight - WINDOW.SILL.INSET;
    const sillBottom = y - frameHalfHeight - WINDOW.SILL.HEIGHT;
    const sillHalfWidth = frameHalfWidth + WINDOW.SILL.EXTRA / 2;
    addBox(
        shell.trim,
        panelBox(panel, u - sillHalfWidth, u + sillHalfWidth, sillBottom, sillTop, -WINDOW.SILL.INSET, WINDOW.SILL.PROUD),
        TILE.CONCRETE.U,
        TILE.CONCRETE.V
    );

    if (snowy) {
        addBox(
            shell.snow,
            panelBox(
                panel,
                u - sillHalfWidth + SNOW.SILL.INSET,
                u + sillHalfWidth - SNOW.SILL.INSET,
                sillTop,
                sillTop + SNOW.SILL.HEIGHT,
                -WINDOW.SILL.INSET,
                WINDOW.SILL.PROUD + SNOW.SILL.PROUD
            ),
            TILE.SNOW.U,
            TILE.SNOW.V
        );
    }

    // A blown sash keeps the snow that drifted into the opening.
    if (mode === 'winEmpty' || mode === 'winBoarded') {
        addBox(
            shell.snow,
            panelBox(
                panel,
                u - halfWidth + SNOW.OPENING.INSET,
                u + halfWidth - SNOW.OPENING.INSET,
                y - halfHeight,
                y - halfHeight + SNOW.OPENING.HEIGHT,
                -WINDOW.FRAME.INWARD * SNOW.OPENING.EMBED,
                WINDOW.PANE_LIFT + SNOW.OPENING.PROUD
            ),
            TILE.SNOW.U,
            TILE.SNOW.V
        );
    }

    if (!barred) return sillBottom;

    // Ground-floor security grille: five uprights and two rails
    const barTop = y + halfHeight - WINDOW.BAR.HEIGHT_INSET;
    const barBottom = y - halfHeight + WINDOW.BAR.HEIGHT_INSET;
    const spacing = (width - WINDOW.BAR.THICKNESS * 2) / (WINDOW.BAR.COUNT - 1);
    for (let index = 0; index < WINDOW.BAR.COUNT; index++) {
        const barX = u - width / 2 + WINDOW.BAR.THICKNESS + index * spacing;
        addBox(
            shell.iron,
            panelBox(
                panel,
                barX - WINDOW.BAR.THICKNESS / 2,
                barX + WINDOW.BAR.THICKNESS / 2,
                barBottom,
                barTop,
                WINDOW.BAR.PROUD - WINDOW.BAR.THICKNESS,
                WINDOW.BAR.PROUD
            ),
            TILE.RUST.U,
            TILE.RUST.V
        );
    }
    [barBottom + (barTop - barBottom) * WINDOW.BAR.RAIL_FRACTION, barTop - (barTop - barBottom) * WINDOW.BAR.RAIL_FRACTION].forEach((railY) => {
        addBox(
            shell.iron,
            panelBox(
                panel,
                u - halfWidth,
                u + halfWidth,
                railY - WINDOW.BAR.THICKNESS / 2,
                railY + WINDOW.BAR.THICKNESS / 2,
                WINDOW.BAR.PROUD,
                WINDOW.BAR.PROUD + WINDOW.BAR.RAIL_DEPTH
            ),
            TILE.RUST.U,
            TILE.RUST.V
        );
    });

    return sillBottom;
}

function addBalcony(shell: Shell, panel: FacadePanel, u: number, windowY: number, style: BalconyStyle): void {
    const half = BALCONY.WIDTH / 2;
    const slabTop = windowY - BALCONY.SLAB_DROP + BALCONY.SLAB_HEIGHT / 2;
    const railTop = slabTop + BALCONY.RAIL_HEIGHT;
    const outer = BALCONY.DEPTH;
    const railInset = BALCONY.RAIL_THICKNESS;

    // Cantilevered slab: the only part of a balcony that fills the visual margin
    // of the frozen layout; it stays inside it.
    addBox(
        shell.trim,
        panelBox(panel, u - half, u + half, slabTop - BALCONY.SLAB_HEIGHT, slabTop, 0, outer),
        TILE.CONCRETE.U,
        TILE.CONCRETE.V
    );

    // The concrete wets on both faces of the slab and runs down the wall behind it.
    addBalconyStain(shell, panel, u, slabTop - BALCONY.SLAB_HEIGHT);

    const railing = style === 'open' ? shell.iron : style === 'slate' ? shell.slate : shell.wood;
    const panelFrom = outer - railInset * 2;
    const panelTo = outer - railInset;

    if (style === 'open') {
        // Handrail, side rails and slim balusters
        addBox(shell.iron, panelBox(panel, u - half, u + half, railTop - railInset, railTop, panelFrom, outer), TILE.RUST.U, TILE.RUST.V);
        [-1, 1].forEach((edge) => {
            addBox(
                shell.iron,
                panelBox(panel, u + edge * (half - railInset), u + edge * half, railTop - railInset, railTop, 0, outer),
                TILE.RUST.U,
                TILE.RUST.V
            );
        });

        const innerWidth = BALCONY.WIDTH - railInset * 4;
        const barCount = Math.max(2, Math.round(innerWidth / BALCONY.BAR_SPACING));
        for (let index = 0; index <= barCount; index++) {
            const barX = u - innerWidth / 2 + (innerWidth * index) / barCount;
            addBox(
                shell.iron,
                panelBox(
                    panel,
                    barX - BALCONY.BAR_SIZE / 2,
                    barX + BALCONY.BAR_SIZE / 2,
                    slabTop,
                    railTop - railInset,
                    panelFrom,
                    panelTo
                ),
                TILE.RUST.U,
                TILE.RUST.V
            );
        }

        // Grey sheet drying inside the railing
        addBox(
            shell.trim,
            panelBox(
                panel,
                u - BALCONY.LAUNDRY.WIDTH / 2,
                u + BALCONY.LAUNDRY.WIDTH / 2,
                railTop - BALCONY.LAUNDRY.HEIGHT,
                railTop - BALCONY.LAUNDRY.TOP_GAP,
                BALCONY.LAUNDRY.INSET,
                BALCONY.LAUNDRY.INSET + BALCONY.LAUNDRY.THICKNESS
            ),
            TILE.CONCRETE.U,
            TILE.CONCRETE.V
        );
        return;
    }

    // Solid parapets: corrugated slate for the economy version, a wooden lower
    // band under glazing for the self-built one.
    const solidHeight = style === 'slate' ? BALCONY.RAIL_HEIGHT : BALCONY.WOOD_HEIGHT;
    addBox(
        railing,
        panelBox(panel, u - half, u + half, slabTop, slabTop + solidHeight, panelFrom, panelTo),
        TILE.SLATE.U,
        TILE.SLATE.V
    );
    [-1, 1].forEach((edge) => {
        addBox(
            railing,
            panelBox(
                panel,
                u + edge * (half - railInset),
                u + edge * half,
                slabTop,
                slabTop + solidHeight,
                0,
                outer
            ),
            TILE.SLATE.U,
            TILE.SLATE.V
        );
    });

    if (style === 'slate') {
        // Dark top cap keeps the sheet edge readable against the panel wall
        addBox(shell.iron, panelBox(panel, u - half, u + half, railTop - BALCONY.SLATE_CAP, railTop, panelFrom, outer), TILE.RUST.U, TILE.RUST.V);
        return;
    }

    // Glazed upper band and the tin visor over it
    const glassTop = railTop + BALCONY.GLASS_HEIGHT;
    addBox(
        shell.winDark,
        panelBox(
            panel,
            u - half + BALCONY.GLASS_INSET,
            u + half - BALCONY.GLASS_INSET,
            slabTop + BALCONY.WOOD_HEIGHT,
            glassTop,
            panelFrom,
            panelTo
        ),
        TILE.SLATE.U,
        TILE.SLATE.V
    );
    [-1, 1].forEach((edge) => {
        addBox(
            shell.winDark,
            panelBox(
                panel,
                u + edge * (half - railInset - BALCONY.GLASS_INSET),
                u + edge * (half - BALCONY.GLASS_INSET),
                slabTop + BALCONY.WOOD_HEIGHT,
                glassTop,
                0,
                outer - railInset
            ),
            TILE.SLATE.U,
            TILE.SLATE.V
        );
    });
    addBox(
        shell.rust,
        panelBox(
            panel,
            u - half - BALCONY.VISOR.OVERHANG / 2,
            u + half + BALCONY.VISOR.OVERHANG / 2,
            glassTop,
            glassTop + BALCONY.VISOR.HEIGHT,
            -BALCONY.VISOR.INSET,
            outer + BALCONY.VISOR.OVERHANG
        ),
        TILE.RUST.U,
        TILE.RUST.V
    );
}

// Soot of a burned flat, laid on the wall above the window head. The decal's
// bottom edge is the darkest row of its texture, and its lift keeps it behind the
// storey bands, so the slab edge cuts the plume exactly as it would in brick.
function addSootPlume(
    shell: Shell,
    panel: FacadePanel,
    u: number,
    windowY: number,
    width: number,
    height: number
): void {
    const plumeWidth = width * PLUME.WIDTH;
    const plumeHeight = height * PLUME.HEIGHT;
    addPanelDecal(
        shell.soot,
        panel,
        u,
        windowY + height / 2 + WINDOW.FRAME.EXTRA / 2 + plumeHeight / 2,
        plumeWidth,
        plumeHeight,
        PLUME.LIFT
    );
}

// Two independent stories on one sill: a dirty tongue running off it, and snow
// that settled on it. One roll, two thresholds — a wet sill and a snowy sill are
// not the same sill. With the decay layer off, neither happens.
function sashWeather(decay: DecayProfile, face: number, column: number, floor: number): { stained: boolean; snowy: boolean } {
    if (!isDecayEnabled()) return { stained: false, snowy: false };
    const roll = weatheringRoll(decay, face, column, floor);
    return { stained: roll < WEATHERING.SILL_STAIN.CHANCE, snowy: roll >= WEATHERING.SILL_SNOW.CHANCE };
}

function addSashStain(
    shell: Shell,
    panel: FacadePanel,
    u: number,
    sillBottom: number,
    width: number
): void {
    addSillStain(shell, panel, u, sillBottom, width + WINDOW.FRAME.EXTRA + WINDOW.SILL.EXTRA);
}

function addFacadeWindows(
    shell: Shell,
    panel: FacadePanel,
    columns: number[],
    side: Side,
    decay: DecayProfile
): void {
    const face = side === 'front' ? FACADE_FACE.front : FACADE_FACE.back;
    columns.forEach((u, column) => {
        for (let floor = 0; floor < KHRUSHCHYOVKA.FLOORS; floor++) {
            const y = floorBaseY(floor) + WINDOW.CENTER_FROM_FLOOR;
            const mode = sashState(decay, face, column, floor);
            const barred = floor === 0 && side === 'front' && decay.barredColumns.includes(column);
            const weather = sashWeather(decay, face, column, floor);
            const sillBottom = addWindow(shell, panel, u, y, mode, {
                width: WINDOW.WIDTH,
                height: WINDOW.HEIGHT,
                barred,
                snowy: weather.snowy
            });
            if (weather.stained) addSashStain(shell, panel, u, sillBottom, WINDOW.WIDTH);

            if (isBurntAnchor(decay, face, column, floor)) {
                addSootPlume(shell, panel, u, y, WINDOW.WIDTH, WINDOW.HEIGHT);
            }

            if (floor === 0) continue;
            const style = balconyStyle(side, column, floor, decay);
            if (style) addBalcony(shell, panel, u, y, style);
        }
    });
}

function addEndWindows(shell: Shell, body: BodyShape, decay: DecayProfile): void {
    const panels: { panel: FacadePanel; face: number }[] = [
        { panel: { axis: 'x', side: 1, plane: body.sidePlane }, face: FACADE_FACE.endRight },
        { panel: { axis: 'x', side: -1, plane: -body.sidePlane }, face: FACADE_FACE.endLeft }
    ];
    const columns = [-WINDOW.END_COLUMN_Z, WINDOW.END_COLUMN_Z];

    panels.forEach(({ panel, face }) => {
        columns.forEach((u, column) => {
            for (let floor = 0; floor < KHRUSHCHYOVKA.FLOORS; floor++) {
                const y = floorBaseY(floor) + WINDOW.CENTER_FROM_FLOOR;
                const mode = sashState(decay, face, column, floor);
                const weather = sashWeather(decay, face, column, floor);
                const sillBottom = addWindow(shell, panel, u, y, mode, {
                    width: WINDOW.WIDTH,
                    height: WINDOW.HEIGHT,
                    snowy: weather.snowy
                });
                if (weather.stained) addSashStain(shell, panel, u, sillBottom, WINDOW.WIDTH);

                if (isBurntAnchor(decay, face, column, floor)) {
                    addSootPlume(shell, panel, u, y, WINDOW.WIDTH, WINDOW.HEIGHT);
                }
            }
        });
    });
}

function addEntrance(shell: Shell, panel: FacadePanel, porchX: number, porchIndex: number, decay: DecayProfile, open: boolean): void {
    const porch = KHRUSHCHYOVKA.PORCH;
    const breached = porchIndex === decay.entrances.breached;
    const boarded = porchIndex === decay.entrances.boarded;
    const halfSteps = porch.STEPS_WIDTH / 2;
    const stepDepth = porch.MAX_Z - porch.MIN_Z;

    // Stoop: two concrete treads filling the porch collider (5.2..7.0 m)
    addBox(
        shell.trim,
        panelBox(
            panel,
            porchX - halfSteps,
            porchX + halfSteps,
            0,
            ENTRANCE.STEP.UPPER_HEIGHT,
            ENTRANCE.STEP.START_GAP,
            ENTRANCE.STEP.SPLIT
        ),
        TILE.CONCRETE.U,
        TILE.CONCRETE.V
    );
    addBox(
        shell.trim,
        panelBox(
            panel,
            porchX - halfSteps,
            porchX + halfSteps,
            0,
            ENTRANCE.STEP.LOWER_HEIGHT,
            ENTRANCE.STEP.SPLIT,
            stepDepth - ENTRANCE.STEP.END_GAP
        ),
        TILE.CONCRETE.U,
        TILE.CONCRETE.V
    );

    // Pitch-black doorway cavity behind whatever is left of the leaf. An opened
    // porch has no decal here: the hole in the panel is the doorway, and the
    // interior lobby is what the eye lands on.
    const doorHalf = ENTRANCE.DOOR.WIDTH / 2;
    const doorTop = ENTRANCE.STEP.UPPER_HEIGHT + ENTRANCE.DOOR.HEIGHT;
    if (!open) {
        addBox(
            shell.void,
            panelBox(
                panel,
                porchX - doorHalf - ENTRANCE.DOOR.RECESS_EXTRA,
                porchX + doorHalf + ENTRANCE.DOOR.RECESS_EXTRA,
                ENTRANCE.STEP.UPPER_HEIGHT,
                doorTop + ENTRANCE.DOOR.HEAD_GAP,
                -ENTRANCE.DOOR.RECESS_INWARD,
                ENTRANCE.DOOR.RECESS_PROUD
            ),
            TILE.CONCRETE.U,
            TILE.CONCRETE.V
        );
    }

    if (open) {
        // The one doorway of the district that is still a doorway: no leaf, no
        // boards, nothing between the courtyard and the stairwell.
    } else if (breached) {
        // The steel leaf was ripped out and dumped across the bottom steps; the
        // doorway behind it has been a hole ever since.
        const leaf = ENTRANCE.LEAF;
        addBox(
            shell.rust,
            panelBox(
                panel,
                porchX - leaf.WIDTH / 2 + leaf.OFFSET_X,
                porchX + leaf.WIDTH / 2 + leaf.OFFSET_X,
                ENTRANCE.STEP.LOWER_HEIGHT,
                ENTRANCE.STEP.LOWER_HEIGHT + leaf.THICKNESS,
                leaf.Z_FROM,
                leaf.Z_FROM + leaf.DEPTH
            ),
            TILE.RUST.U,
            TILE.RUST.V
        );
    } else if (boarded) {
        // Boarded up from the outside with whatever boards were left in the shed.
        // The narrow service door keeps its clearance: nobody boarded over it,
        // that is the one leaf the district still uses.
        const board = ENTRANCE.BOARD;
        const boardLeft = porchX - doorHalf - board.WIDTH_EXTRA / 2;
        const boardRight = porchX + doorHalf - ENTRANCE.BLIND.WIDTH - board.EDGE_CLEAR;
        for (let index = 0; index < board.COUNT; index++) {
            const y = ENTRANCE.STEP.UPPER_HEIGHT + board.START + index * (board.HEIGHT + board.GAP);
            addBox(
                shell.wood,
                panelBox(panel, boardLeft, boardRight, y, y + board.HEIGHT, 0.02, board.PROUD),
                TILE.SLATE.U,
                TILE.SLATE.V
            );
        }
    } else {
        addBox(
            shell.rust,
            panelBox(
                panel,
                porchX - doorHalf,
                porchX + doorHalf,
                ENTRANCE.STEP.UPPER_HEIGHT,
                doorTop,
                0.02,
                ENTRANCE.DOOR.LEAF_PROUD
            ),
            TILE.RUST.U,
            TILE.RUST.V
        );
    }
    // Narrow dark service door of the block and its intercom plate
    addBox(
        shell.iron,
        panelBox(
            panel,
            porchX + doorHalf - ENTRANCE.BLIND.WIDTH,
            porchX + doorHalf,
            ENTRANCE.STEP.UPPER_HEIGHT,
            ENTRANCE.STEP.UPPER_HEIGHT + ENTRANCE.BLIND.HEIGHT,
            ENTRANCE.DOOR.LEAF_PROUD,
            ENTRANCE.DOOR.LEAF_PROUD + ENTRANCE.BLIND.PROUD
        ),
        TILE.RUST.U,
        TILE.RUST.V
    );

    // Cantilevered concrete canopy with rusted support posts and a dim bulb.
    // Width/depth come from the porch profile; the slab hangs above the walkway
    // and stays inside the 7.4 m visual envelope of the layout.
    const canopyHalf = porch.CANOPY_WIDTH / 2;
    const canopyDepth = porch.CANOPY_DEPTH;
    const canopyBottom = doorTop + ENTRANCE.CANOPY.HEAD_GAP;
    addBox(
        shell.plinth,
        panelBox(
            panel,
            porchX - canopyHalf,
            porchX + canopyHalf,
            canopyBottom,
            canopyBottom + ENTRANCE.CANOPY.HEIGHT,
            ENTRANCE.CANOPY.WALL_GAP,
            canopyDepth
        ),
        TILE.CONCRETE.U,
        TILE.CONCRETE.V
    );
    addBox(
        shell.trim,
        panelBox(
            panel,
            porchX - canopyHalf - ENTRANCE.CANOPY.EDGE,
            porchX + canopyHalf + ENTRANCE.CANOPY.EDGE,
            canopyBottom + ENTRANCE.CANOPY.HEIGHT,
            canopyBottom + ENTRANCE.CANOPY.HEIGHT + ENTRANCE.CANOPY.TOP,
            ENTRANCE.CANOPY.WALL_GAP,
            canopyDepth + ENTRANCE.CANOPY.DROP
        ),
        TILE.CONCRETE.U,
        TILE.CONCRETE.V
    );
    [-1, 1].forEach((edge) => {
        addBox(
            shell.rust,
            panelBox(
                panel,
                porchX + edge * (canopyHalf - ENTRANCE.CANOPY.SUPPORT_INSET) - ENTRANCE.CANOPY.SUPPORT / 2,
                porchX + edge * (canopyHalf - ENTRANCE.CANOPY.SUPPORT_INSET) + ENTRANCE.CANOPY.SUPPORT / 2,
                ENTRANCE.STEP.UPPER_HEIGHT,
                canopyBottom,
                canopyDepth - ENTRANCE.CANOPY.SUPPORT,
                canopyDepth
            ),
            TILE.RUST.U,
            TILE.RUST.V
        );
    });

    if (breached) {
        // The canopy edge spalled and left two bars of rebar standing out of it.
        const rebar = ENTRANCE.CANOPY.REBAR;
        rebar.OFFSETS.forEach((offset) => {
            addBox(
                shell.rust,
                panelBox(
                    panel,
                    porchX + offset - rebar.THICKNESS / 2,
                    porchX + offset + rebar.THICKNESS / 2,
                    canopyBottom + ENTRANCE.CANOPY.HEIGHT / 2 - rebar.THICKNESS / 2,
                    canopyBottom + ENTRANCE.CANOPY.HEIGHT / 2 + rebar.THICKNESS / 2,
                    canopyDepth - rebar.INSET,
                    canopyDepth + rebar.PROUD
                ),
                TILE.RUST.U,
                TILE.RUST.V
            );
        });
    }

    // Only the two northern porches still have a bulb behind the fitting: the
    // facade asks the same table the lamp array is built from, so a glowing lens
    // can never sit on a porch without an emitter. Everywhere else is a dead one.
    addBox(
        hasPorchBulb(decay.id, porchIndex) ? shell.lamp : shell.iron,
        panelBox(
            panel,
            porchX - ENTRANCE.LAMP.WIDTH / 2,
            porchX + ENTRANCE.LAMP.WIDTH / 2,
            canopyBottom - ENTRANCE.LAMP.HEIGHT - ENTRANCE.LAMP.BOTTOM_GAP,
            canopyBottom - ENTRANCE.LAMP.BOTTOM_GAP,
            ENTRANCE.LAMP.WALL_GAP,
            ENTRANCE.LAMP.PROUD
        ),
        TILE.CONCRETE.U,
        TILE.CONCRETE.V
    );

    // Stairwell column: one landing window per storey above the door. The lobby
    // lost its glazing first, so these sashes are the emptiest of the block.
    for (let floor = ENTRANCE.STAIR_FLOOR_START; floor < KHRUSHCHYOVKA.FLOORS; floor++) {
        const y = floorBaseY(floor) + WINDOW.CENTER_FROM_FLOOR;
        const mode: WindowKey = stairState(decay, porchIndex, floor);
        const weather = sashWeather(decay, FACADE_FACE.front, porchIndex, floor);
        const sillBottom = addWindow(shell, panel, porchX, y, mode, {
            width: WINDOW.STAIR.WIDTH,
            height: WINDOW.STAIR.HEIGHT,
            snowy: weather.snowy
        });
        if (weather.stained) addSashStain(shell, panel, porchX, sillBottom, WINDOW.STAIR.WIDTH);
    }

    // Bench and urn flanking the door, kept clear of the stoop. On the porch the
    // district broke into, the seat is gone from the frame and the bin lies on
    // its side where it was kicked.
    if (!breached) {
        addBox(
            shell.wood,
            panelBox(
                panel,
                porchX - ENTRANCE.BENCH.OFFSET - ENTRANCE.BENCH.WIDTH / 2,
                porchX - ENTRANCE.BENCH.OFFSET + ENTRANCE.BENCH.WIDTH / 2,
                ENTRANCE.BENCH.SEAT_HEIGHT,
                ENTRANCE.BENCH.SEAT_HEIGHT + ENTRANCE.BENCH.SEAT_THICKNESS,
                ENTRANCE.CANOPY.WALL_GAP,
                ENTRANCE.BENCH.SEAT_DEPTH
            ),
            TILE.SLATE.U,
            TILE.SLATE.V
        );
    }
    [-1, 1].forEach((edge) => {
        const legX = porchX - ENTRANCE.BENCH.OFFSET + edge * (ENTRANCE.BENCH.WIDTH / 2 - ENTRANCE.BENCH.LEG_INSET);
        addBox(
            shell.plinth,
            panelBox(
                panel,
                legX - ENTRANCE.BENCH.LEG / 2,
                legX + ENTRANCE.BENCH.LEG / 2,
                0,
                ENTRANCE.BENCH.SEAT_HEIGHT,
                ENTRANCE.BENCH.LEG_START,
                ENTRANCE.BENCH.LEG_START + ENTRANCE.BENCH.SEAT_DEPTH - ENTRANCE.BENCH.LEG_END
            ),
            TILE.CONCRETE.U,
            TILE.CONCRETE.V
        );
    });

    if (breached) {
        const tipped = ENTRANCE.URN.TIPPED;
        addBox(
            shell.plinth,
            panelBox(
                panel,
                porchX + ENTRANCE.URN.OFFSET + tipped.OFFSET - tipped.LENGTH / 2,
                porchX + ENTRANCE.URN.OFFSET + tipped.OFFSET + tipped.LENGTH / 2,
                0,
                tipped.HEIGHT,
                ENTRANCE.URN.WALL_GAP,
                ENTRANCE.URN.WALL_GAP + ENTRANCE.URN.DEPTH
            ),
            TILE.CONCRETE.U,
            TILE.CONCRETE.V
        );
        return;
    }

    addBox(
        shell.plinth,
        panelBox(
            panel,
            porchX + ENTRANCE.URN.OFFSET - ENTRANCE.URN.WIDTH / 2,
            porchX + ENTRANCE.URN.OFFSET + ENTRANCE.URN.WIDTH / 2,
            0,
            ENTRANCE.URN.HEIGHT,
            ENTRANCE.URN.WALL_GAP,
            ENTRANCE.URN.WALL_GAP + ENTRANCE.URN.DEPTH
        ),
        TILE.CONCRETE.U,
        TILE.CONCRETE.V
    );
    addBox(
        shell.iron,
        panelBox(
            panel,
            porchX + ENTRANCE.URN.OFFSET - ENTRANCE.URN.WIDTH / 2,
            porchX + ENTRANCE.URN.OFFSET + ENTRANCE.URN.WIDTH / 2,
            ENTRANCE.URN.HEIGHT,
            ENTRANCE.URN.HEIGHT + ENTRANCE.URN.LID,
            ENTRANCE.URN.WALL_GAP,
            ENTRANCE.URN.WALL_GAP + ENTRANCE.URN.DEPTH
        ),
        TILE.RUST.U,
        TILE.RUST.V
    );
}

function addBase(shell: Shell, body: BodyShape): void {
    addBox(
        shell.plinth,
        {
            minX: -body.width / 2 - BASE.PLINTH_EXTRA / 2,
            maxX: body.width / 2 + BASE.PLINTH_EXTRA / 2,
            minY: 0,
            maxY: body.plinthHeight,
            minZ: -body.depth / 2,
            maxZ: body.depth / 2
        },
        TILE.CONCRETE.U,
        TILE.CONCRETE.V
    );
    // Concrete drip ledge above the plinth: the wall field starts behind it.
    addBox(
        shell.trim,
        {
            minX: -body.width / 2 - BASE.LEDGE.EXTRA,
            maxX: body.width / 2 + BASE.LEDGE.EXTRA,
            minY: body.plinthHeight - BASE.LEDGE.INSET,
            maxY: body.plinthHeight + BASE.LEDGE.HEIGHT,
            minZ: -body.depth / 2 - BASE.LEDGE.PROUD,
            maxZ: body.depth / 2 + BASE.LEDGE.PROUD
        },
        TILE.CONCRETE.U,
        TILE.CONCRETE.V
    );
}

function addWallBody(shell: Shell, body: BodyShape, doorways: WallHole[]): void {
    // A block with an opened porch has real holes in its panel face: the wall is
    // built without its front and the face is laid around the doorways, so the
    // stairwell is visible from the courtyard instead of a black decal.
    addBox(
        shell.panel,
        {
            minX: -body.width / 2,
            maxX: body.width / 2,
            minY: body.plinthHeight,
            maxY: body.roofY,
            minZ: -panelDepth() / 2,
            maxZ: panelDepth() / 2
        },
        TILE.PANEL.U,
        TILE.PANEL.V,
        doorways.length > 0
    );
    if (doorways.length > 0) {
        addFrontFace(
            shell.panel,
            {
                minX: -body.width / 2,
                maxX: body.width / 2,
                minY: body.plinthHeight,
                maxY: body.roofY,
                minZ: -panelDepth() / 2,
                maxZ: panelDepth() / 2
            },
            TILE.PANEL.U,
            TILE.PANEL.V,
            doorways
        );
    }

    // End slabs are wider and shallower: their faces close the gables while their
    // front/back planes stay hidden inside the panel field. The front plane of
    // this box is 6 cm behind the panel and therefore behind a doorway cut into
    // it, so it is cut around the same hole — otherwise a solid slab would show
    // through the open porch.
    const sideBox = {
        minX: -body.sidePlane,
        maxX: body.sidePlane,
        minY: body.plinthHeight,
        maxY: body.roofY,
        minZ: -sideDepth() / 2,
        maxZ: sideDepth() / 2
    };
    addBox(shell.side, sideBox, TILE.SIDE.U, TILE.SIDE.V, doorways.length > 0);
    if (doorways.length > 0) {
        addFrontFace(shell.side, sideBox, TILE.SIDE.U, TILE.SIDE.V, doorways);
    }
}

function addPanelRibs(shell: Shell, body: BodyShape, sections: number): void {
    // Horizontal storey bands: they read as the slab edges of the prefab system.
    for (let floor = 1; floor <= KHRUSHCHYOVKA.FLOORS; floor++) {
        const y = floorBaseY(floor);
        addBox(
            shell.plinth,
            {
                minX: -body.width / 2 - RIB.WIDTH_EXTRA / 2,
                maxX: body.width / 2 + RIB.WIDTH_EXTRA / 2,
                minY: y - RIB.THICKNESS / 2,
                maxY: y + RIB.THICKNESS / 2,
                minZ: -body.depth / 2 - RIB.DEPTH_EXTRA / 2,
                maxZ: body.depth / 2 + RIB.DEPTH_EXTRA / 2
            },
            TILE.CONCRETE.U,
            TILE.CONCRETE.V
        );
    }

    // Vertical joints on section centres and between sections, long faces only.
    const joints: number[] = [];
    for (let section = 0; section < sections; section++) {
        joints.push(sectionOffset(section, sections));
        if (section > 0) {
            joints.push(sectionOffset(section, sections) - KHRUSHCHYOVKA.SECTION_WIDTH / 2);
        }
    }
    joints.forEach((x) => {
        [1, -1].forEach((side) => {
            addBox(
                shell.plinth,
                {
                    minX: x - RIB.VERTICAL_WIDTH / 2,
                    maxX: x + RIB.VERTICAL_WIDTH / 2,
                    minY: body.plinthHeight,
                    maxY: body.roofY,
                    minZ: side > 0 ? body.frontPlane - RIB.ANCHOR : -body.frontPlane - RIB.VERTICAL_PROUD,
                    maxZ: side > 0 ? body.frontPlane + RIB.VERTICAL_PROUD : -body.frontPlane + RIB.ANCHOR
                },
                TILE.CONCRETE.U,
                TILE.CONCRETE.V
            );
        });
    });
}

function addBasementVents(shell: Shell, body: BodyShape, porchXs: number[]): void {
    const first = -body.width / 2 + VENT.EDGE_INSET;
    const last = body.width / 2 - VENT.EDGE_INSET;
    for (let x = first; x <= last; x += VENT.STEP) {
        if (porchXs.some((porchX) => Math.abs(porchX - x) < VENT.PORCH_CLEARANCE)) continue;
        [1, -1].forEach((side) => {
            addBox(
                shell.iron,
                {
                    minX: x - VENT.WIDTH / 2,
                    maxX: x + VENT.WIDTH / 2,
                    minY: VENT.Y,
                    maxY: VENT.Y + VENT.HEIGHT,
                    minZ: side > 0 ? body.depth / 2 - VENT.ANCHOR : -body.depth / 2 - VENT.PROUD,
                    maxZ: side > 0 ? body.depth / 2 + VENT.PROUD : -body.depth / 2 + VENT.ANCHOR
                },
                TILE.RUST.U,
                TILE.RUST.V
            );
        });
    }
}

// `doorway` is the hole of the porch the district opened up (null = none), in
// building-local metres: that porch loses its black doorway decal and its leaf,
// and the panel face of the block is cut around the hole, so the stairwell can be
// seen from the yard. `openPorch` is its index among the porches.
export function buildKhrushchyovkaFacade(
    shell: Shell,
    body: BodyShape,
    sections: number,
    porchXs: number[],
    decay: DecayProfile,
    doorway: WallHole | null = null,
    openPorch = -1
): void {
    const front: FacadePanel = { axis: 'z', side: 1, plane: body.frontPlane };
    const back: FacadePanel = { axis: 'z', side: -1, plane: -body.frontPlane };
    const holes: WallHole[] = doorway ? [doorway] : [];

    addBase(shell, body);
    addWallBody(shell, body, holes);
    addPanelRibs(shell, body, sections);

    addFacadeWindows(shell, front, frontWindowColumns(sections, porchXs), 'front', decay);
    addFacadeWindows(shell, back, backWindowColumns(sections), 'back', decay);
    addEndWindows(shell, body, decay);

    porchXs.forEach((porchX, index) => addEntrance(shell, front, porchX, index, decay, index === openPorch));
    addBasementVents(shell, body, porchXs);

    // Last layer: what eleven winters did to the wall itself.
    addBlockWeathering(shell, body, decay);
}
