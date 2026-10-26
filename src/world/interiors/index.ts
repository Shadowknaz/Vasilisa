// Composition of the interior layer: which block owns which plan, the meshes of
// those plans under the block's group, and the frame conversion the runtime needs
// to move a pilot between building-local metres and world metres.
//
// The layout stays the source of truth: an instance is created from the interior
// descriptor the planner already validated, and the plan is derived from it once —
// geometry, colliders and the walk of one porch all read the same object.
import { addInteriorLeaves, addInteriorToShell, createInteriorShell, flushInteriorShell } from './interiorGeometry.js';
import { interiorPlanFor, type InteriorDescriptor } from './interiorSelection.js';
import { objectsOfType } from '../placement.js';
import type { Layout } from '../layout/createLayout.js';
import type { ObjectDescriptor, ObjectTransform } from '../layout/footprints.js';
import type { StairPlan } from './stairwell.js';
import * as THREE from 'three';

export interface InteriorInstance {
    id: string;
    buildingId: string;
    descriptor: InteriorDescriptor;
    plan: StairPlan;
    transform: ObjectTransform;
    cos: number;
    sin: number;
}

// TZ convention of the plan (footprints.transformPoint): +X local is the block's
// right flank, +Z local faces the courtyard.
export function localToWorld(instance: InteriorInstance, x: number, z: number): { x: number; z: number } {
    return {
        x: instance.transform.x + x * instance.cos + z * instance.sin,
        z: instance.transform.z - x * instance.sin + z * instance.cos
    };
}

export function worldToLocal(instance: InteriorInstance, x: number, z: number): { x: number; z: number } {
    const dx = x - instance.transform.x;
    const dz = z - instance.transform.z;
    return {
        x: dx * instance.cos - dz * instance.sin,
        z: dx * instance.sin + dz * instance.cos
    };
}

export function createInteriorInstances(layout: Layout): InteriorInstance[] {
    const instances: InteriorInstance[] = [];
    objectsOfType(layout, 'khrushchyovka').forEach((object: ObjectDescriptor) => {
        const descriptor = object.parameters.interior as InteriorDescriptor | null | undefined;
        if (!descriptor || !descriptor.enabled) return;
        instances.push({
            id: `${object.id}-${descriptor.porchIndex}-I`,
            buildingId: object.id,
            descriptor,
            plan: interiorPlanFor(descriptor),
            transform: object.transform,
            cos: Math.cos(object.transform.rotY),
            sin: Math.sin(object.transform.rotY)
        });
    });
    return instances;
}

// Builds every interior of one block into its building group. The group already
// carries the block transform, so the plan is added in local metres. Nothing of
// this layer writes text into the frame: the district has no interface.
export function buildBuildingInteriors(group: THREE.Group, instances: InteriorInstance[]): number {
    if (instances.length === 0) return 0;
    const shell = createInteriorShell();
    instances.forEach((instance) => {
        addInteriorToShell(shell, instance.plan);
        addInteriorLeaves(instance.plan, group);
    });
    return flushInteriorShell(shell, group, instances[0].buildingId);
}

export type { InteriorDescriptor } from './interiorSelection.js';
export type { StairPlan } from './stairwell.js';
