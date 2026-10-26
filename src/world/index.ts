// Composition root of the diorama: builds every world module into one group.
// The plan is validated before this runs, so each builder reads its placement
// from the frozen layout instead of inventing coordinates of its own.
import { buildCourtyardDetails } from './courtyardDetails.js';
import { buildCourtyardProps } from './courtyardProps.js';
import { createLayoutOverlay } from './debugLayout.js';
import { buildDioramaBase } from './dioramaBase.js';
import { buildFbsBlocks } from './fbsBlocks.js';
import { buildFence } from './fence.js';
import { buildHeatingPipeline } from './heatingPipeline.js';
import { createInteriorInstances, type InteriorInstance } from './interiors/index.js';
import { buildKhrushchyovkaDistrict } from './khrushchyovka.js';
import { buildKiosk } from './kiosk.js';
import { buildLawnFences } from './lawnFence.js';
import { buildPlayground } from './playground.js';
import { buildRoadDetail } from './roadDetail.js';
import { buildRoadFurniture } from './roadFurniture.js';
import { buildRoads } from './roads.js';
import { buildSlabYards } from './slabYard.js';
import { buildSnowCover, buildSnowPatches } from './snowPatches.js';
import { buildStreetLamps } from './streetLamps.js';
import { buildTransformerYard } from './transformerYard.js';
import { buildTrees } from './trees.js';
import { buildUtilityPoles } from './utilityPoles.js';
import type { Group } from 'three';
import type { CollisionWorld } from '../systems/collision.js';
import type { Layout, Masks } from './layout/createLayout.js';
import type { MaskGrid } from './layout/maskGrid.js';
import type { SurfaceField } from './surfaceField.js';

export function buildWorld({
    group,
    collision,
    layout,
    masks,
    grid,
    surface,
    debug = false
}: {
    group: Group;
    collision: CollisionWorld;
    layout: Layout;
    masks: Masks;
    grid: MaskGrid;
    surface: SurfaceField;
    debug?: boolean;
}): { interiors: InteriorInstance[] } {
    // Interior plans are derived from the layout descriptors once, before any
    // geometry: the same objects feed the meshes below and the runtime.
    const interiors = createInteriorInstances(layout);

    buildDioramaBase(group, surface);
    buildRoads(group, { layout, masks, grid });
    buildKhrushchyovkaDistrict(group, collision, layout, interiors);
    buildPlayground(group, collision, layout);
    buildTransformerYard(group, collision, layout);
    buildKiosk(group, collision, layout);
    buildFence(group, collision, layout);
    buildLawnFences(group, collision, layout);
    buildTrees(group, collision, layout);
    buildUtilityPoles(group, collision, layout);
    buildHeatingPipeline(group, collision, layout);
    buildFbsBlocks(group, collision, layout);
    buildCourtyardProps(group, collision, layout);
    buildCourtyardDetails(group, collision, layout);

    // Winter dressing and road furniture: flat decor with no collider, placed
    // last so it reads on top of every surface plate.
    buildSlabYards(group, layout);
    buildRoadDetail(group, { layout, masks, grid });
    buildRoadFurniture(group, layout);
    buildSnowCover(group, layout, surface);
    buildSnowPatches(group, layout, surface);
    // Practicals last: they hang over the props and their pools are additive
    // overlays that must draw on top of every surface layer.
    buildStreetLamps(group, surface);

    if (debug) group.add(createLayoutOverlay(layout));
    return { interiors };
}
