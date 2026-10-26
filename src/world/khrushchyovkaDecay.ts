// Decay of the Khrushchyovka, eleven years after the catastrophe: which sash of
// which block is intact, cracked, blown out or boarded over.
//
// The four blocks are four different histories, not one history repeated. The
// authored table below owns the coarse decisions (the balcony patchwork shift,
// the ground-floor grilles, the one flat that burned); the per-window decision
// is a hash of the block seed, the face, the column and the floor, so it never
// depends on the order the facade builder walks and stays identical between
// page loads and Node runs.
import type { WindowKey } from './khrushchyovkaShell.js';

// Faces of a block in the order the facade builder walks them: the courtyard
// and rear long faces, then the two gable ends.
export const FACADE_FACE = {
    front: 0,
    back: 1,
    endRight: 2,
    endLeft: 3
} as const;

export interface BurntAnchor {
    face: number;
    column: number;
    floor: number;
}

// A point on a facade, in metres along the face from the centre of the block and
// in metres above its plinth. Used by the weathering layer, which is about where
// the wall failed, not about which sash it belongs to.
export interface WallAnchor {
    face: number;
    u: number;
    floor: number;
}

// Loose object left on the roof. Coordinates are local metres inside the parapet.
export interface RoofDebris {
    x: number;
    z: number;
    kind: 'sheet' | 'pipe' | 'pile';
}

// What eleven winters did to the roof: the mast the wind took, the hatch nobody
// closed, the parapet block the frost pushed out. The roof is the one part of a
// block that reads from the isometric camera as pure silhouette, so every entry
// here is chosen to change the outline, not the surface.
export interface RoofDamage {
    antennas: number;
    // Index of the mast bent at the joint, -1 keeps every mast straight.
    bentAntenna: number;
    // 'torn' leaves the leaf lying on the bitumen and the doorway open.
    hatch: 'closed' | 'torn';
    // Section whose parapet block is gone, -1 keeps the ring whole.
    parapetGap: number;
    // Section whose vent shaft lost its cap, -1 keeps every cap.
    openVent: number;
    debris: readonly RoofDebris[];
}

// What is left of the entrances: the porch the district broke into and the one it
// boarded up afterwards. Both are porch indices on the courtyard face.
export interface EntranceDamage {
    // Leaf torn off, bench sat through, urn kicked over, canopy edge spalled.
    breached: number;
    // Boarded from the outside, -1 keeps the steel leaf.
    boarded: number;
}

export interface DecayProfile {
    id: string;
    // Seeds the window hash. Two blocks with the same seed would break the same
    // panes in the same places, which is exactly the clone look this replaces.
    seed: number;
    // Row shift of the hand-placed balcony plan: the patchwork of a block is
    // never the patchwork of its neighbour.
    balconyShift: number;
    // Reversed storey order of the same plan: one block's balconies climb, the
    // next one's hang.
    balconyMirror: boolean;
    // Ground-floor grilles of the courtyard face. The council repaired what the
    // tenants asked for, block by block.
    barredColumns: readonly number[];
    // The one flat that burned: an empty window under a washed soot plume.
    burnt: BurntAnchor;
    // The one panel corner the frost broke out, with rebar in the hole.
    spall: WallAnchor;
    // Tags the district left, authored so eight of them are not one stamp.
    graffiti: readonly Omit<WallAnchor, 'floor'>[];
    // Where the gas line rusts through and runs down the wall.
    pipeStains: readonly number[];
    // The roof: what stands, what was torn off and what lies on the bitumen.
    roof: RoofDamage;
    // The porches: one broken into, one boarded shut.
    entrances: EntranceDamage;
}

interface Band {
    intact: number;
    cracked: number;
    empty: number;
    boarded: number;
}

// Weights, not counts: the hash spreads them over the facade. Damage climbs from
// the courtyard — the ground floor is stripped, the top floor keeps most of its
// glass, the gables are out of reach of everything but weather.
const BANDS: Record<'ground' | 'middle' | 'upper' | 'gable' | 'stair', Band> = {
    ground: { intact: 0.38, cracked: 0.2, empty: 0.29, boarded: 0.13 },
    middle: { intact: 0.56, cracked: 0.26, empty: 0.14, boarded: 0.04 },
    upper: { intact: 0.7, cracked: 0.22, empty: 0.06, boarded: 0.02 },
    gable: { intact: 0.86, cracked: 0.11, empty: 0.03, boarded: 0 },
    // The stair window hangs right over the entrance, so the lobby is the first
    // thing to lose its glass.
    stair: { intact: 0.24, cracked: 0.2, empty: 0.42, boarded: 0.14 }
};

const PROFILES: readonly DecayProfile[] = [
    {
        id: 'H1',
        seed: 101,
        balconyShift: 0,
        balconyMirror: false,
        barredColumns: [0, 3],
        burnt: { face: FACADE_FACE.front, column: 3, floor: 2 },
        spall: { face: FACADE_FACE.front, u: -9.0, floor: 3 },
        graffiti: [
            { face: FACADE_FACE.front, u: -11.6 },
            { face: FACADE_FACE.back, u: 2.2 }
        ],
        pipeStains: [-9.3, -3.3, 3.3],
        roof: {
            antennas: 2,
            bentAntenna: 0,
            hatch: 'torn',
            parapetGap: -1,
            openVent: 1,
            debris: [
                { x: -6.5, z: 2.6, kind: 'sheet' },
                { x: 2.0, z: -3.2, kind: 'pile' }
            ]
        },
        entrances: { breached: 1, boarded: 2 }
    },
    {
        id: 'H2',
        seed: 227,
        balconyShift: 2,
        balconyMirror: false,
        barredColumns: [1, 5],
        burnt: { face: FACADE_FACE.back, column: 4, floor: 1 },
        spall: { face: FACADE_FACE.endLeft, u: 1.1, floor: 2 },
        graffiti: [
            { face: FACADE_FACE.front, u: 6.4 },
            { face: FACADE_FACE.front, u: -4.9 }
        ],
        pipeStains: [-3.3, 3.3, 9.3],
        roof: {
            antennas: 3,
            bentAntenna: 1,
            hatch: 'closed',
            parapetGap: 2,
            openVent: -1,
            debris: [
                { x: 5.0, z: 1.8, kind: 'pipe' },
                { x: -8.0, z: -1.0, kind: 'sheet' }
            ]
        },
        entrances: { breached: 2, boarded: -1 }
    },
    {
        id: 'H3',
        seed: 353,
        balconyShift: 3,
        balconyMirror: true,
        barredColumns: [2, 4],
        burnt: { face: FACADE_FACE.front, column: 1, floor: 0 },
        spall: { face: FACADE_FACE.back, u: 3.0, floor: 4 },
        graffiti: [
            { face: FACADE_FACE.front, u: 1.2 },
            { face: FACADE_FACE.endRight, u: 0.4 }
        ],
        pipeStains: [-9.3, 3.3, 9.3],
        roof: {
            antennas: 1,
            bentAntenna: -1,
            hatch: 'torn',
            parapetGap: 4,
            openVent: 3,
            debris: [
                { x: -2.4, z: 3.0, kind: 'pile' },
                { x: 7.5, z: -2.2, kind: 'pipe' }
            ]
        },
        entrances: { breached: 0, boarded: 1 }
    },
    {
        id: 'H4',
        seed: 479,
        balconyShift: 5,
        balconyMirror: true,
        barredColumns: [0, 6],
        burnt: { face: FACADE_FACE.endRight, column: 1, floor: 3 },
        spall: { face: FACADE_FACE.front, u: 9.0, floor: 1 },
        graffiti: [
            { face: FACADE_FACE.front, u: -9.4 },
            { face: FACADE_FACE.back, u: -3.6 }
        ],
        pipeStains: [-9.3, -3.3, 9.3],
        roof: {
            antennas: 2,
            bentAntenna: 1,
            hatch: 'closed',
            parapetGap: -1,
            openVent: 0,
            debris: [{ x: 0.9, z: 2.4, kind: 'sheet' }]
        },
        entrances: { breached: 1, boarded: -1 }
    }
];

const FALLBACK_SEED = 863;

// Master switch of the decay layer (?decay=off), set once at boot before the
// world is built: the geometry is baked from these answers, so there is nothing
// to switch at runtime. It covers the whole pass — sashes, soot, stains, snow on
// the sills, the roof and the porches — because the point of the switch is an A/B
// against the blocks as they were before it.
let decayEnabled = true;

export function setDecayEnabled(enabled: boolean): void {
    decayEnabled = enabled;
}

// The weathering layer asks the same question before it lays a stain or a cap.
export function isDecayEnabled(): boolean {
    return decayEnabled;
}

// A block as it stood before the pass: every mast up, the hatch closed, the
// parapet ring whole, both leaves in place.
const PRISTINE_ROOF: RoofDamage = {
    antennas: 3,
    bentAntenna: -1,
    hatch: 'closed',
    parapetGap: -1,
    openVent: -1,
    debris: []
};

const PRISTINE_ENTRANCES: EntranceDamage = { breached: -1, boarded: -1 };

// Salt of the stair band: the same window may not share its roll with the sash
// of the flat above the porch.
const STAIR_SALT = 7919;

// Salt of the weathering layer: a dirty sill and a smashed sash are two different
// stories and must not fall in the same place.
const WEATHER_SALT = 2711;

function profileHash(seed: number, face: number, column: number, floor: number): number {
    let hash = seed >>> 0;
    hash = Math.imul(hash ^ (face + 1), 0x9e3779b1);
    hash = Math.imul(hash ^ (column + 1), 0x85ebca6b);
    hash = Math.imul(hash ^ (floor + 1), 0xc2b2ae35);
    hash ^= hash >>> 15;
    hash = Math.imul(hash, 0x2c1b3c6d);
    hash ^= hash >>> 13;
    return (hash >>> 0) / 4294967296;
}

function stateFromBand(band: Band, roll: number): WindowKey {
    if (roll < band.intact) return 'winDark';
    if (roll < band.intact + band.cracked) return 'winCracked';
    if (roll < band.intact + band.cracked + band.empty) return 'winEmpty';
    return 'winBoarded';
}

function bandFor(face: number, floor: number): Band {
    if (face === FACADE_FACE.endRight || face === FACADE_FACE.endLeft) return BANDS.gable;
    if (floor === 0) return BANDS.ground;
    return floor < 3 ? BANDS.middle : BANDS.upper;
}

export function isBurntAnchor(profile: DecayProfile, face: number, column: number, floor: number): boolean {
    if (!decayEnabled) return false;
    const anchor = profile.burnt;
    return anchor.face === face && anchor.column === column && anchor.floor === floor;
}

// State of a flat's sash.
export function sashState(profile: DecayProfile, face: number, column: number, floor: number): WindowKey {
    if (!decayEnabled) return 'winDark';
    if (isBurntAnchor(profile, face, column, floor)) return 'winEmpty';
    return stateFromBand(bandFor(face, floor), profileHash(profile.seed, face, column, floor));
}

// State of a stairwell landing window. `porch` is the index of the entrance on
// this face, not the column of a flat.
export function stairState(profile: DecayProfile, porch: number, floor: number): WindowKey {
    if (!decayEnabled) return 'winDark';
    return stateFromBand(BANDS.stair, profileHash(profile.seed + STAIR_SALT, 4, porch, floor));
}

// Whether a sash also carries a dirty tongue under its sill. Same hash, different
// salt, so the stain and the damage do not travel together.
export function weatheringRoll(profile: DecayProfile, face: number, column: number, floor: number): number {
    return profileHash(profile.seed + WEATHER_SALT, face, column, floor);
}

// A block the table does not know still gets its own history instead of a clone
// of H1: its seed is folded out of its id.
function fallbackProfile(id: string): DecayProfile {
    let seed = FALLBACK_SEED;
    for (let index = 0; index < id.length; index++) {
        seed = (seed * 31 + id.charCodeAt(index)) % 2147483647;
    }
    return { ...PROFILES[0], id, seed };
}

export function decayFor(id: string): DecayProfile {
    const profile = PROFILES.find((entry) => entry.id === id) || fallbackProfile(id);
    return decayEnabled ? profile : { ...profile, roof: PRISTINE_ROOF, entrances: PRISTINE_ENTRANCES };
}
