// The tall streamlined command tower of the «ВНИИТЭ-68»: faceted upper cabin,
// its aerodynamic prow, the recessed cathode visor with blast hood and wiper, the
// hull number plate, the tapered crown with cupola and lifting lugs, the Lunokhod
// optical pod, the magnetic-loop telemetry antenna and the swept Sputnik whips.
// Returns the two pivots the pose animator sweeps and sways.
import type { MechMaterials } from './mechMaterials.js';
import { box, cyl } from './mechGeometry.js';
import * as THREE from 'three';

const TOWER = {
    // The tower rises from the hull's structural collar.
    ORIGIN: { Y: 0.88, Z: 0.08 },
    BODY: { WIDTH: 1.02, HEIGHT: 0.78, DEPTH: 1.1, Y: 0.08 },
    PROW: { WIDTH: 0.94, HEIGHT: 0.72, DEPTH: 0.36, Y: 0.06, Z: 0.56, TILT: -0.24 },
    VISOR: { WIDTH: 0.78, HEIGHT: 0.22, DEPTH: 0.08, Y: 0.22, Z: 0.71 },
    HOOD: { WIDTH: 0.86, HEIGHT: 0.05, DEPTH: 0.18, Y: 0.34, Z: 0.74, TILT: 0.12 },
    BROW: { WIDTH: 0.84, HEIGHT: 0.04, DEPTH: 0.12, Y: 0.09, Z: 0.72 },
    WIPER: { SIZE: 0.025, LENGTH: 0.18, X: -0.14, Y: 0.23, Z: 0.75, TILT: 0.28 },
    LOUVERS: { COUNT: 4, BAR: 0.04, LENGTH: 0.42, X: 0.52, Y: 0.24, Z: -0.16, STEP_Y: -0.07, TILT: 0.25 },
    NUMBER_PLATE: { WIDTH: 0.03, HEIGHT: 0.22, DEPTH: 0.4, X: 0.52, Y: 0.18, Z: 0.26 },
    CROWN: { WIDTH: 0.86, HEIGHT: 0.18, DEPTH: 0.94, Y: 0.54, Z: -0.04 },
    CUPOLA: {
        BASE: { TOP_RADIUS: 0.25, BOTTOM_RADIUS: 0.32, HEIGHT: 0.16, SEGMENTS: 8, Y: 0.7, Z: -0.06 },
        CAP: { TOP_RADIUS: 0.18, BOTTOM_RADIUS: 0.2, HEIGHT: 0.06, SEGMENTS: 8, Y: 0.8 },
        PERISCOPE: { WIDTH: 0.16, HEIGHT: 0.09, DEPTH: 0.16, Y: 0.86, Z: -0.02 },
        PERISCOPE_VISOR: { WIDTH: 0.12, HEIGHT: 0.05, DEPTH: 0.04, Y: 0.86, Z: 0.06 }
    },
    LUGS: {
        POSITIONS: [[-0.36, 0.32], [0.36, 0.32], [-0.36, -0.38], [0.36, -0.38]],
        BODY: { WIDTH: 0.04, HEIGHT: 0.12, DEPTH: 0.09, Y: 0.65 },
        EYE: { RADIUS: 0.018, LENGTH: 0.06, SEGMENTS: 5, Y: 0.68 }
    },
    OPTICAL_POD: {
        X: -0.34,
        Y: -0.18,
        Z: 0.68,
        HOUSING: { TOP_RADIUS: 0.18, BOTTOM_RADIUS: 0.22, HEIGHT: 0.26, SEGMENTS: 8 },
        LENS: { RADIUS: 0.15, HEIGHT: 0.04, SEGMENTS: 8, Z: 0.14 },
        BRACKET: { WIDTH: 0.4, HEIGHT: 0.03, DEPTH: 0.08, Y: 0.16, Z: 0.12 }
    },
    RADAR: {
        X: 0.28,
        Y: 0.78,
        Z: -0.24,
        MAST: { TOP_RADIUS: 0.025, BOTTOM_RADIUS: 0.035, HEIGHT: 0.42, SEGMENTS: 6, Y: 0.2 },
        RING_Y: 0.56,
        SEGMENTS: 8,
        RADIUS: 0.18,
        SLAT: { WIDTH: 0.16, HEIGHT: 0.032, DEPTH: 0.032 },
        HUB: { RADIUS: 0.045, HEIGHT: 0.08, SEGMENTS: 6 }
    },
    ANTENNA: {
        X: -0.3,
        Y: 0.62,
        Z: -0.32,
        BASE: { TOP_RADIUS: 0.03, BOTTOM_RADIUS: 0.04, HEIGHT: 0.14, SEGMENTS: 5, Y: 0.06 },
        WHIPS: [
            { TOP_RADIUS: 0.008, BOTTOM_RADIUS: 0.018, HEIGHT: 1.35, SEGMENTS: 4, X: 0, Y: 0.72, Z: -0.14, TILT_X: -0.18, TILT_Z: 0 },
            { TOP_RADIUS: 0.006, BOTTOM_RADIUS: 0.014, HEIGHT: 0.95, SEGMENTS: 4, X: 0.12, Y: 0.52, Z: -0.18, TILT_X: -0.26, TILT_Z: -0.08 }
        ]
    }
} as const;

export interface MechTower {
    group: THREE.Group;
    radarPivot: THREE.Group;
    antennaPivot: THREE.Group;
}

export function createTower(materials: MechMaterials): MechTower {
    const group = new THREE.Group();
    group.position.set(0, TOWER.ORIGIN.Y, TOWER.ORIGIN.Z);

    // Tall faceted upper monocoque cabin with an aerodynamic prow
    group.add(box(TOWER.BODY.WIDTH, TOWER.BODY.HEIGHT, TOWER.BODY.DEPTH, materials.hullLight, 0, TOWER.BODY.Y, 0));
    group.add(box(TOWER.PROW.WIDTH, TOWER.PROW.HEIGHT, TOWER.PROW.DEPTH, materials.hullLight, 0, TOWER.PROW.Y, TOWER.PROW.Z, TOWER.PROW.TILT));

    // Recessed cathode-ray slit visor with protective blast hood and wiper
    group.add(box(TOWER.VISOR.WIDTH, TOWER.VISOR.HEIGHT, TOWER.VISOR.DEPTH, materials.visor, 0, TOWER.VISOR.Y, TOWER.VISOR.Z, TOWER.PROW.TILT));
    group.add(box(TOWER.HOOD.WIDTH, TOWER.HOOD.HEIGHT, TOWER.HOOD.DEPTH, materials.steel, 0, TOWER.HOOD.Y, TOWER.HOOD.Z, TOWER.HOOD.TILT));
    group.add(box(TOWER.BROW.WIDTH, TOWER.BROW.HEIGHT, TOWER.BROW.DEPTH, materials.hullDark, 0, TOWER.BROW.Y, TOWER.BROW.Z, TOWER.PROW.TILT));
    group.add(box(TOWER.WIPER.SIZE, TOWER.WIPER.LENGTH, TOWER.WIPER.SIZE, materials.steel, TOWER.WIPER.X, TOWER.WIPER.Y, TOWER.WIPER.Z, TOWER.PROW.TILT, 0, TOWER.WIPER.TILT));

    // Armoured ventilation louvres on both tower cheeks
    for (let louvre = 0; louvre < TOWER.LOUVERS.COUNT; louvre++) {
        const y = TOWER.LOUVERS.Y + TOWER.LOUVERS.STEP_Y * louvre;
        group.add(box(TOWER.LOUVERS.BAR, TOWER.LOUVERS.BAR, TOWER.LOUVERS.LENGTH, materials.steel, TOWER.LOUVERS.X, y, TOWER.LOUVERS.Z, 0, 0, TOWER.LOUVERS.TILT));
        group.add(box(TOWER.LOUVERS.BAR, TOWER.LOUVERS.BAR, TOWER.LOUVERS.LENGTH, materials.steel, -TOWER.LOUVERS.X, y, TOWER.LOUVERS.Z, 0, 0, -TOWER.LOUVERS.TILT));
    }
    group.add(box(
        TOWER.NUMBER_PLATE.WIDTH,
        TOWER.NUMBER_PLATE.HEIGHT,
        TOWER.NUMBER_PLATE.DEPTH,
        materials.plate,
        TOWER.NUMBER_PLATE.X,
        TOWER.NUMBER_PLATE.Y,
        TOWER.NUMBER_PLATE.Z
    ));

    // Tapered crown cap, periscope cupola and crane lifting lugs
    group.add(box(TOWER.CROWN.WIDTH, TOWER.CROWN.HEIGHT, TOWER.CROWN.DEPTH, materials.hullMid, 0, TOWER.CROWN.Y, TOWER.CROWN.Z));
    const cupola = TOWER.CUPOLA;
    group.add(cyl(cupola.BASE.TOP_RADIUS, cupola.BASE.BOTTOM_RADIUS, cupola.BASE.HEIGHT, cupola.BASE.SEGMENTS, materials.hullDark, 0, cupola.BASE.Y, cupola.BASE.Z));
    group.add(cyl(cupola.CAP.TOP_RADIUS, cupola.CAP.BOTTOM_RADIUS, cupola.CAP.HEIGHT, cupola.CAP.SEGMENTS, materials.enamel, 0, cupola.CAP.Y, cupola.BASE.Z));
    group.add(box(cupola.PERISCOPE.WIDTH, cupola.PERISCOPE.HEIGHT, cupola.PERISCOPE.DEPTH, materials.steel, 0, cupola.PERISCOPE.Y, cupola.PERISCOPE.Z));
    group.add(box(cupola.PERISCOPE_VISOR.WIDTH, cupola.PERISCOPE_VISOR.HEIGHT, cupola.PERISCOPE_VISOR.DEPTH, materials.visor, 0, cupola.PERISCOPE_VISOR.Y, cupola.PERISCOPE_VISOR.Z));

    TOWER.LUGS.POSITIONS.forEach(([lugX, lugZ]) => {
        group.add(box(TOWER.LUGS.BODY.WIDTH, TOWER.LUGS.BODY.HEIGHT, TOWER.LUGS.BODY.DEPTH, materials.steel, lugX, TOWER.LUGS.BODY.Y, lugZ));
        group.add(cyl(TOWER.LUGS.EYE.RADIUS, TOWER.LUGS.EYE.RADIUS, TOWER.LUGS.EYE.LENGTH, TOWER.LUGS.EYE.SEGMENTS, materials.piston, lugX, TOWER.LUGS.EYE.Y, lugZ, 0, 0, Math.PI / 2));
    });

    // «Луноход» optical telemetry pod on the front-left cheek
    const pod = TOWER.OPTICAL_POD;
    const opticalPod = new THREE.Group();
    opticalPod.position.set(pod.X, pod.Y, pod.Z);
    group.add(opticalPod);
    opticalPod.add(cyl(pod.HOUSING.TOP_RADIUS, pod.HOUSING.BOTTOM_RADIUS, pod.HOUSING.HEIGHT, pod.HOUSING.SEGMENTS, materials.enamel, 0, 0, 0, Math.PI / 2));
    opticalPod.add(cyl(pod.LENS.RADIUS, pod.LENS.RADIUS, pod.LENS.HEIGHT, pod.LENS.SEGMENTS, materials.lens, 0, 0, pod.LENS.Z, Math.PI / 2));
    opticalPod.add(box(pod.BRACKET.WIDTH, pod.BRACKET.HEIGHT, pod.BRACKET.DEPTH, materials.piston, 0, pod.BRACKET.Y, pod.BRACKET.Z));

    // Magnetic-loop telemetry antenna: the pose animator ticks it one step at a time
    const radar = TOWER.RADAR;
    const radarPivot = new THREE.Group();
    radarPivot.position.set(radar.X, radar.Y, radar.Z);
    group.add(radarPivot);
    radarPivot.add(cyl(radar.MAST.TOP_RADIUS, radar.MAST.BOTTOM_RADIUS, radar.MAST.HEIGHT, radar.MAST.SEGMENTS, materials.piston, 0, radar.MAST.Y, 0));

    const ring = new THREE.Group();
    ring.position.y = radar.RING_Y;
    radarPivot.add(ring);
    for (let slat = 0; slat < radar.SEGMENTS; slat++) {
        const angle = (slat / radar.SEGMENTS) * Math.PI * 2;
        ring.add(box(
            radar.SLAT.WIDTH,
            radar.SLAT.HEIGHT,
            radar.SLAT.DEPTH,
            materials.enamel,
            Math.cos(angle) * radar.RADIUS,
            Math.sin(angle) * radar.RADIUS,
            0,
            0,
            0,
            angle + Math.PI / 2
        ));
    }
    ring.add(cyl(radar.HUB.RADIUS, radar.HUB.RADIUS, radar.HUB.HEIGHT, radar.HUB.SEGMENTS, materials.beacon, 0, 0, 0, Math.PI / 2));

    // Twin swept Sputnik whip antennas on the crown
    const antenna = TOWER.ANTENNA;
    const antennaPivot = new THREE.Group();
    antennaPivot.position.set(antenna.X, antenna.Y, antenna.Z);
    group.add(antennaPivot);
    antennaPivot.add(cyl(antenna.BASE.TOP_RADIUS, antenna.BASE.BOTTOM_RADIUS, antenna.BASE.HEIGHT, antenna.BASE.SEGMENTS, materials.steel, 0, antenna.BASE.Y, 0));
    antenna.WHIPS.forEach((whip) => {
        antennaPivot.add(cyl(
            whip.TOP_RADIUS,
            whip.BOTTOM_RADIUS,
            whip.HEIGHT,
            whip.SEGMENTS,
            materials.piston,
            whip.X,
            whip.Y,
            whip.Z,
            whip.TILT_X,
            0,
            whip.TILT_Z
        ));
    });

    return { group, radarPivot, antennaPivot };
}
