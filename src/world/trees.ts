// Winter courtyard trees: two bare species — the fastigiate poplar and the wide
// spreading crown. There are no leaves and no crown volumes at all: a tree is a
// seeded skeleton of tapered branch cylinders with snow lying on the upper limbs,
// which is what a courtyard tree looks like in February.
//
// Every tree of the yard is merged into five meshes (bark, rimed twigs, snow,
// whitewash, shrub soil) instead of five per tree, so sixteen branchy trees cost
// less than the ten leafy ones did. Each instance is generated from its own seed,
// so no two crowns are the same model.
//
// Model dimensions live here; the values the plan measures (crown cap, trunk
// height, collider radius) come from TREE_PROFILE.
import { COLORS } from '../config/colors.js';
import { createQuadBuilder } from '../core/geometryBuilder.js';
import { mergeGeometries, type MergePart } from '../core/geometryMerge.js';
import { snowCapMat, snowSoilMat, whitewashMat } from '../core/materials.js';
import { makePS1Material } from '../core/ps1Material.js';
import { createSeededRandom } from '../core/random.js';
import { textures } from '../core/textures.js';
import { TREE_PROFILE, type ObjectDescriptor, type WinterTreeType } from './layout/footprints.js';
import { objectsOfType, registerColliders } from './placement.js';
import { addBox, placeAt } from './quadTransform.js';
import type { Layout } from './layout/createLayout.js';
import type { CollisionWorld } from '../systems/collision.js';
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

// Shared skeleton grammar: trunk to the first fork, then limb -> branch -> twig.
// Angles are measured away from vertical, so a poplar (small angles) stays a
// column and a spreading tree (large ones) opens into a dome.
interface SpeciesProfile {
    TRUNK_HEIGHT: number;
    TRUNK_RADIUS: number;
    // Taper of the trunk at the fork: a tree is a cone before it is a crown.
    TRUNK_TAPER: number;
    LEADER: { LENGTH: number; TILT: number; RADIUS_RATIO: number };
    LIMBS: { COUNT: number; ANGLE_MIN: number; ANGLE_MAX: number; LENGTH_MIN: number; LENGTH_MAX: number; RADIUS: number };
    LEVELS: number;
    SPLIT_MIN: number;
    SPLIT_MAX: number;
    ANGLE_STEP_MIN: number;
    ANGLE_STEP_MAX: number;
    LENGTH_RATIO_MIN: number;
    LENGTH_RATIO_MAX: number;
    RADIUS_RATIO: number;
    TWIG_RADIUS: number;
    TRUNK_SEGMENTS: number;
    LIMB_SEGMENTS: number;
    TWIG_SEGMENTS: number;
}

const POPLAR: SpeciesProfile = {
    // Fastigiate: a long trunk, short limbs swept up along it, and the leader
    // that keeps the spire going to the top of the reserved trunk height.
    TRUNK_HEIGHT: 7.4,
    TRUNK_RADIUS: 0.26,
    TRUNK_TAPER: 0.42,
    LEADER: { LENGTH: 1.9, TILT: 0.1, RADIUS_RATIO: 0.55 },
    LIMBS: { COUNT: 7, ANGLE_MIN: 0.18, ANGLE_MAX: 0.42, LENGTH_MIN: 1.5, LENGTH_MAX: 2.0, RADIUS: 0.085 },
    LEVELS: 3,
    SPLIT_MIN: 2,
    SPLIT_MAX: 3,
    ANGLE_STEP_MIN: 0.22,
    ANGLE_STEP_MAX: 0.44,
    LENGTH_RATIO_MIN: 0.5,
    LENGTH_RATIO_MAX: 0.64,
    RADIUS_RATIO: 0.56,
    TWIG_RADIUS: 0.018,
    TRUNK_SEGMENTS: 6,
    LIMB_SEGMENTS: 5,
    TWIG_SEGMENTS: 4
};

const SPREADING: SpeciesProfile = {
    // Wide: a short trunk that splits low, long limbs reaching out and up. Limb
    // lengths are authored to land inside TREE_PROFILE.CROWN_RADIUS, so no crown
    // ever has to be scaled down after the fact.
    TRUNK_HEIGHT: 4.6,
    TRUNK_RADIUS: 0.28,
    TRUNK_TAPER: 0.38,
    LEADER: { LENGTH: 1.6, TILT: 0.18, RADIUS_RATIO: 0.6 },
    LIMBS: { COUNT: 7, ANGLE_MIN: 0.58, ANGLE_MAX: 0.92, LENGTH_MIN: 1.5, LENGTH_MAX: 1.9, RADIUS: 0.095 },
    LEVELS: 3,
    SPLIT_MIN: 2,
    SPLIT_MAX: 3,
    ANGLE_STEP_MIN: 0.26,
    ANGLE_STEP_MAX: 0.48,
    LENGTH_RATIO_MIN: 0.5,
    LENGTH_RATIO_MAX: 0.62,
    RADIUS_RATIO: 0.56,
    TWIG_RADIUS: 0.018,
    TRUNK_SEGMENTS: 6,
    LIMB_SEGMENTS: 5,
    TWIG_SEGMENTS: 4
};

// Snow lies on the upper side of the thick limbs only: a white sleeve along the
// outer half of every primary limb, plus a share of the secondary ones. Twigs
// stay dark — that is what keeps a bare tree from turning back into a leafy one.
const SNOW_LOAD = {
    PRIMARY_SHARE: 1,
    SECONDARY_SHARE: 0.4,
    RADIUS_RATIO: 1.35,
    LENGTH_RATIO: 0.6,
    ALONG: 0.5,
    LIFT: 0.8
};

const TRUNK = {
    BASE_LIFT: 0.02,
    SNOW_MOUND: { TOP_RADIUS: 0.26, BOTTOM_RADIUS: 0.44, HEIGHT: 0.14, SEGMENTS: 7 },
    // Share of the trunk the lime wash covers; the plan measures the height.
    WHITEWASH_SEGMENTS: 6
};

// A limbed part in model space, before it is turned into geometry.
interface LimbPart {
    from: THREE.Vector3;
    direction: THREE.Vector3;
    length: number;
    radiusTop: number;
    radiusBottom: number;
    depth: number;
}

type TreeMaterialKey = 'bark' | 'rime' | 'snow' | 'whitewash' | 'soil';
type PartBuckets = Record<TreeMaterialKey, MergePart[]>;

const MATERIALS: Record<TreeMaterialKey, THREE.Material> = {
    bark: makePS1Material({ color: COLORS.TREE_BARK }),
    // Bare twigs read as a black mesh at this size, so the finest level carries
    // the rime texture: a frost-covered crown, not a silhouette of sticks.
    rime: makePS1Material({ map: textures.frostFoliage, color: COLORS.TREE_FROST }),
    snow: snowCapMat,
    whitewash: whitewashMat,
    soil: snowSoilMat
};

const MOUND_GEOMETRY = new THREE.CylinderGeometry(
    TRUNK.SNOW_MOUND.TOP_RADIUS,
    TRUNK.SNOW_MOUND.BOTTOM_RADIUS,
    TRUNK.SNOW_MOUND.HEIGHT,
    TRUNK.SNOW_MOUND.SEGMENTS
).toNonIndexed();

function emptyBuckets(): PartBuckets {
    return { bark: [], rime: [], snow: [], whitewash: [], soil: [] };
}

// Deterministic per-tree seed: the id decides the silhouette, so two reloads of
// the same plan give the same sixteen trees.
function seedFor(id: string): number {
    let hash = 0x811c9dc5;
    for (let index = 0; index < id.length; index++) {
        hash ^= id.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash;
}

// Tilt `direction` away from itself by `angle`, towards `azimuth` on the plane
// perpendicular to it. Keeps every branch a unit vector, so children never
// accumulate drift.
function tiltDirection(direction: THREE.Vector3, angle: number, azimuth: number): THREE.Vector3 {
    const reference = Math.abs(direction.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : UP;
    const tangent = new THREE.Vector3().crossVectors(direction, reference).normalize();
    const bitangent = new THREE.Vector3().crossVectors(direction, tangent).normalize();
    const sideways = tangent
        .multiplyScalar(Math.cos(azimuth))
        .add(bitangent.multiplyScalar(Math.sin(azimuth)));
    return direction
        .clone()
        .multiplyScalar(Math.cos(angle))
        .add(sideways.multiplyScalar(Math.sin(angle)))
        .normalize();
}

function grow(
    parts: LimbPart[],
    random: () => number,
    profile: SpeciesProfile,
    from: THREE.Vector3,
    direction: THREE.Vector3,
    length: number,
    radius: number,
    depth: number
): void {
    const taper = depth === 0 ? profile.TRUNK_TAPER : profile.RADIUS_RATIO + 0.1;
    parts.push({ from, direction, length, radiusTop: radius * (1 - taper), radiusBottom: radius, depth });
    if (depth >= profile.LEVELS) return;

    const tip = from.clone().addScaledVector(direction, length * 0.94);
    const children = profile.SPLIT_MIN + Math.floor(random() * (profile.SPLIT_MAX - profile.SPLIT_MIN + 1));
    const baseAzimuth = random() * Math.PI * 2;

    for (let index = 0; index < children; index++) {
        const angle = profile.ANGLE_STEP_MIN + random() * (profile.ANGLE_STEP_MAX - profile.ANGLE_STEP_MIN);
        const azimuth = baseAzimuth + (index / children) * Math.PI * 2 + (random() - 0.5) * 0.7;
        const childLength =
            length * (profile.LENGTH_RATIO_MIN + random() * (profile.LENGTH_RATIO_MAX - profile.LENGTH_RATIO_MIN));
        const childRadius = Math.max(radius * profile.RADIUS_RATIO, profile.TWIG_RADIUS);
        grow(
            parts,
            random,
            profile,
            tip,
            tiltDirection(direction, angle, azimuth),
            childLength,
            childRadius,
            depth + 1
        );
    }
}

// Trunk (lime-washed below, bark above), limbs and the leader that keeps a
// poplar's spire going.
function skeleton(type: WinterTreeType, random: () => number): LimbPart[] {
    const profile = type === 'poplar' ? POPLAR : SPREADING;
    const parts: LimbPart[] = [];
    const trunkRadius = profile.TRUNK_RADIUS;
    const whitewashTop = Math.min(TREE_PROFILE.WHITEWASH_HEIGHT, profile.TRUNK_HEIGHT * 0.6);
    const radiusAtSeam = trunkRadius * (1 - profile.TRUNK_TAPER * (whitewashTop / profile.TRUNK_HEIGHT));

    parts.push({
        from: new THREE.Vector3(0, TRUNK.BASE_LIFT, 0),
        direction: UP.clone(),
        length: whitewashTop,
        radiusTop: radiusAtSeam,
        radiusBottom: trunkRadius,
        depth: 0
    });
    parts.push({
        from: new THREE.Vector3(0, TRUNK.BASE_LIFT + whitewashTop, 0),
        direction: UP.clone(),
        length: profile.TRUNK_HEIGHT - whitewashTop,
        radiusTop: trunkRadius * (1 - profile.TRUNK_TAPER),
        radiusBottom: radiusAtSeam,
        depth: 0
    });

    const fork = new THREE.Vector3(0, TRUNK.BASE_LIFT + profile.TRUNK_HEIGHT, 0);
    const limbRadius = profile.LIMBS.RADIUS;

    for (let index = 0; index < profile.LIMBS.COUNT; index++) {
        const angle = profile.LIMBS.ANGLE_MIN + random() * (profile.LIMBS.ANGLE_MAX - profile.LIMBS.ANGLE_MIN);
        const azimuth = (index / profile.LIMBS.COUNT) * Math.PI * 2 + (random() - 0.5) * 0.4;
        const length = profile.LIMBS.LENGTH_MIN + random() * (profile.LIMBS.LENGTH_MAX - profile.LIMBS.LENGTH_MIN);
        // Limbs start a little below the tip, staggered: a crown that begins at a
        // single point reads as a rocket, not a tree.
        const origin = fork.clone().setY(fork.y - random() * profile.TRUNK_HEIGHT * 0.22);
        grow(parts, random, profile, origin, tiltDirection(UP.clone(), angle, azimuth), length, limbRadius, 1);
    }

    const leaderTilt = (random() - 0.5) * profile.LEADER.TILT * 2;
    grow(
        parts,
        random,
        profile,
        fork,
        tiltDirection(UP.clone(), Math.abs(leaderTilt), random() * Math.PI * 2),
        profile.LEADER.LENGTH,
        trunkRadius * profile.LEADER.RADIUS_RATIO,
        1
    );

    return parts;
}

// Horizontal reach of every part, so a crown can be fitted into the cap the plan
// reserved instead of the validator discovering the overshoot.
function crownRadiusOf(parts: LimbPart[]): number {
    let radius = 0;
    parts.forEach((part) => {
        const tip = part.from.clone().addScaledVector(part.direction, part.length);
        [part.from, tip].forEach((point) => {
            radius = Math.max(radius, Math.hypot(point.x, point.z));
        });
    });
    return radius;
}

function limbMatrix(part: LimbPart, scale: number): THREE.Matrix4 {
    const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, part.direction);
    const position = part.from.clone().addScaledVector(part.direction, part.length / 2).multiplyScalar(scale);
    return new THREE.Matrix4().compose(
        position,
        quaternion,
        new THREE.Vector3(scale, scale, scale)
    );
}

function materialKeyFor(part: LimbPart): TreeMaterialKey {
    if (part.depth >= 3) return 'rime';
    if (part.depth === 2 && part.radiusBottom < 0.032) return 'rime';
    return 'bark';
}

function segmentsFor(part: LimbPart, profile: SpeciesProfile): number {
    if (part.depth === 0) return profile.TRUNK_SEGMENTS;
    if (part.depth === 1) return profile.LIMB_SEGMENTS;
    return profile.TWIG_SEGMENTS;
}

function pushLimb(buckets: PartBuckets, part: LimbPart, profile: SpeciesProfile, scale: number, keyOrigin: 'auto' | 'whitewash'): void {
    const key = keyOrigin === 'auto' ? materialKeyFor(part) : keyOrigin;
    buckets[key].push({
        geometry: new THREE.CylinderGeometry(
            Math.max(part.radiusTop, 0.008),
            Math.max(part.radiusBottom, 0.01),
            part.length,
            segmentsFor(part, profile),
            1,
            true
        ),
        matrix: limbMatrix(part, scale)
    });
}

function addTree(buckets: PartBuckets, object: ObjectDescriptor): void {
    const parameters = object.parameters;
    const type: WinterTreeType = parameters.type === 'poplar' ? 'poplar' : 'spreading';
    const profile = type === 'poplar' ? POPLAR : SPREADING;
    const random = createSeededRandom(seedFor(object.id));
    const parts = skeleton(type, random);

    // Fit inside the reserved crown, then bake the instance transform into every
    // part: a rotated, scaled tree costs no extra draw call.
    const fit = Math.min(1, (TREE_PROFILE.CROWN_RADIUS * 0.98) / Math.max(crownRadiusOf(parts), 1e-6));
    const instance = new THREE.Matrix4().compose(
        new THREE.Vector3(object.transform.x, object.transform.y, object.transform.z),
        new THREE.Quaternion().setFromAxisAngle(UP, parameters.rotation || 0),
        new THREE.Vector3(parameters.scale, parameters.scale, parameters.scale)
    );

    const before: PartBuckets = emptyBuckets();
    // The skeleton starts with the lime-washed bottom of the trunk; everything
    // else takes its material from its own depth.
    parts.forEach((part, index) => {
        pushLimb(before, part, profile, fit, index === 0 ? 'whitewash' : 'auto');
    });

    // Snow load: a white sleeve on the upper side of the thick limbs.
    parts.forEach((part) => {
        const share = part.depth === 1 ? SNOW_LOAD.PRIMARY_SHARE : part.depth === 2 ? SNOW_LOAD.SECONDARY_SHARE : 0;
        if (share === 0 || random() > share) return;
        const snowRadius = Math.max(part.radiusBottom * SNOW_LOAD.RADIUS_RATIO, 0.03);
        before.snow.push({
            geometry: new THREE.CylinderGeometry(snowRadius * 0.7, snowRadius, part.length * SNOW_LOAD.LENGTH_RATIO, 4, 1, true),
            matrix: new THREE.Matrix4().compose(
                part.from
                    .clone()
                    .addScaledVector(part.direction, part.length * SNOW_LOAD.ALONG)
                    .add(new THREE.Vector3(0, snowRadius * SNOW_LOAD.LIFT, 0))
                    .multiplyScalar(fit),
                new THREE.Quaternion().setFromUnitVectors(UP, part.direction),
                new THREE.Vector3(fit, fit, fit)
            )
        });
    });

    // Snow mound at the foot of the trunk.
    before.snow.push({ geometry: MOUND_GEOMETRY, matrix: limbMatrix({ from: new THREE.Vector3(0, 0, 0), direction: UP.clone(), length: TRUNK.SNOW_MOUND.HEIGHT, radiusTop: 0, radiusBottom: 0, depth: 0 }, fit) });

    (Object.keys(before) as TreeMaterialKey[]).forEach((key) => {
        before[key].forEach((part) => {
            buckets[key].push({ geometry: part.geometry, matrix: instance.clone().multiply(part.matrix!) });
        });
    });
}

// Snow-covered shrub clumps: a dark frozen body, a thinner white cap and a few
// bare twigs, so a clump reads as a bush and not as a box.
const SHRUB = {
    BODY_RATIO: 0.62,
    CAP_RATIO: 0.36,
    // The cap starts exactly on the body top: a floating white plate over a dark
    // box reads as two objects, and the clump loses its silhouette.
    CAP_Y_RATIO: 0.62,
    LIFT: 0.05,
    CAP_OVERHANG: 0.03,
    TWIGS: 5,
    TWIG_HEIGHT: 0.34,
    TWIG_RADIUS: 0.016,
    TILE: 1.2
};

function addShrubs(buckets: PartBuckets, layout: Layout): void {
    const shrubs = objectsOfType(layout, 'shrub');
    if (shrubs.length === 0) return;

    const body = createQuadBuilder();
    const cap = createQuadBuilder();
    const twigs = createQuadBuilder();

    shrubs.forEach((object) => {
        const { x, z } = object.transform;
        const parameters = object.parameters;
        const width: number = parameters.width;
        const height: number = parameters.height;
        const depth: number = parameters.depth;
        const place = placeAt(x, z, object.transform.rotY);
        const bodyHeight = height * SHRUB.BODY_RATIO;

        addBox(
            body,
            place,
            {
                minX: -width / 2,
                maxX: width / 2,
                minY: SHRUB.LIFT,
                maxY: SHRUB.LIFT + bodyHeight,
                minZ: -depth / 2,
                maxZ: depth / 2
            },
            SHRUB.TILE
        );

        const capHeight = height * SHRUB.CAP_RATIO;
        const capY = SHRUB.LIFT + height * SHRUB.CAP_Y_RATIO;
        addBox(
            cap,
            place,
            {
                minX: -width / 2 - SHRUB.CAP_OVERHANG,
                maxX: width / 2 + SHRUB.CAP_OVERHANG,
                minY: capY,
                maxY: capY + capHeight,
                minZ: -depth / 2 - SHRUB.CAP_OVERHANG,
                maxZ: depth / 2 + SHRUB.CAP_OVERHANG
            },
            SHRUB.TILE
        );

        // Twigs break the box silhouette the way the branch skeleton breaks it on
        // a tree; they are the only part of a clump that reaches into the air.
        const random = createSeededRandom(seedFor(object.id));
        for (let index = 0; index < SHRUB.TWIGS; index++) {
            const twigX = (random() - 0.5) * width * 0.8;
            const twigZ = (random() - 0.5) * depth * 0.8;
            const tiltX = (random() - 0.5) * 0.5;
            const tiltZ = (random() - 0.5) * 0.5;
            const base = capY + capHeight * 0.4;
            const top = base + SHRUB.TWIG_HEIGHT;
            const half = SHRUB.TWIG_RADIUS / 2;
            twigs.addQuad(
                [
                    [twigX - half, base, twigZ],
                    [twigX + half, base, twigZ],
                    [twigX + half + tiltX, top, twigZ + tiltZ],
                    [twigX - half + tiltX, top, twigZ + tiltZ]
                ],
                [0, 0, 1],
                [
                    [0, 0],
                    [1, 0],
                    [1, 1],
                    [0, 1]
                ]
            );
            twigs.addQuad(
                [
                    [twigX, base, twigZ - half],
                    [twigX, base, twigZ + half],
                    [twigX + tiltX, top, twigZ + half + tiltZ],
                    [twigX + tiltX, top, twigZ - half + tiltZ]
                ],
                [1, 0, 0],
                [
                    [0, 0],
                    [1, 0],
                    [1, 1],
                    [0, 1]
                ]
            );
        }
    });

    // The body quads are laid in world space already, so they merge as they are.
    buckets.soil.push({ geometry: body.build() });
    buckets.snow.push({ geometry: cap.build() });
    buckets.rime.push({ geometry: twigs.build() });
}

export function buildTrees(group: THREE.Group, collision: CollisionWorld, layout: Layout): void {
    const trees = objectsOfType(layout, 'winter-tree');
    const buckets = emptyBuckets();

    trees.forEach((object) => addTree(buckets, object));
    addShrubs(buckets, layout);

    (Object.keys(buckets) as TreeMaterialKey[]).forEach((key) => {
        if (buckets[key].length === 0) return;
        group.add(new THREE.Mesh(mergeGeometries(buckets[key]), MATERIALS[key]));
    });

    trees.forEach((object) => registerColliders(collision, object));
}
