// Orthogonal road graph of the fixed plan (TZ §6.3). Every surface downstream —
// carriageway strips, ring corner pads, sidewalk shells — is derived from these
// nodes and edges, and the graph re-checks the invariants the spec states.
import { ROAD } from '../../config/layout.js';
import { createRect, expandRect, rectFromCenter, type PointXZ, type Rect } from './rect.js';

export type RoadKind = keyof typeof ROAD.KINDS;

export interface RoadNode {
    id: string;
    x: number;
    z: number;
    degree: number;
}

export interface RoadEdge {
    id: string;
    a: string;
    b: string;
    kind: RoadKind;
    width: number;
    sidewalk: number;
    axis: 'x' | 'z';
    length: number;
    strip: Rect;
    centerline: PointXZ[];
}

export interface RoadPad {
    nodeId: string;
    width: number;
    rect: Rect;
}

export interface RoadGraph {
    nodes: RoadNode[];
    edges: RoadEdge[];
    nodeById: Map<string, RoadNode>;
    pads: RoadPad[];
    asphaltRects: Rect[];
    sidewalkShells: Rect[];
    components: number;
    cycles: number;
    axisLength: number;
    expectedAsphaltArea: number;
    errors: string[];
}

const EXPECTED = {
    NODES: 8,
    EDGES: 9,
    COMPONENTS: 1,
    CYCLES: 2,
    AXIS_LENGTH: 416,
    // Courtyard ring turns get an explicit 5.5 x 5.5 pad. The T-junctions B/C are
    // already fully covered by the street carriageway, so a pad there would not
    // change the union — and the spec's 2278.75 m² assumes exactly four pads.
    PAD_NODES: ['L', 'R', 'S', 'T'],
    // Degree-1 ends are allowed only at the two cut-away portals of the street.
    TERMINAL_NODES: ['A', 'D']
};

function createNodeIndex(nodes: RoadNode[]): Map<string, RoadNode> {
    return new Map(nodes.map((node): [string, RoadNode] => [node.id, node]));
}

function countComponents(nodes: RoadNode[], edges: RoadEdge[]): number {
    const parents = new Map(nodes.map((node): [string, string] => [node.id, node.id]));

    const find = (id: string): string => {
        let root = id;
        while (parents.get(root) !== root) root = parents.get(root) as string;
        return root;
    };

    edges.forEach((edge) => {
        const rootA = find(edge.a);
        const rootB = find(edge.b);
        if (rootA !== rootB) parents.set(rootA, rootB);
    });

    const roots = new Set(nodes.map((node) => find(node.id)));
    return roots.size;
}

export function createRoadGraph(): RoadGraph {
    const errors: string[] = [];
    const nodeIds = Object.keys(ROAD.NODES) as Array<keyof typeof ROAD.NODES>;
    const nodes: RoadNode[] = nodeIds.map((id) => ({
        id,
        x: ROAD.NODES[id][0],
        z: ROAD.NODES[id][1],
        degree: 0
    }));
    const nodeById = createNodeIndex(nodes);

    const edges: RoadEdge[] = [];
    ROAD.EDGES.forEach(([a, b, kind]) => {
        const spec = ROAD.KINDS[kind];
        const from = nodeById.get(a);
        const to = nodeById.get(b);
        if (!from || !to || !spec) {
            errors.push(`ROAD_GRAPH: edge ${a}-${b} references an unknown node or kind`);
            return;
        }

        const horizontal = Math.abs(from.z - to.z) < 1e-9;
        const vertical = Math.abs(from.x - to.x) < 1e-9;
        if (horizontal === vertical) {
            errors.push(`ROAD_GRAPH: edge ${a}-${b} is not a non-degenerate axis-aligned segment`);
            return;
        }

        const half = spec.width / 2;
        const strip = horizontal
            ? createRect(
                  Math.min(from.x, to.x),
                  from.z - half,
                  Math.max(from.x, to.x),
                  from.z + half
              )
            : createRect(
                  from.x - half,
                  Math.min(from.z, to.z),
                  from.x + half,
                  Math.max(from.z, to.z)
              );

        edges.push({
            id: `${a}-${b}`,
            a,
            b,
            kind,
            width: spec.width,
            sidewalk: spec.sidewalk,
            axis: horizontal ? 'x' : 'z',
            length: horizontal ? Math.abs(to.x - from.x) : Math.abs(to.z - from.z),
            strip,
            centerline: [
                { x: from.x, z: from.z },
                { x: to.x, z: to.z }
            ]
        });
    });

    edges.forEach((edge) => {
        nodeById.get(edge.a)!.degree += 1;
        nodeById.get(edge.b)!.degree += 1;
    });

    const seenPairs = new Set<string>();
    edges.forEach((edge) => {
        const key = [edge.a, edge.b].sort().join('-');
        if (seenPairs.has(key)) errors.push(`ROAD_GRAPH: duplicate edge ${key}`);
        seenPairs.add(key);
    });

    const pads: RoadPad[] = EXPECTED.PAD_NODES.map((nodeId) => {
        const node = nodeById.get(nodeId)!;
        const connected = edges.filter((edge) => edge.a === nodeId || edge.b === nodeId);
        const width = connected.reduce((max, edge) => Math.max(max, edge.width), 0);
        return {
            nodeId,
            width,
            rect: rectFromCenter(node.x, node.z, width, width)
        };
    });

    const components = countComponents(nodes, edges);
    const cycles = edges.length - nodes.length + components;
    const axisLength = edges.reduce((sum, edge) => sum + edge.length, 0);

    if (nodes.length !== EXPECTED.NODES) {
        errors.push(`ROAD_GRAPH: expected ${EXPECTED.NODES} nodes, got ${nodes.length}`);
    }
    if (edges.length !== EXPECTED.EDGES) {
        errors.push(`ROAD_GRAPH: expected ${EXPECTED.EDGES} edges, got ${edges.length}`);
    }
    if (components !== EXPECTED.COMPONENTS) {
        errors.push(`ROAD_GRAPH: expected ${EXPECTED.COMPONENTS} component(s), got ${components}`);
    }
    if (cycles !== EXPECTED.CYCLES) {
        errors.push(`ROAD_GRAPH: expected ${EXPECTED.CYCLES} independent cycles, got ${cycles}`);
    }
    if (Math.abs(axisLength - EXPECTED.AXIS_LENGTH) > 1e-6) {
        errors.push(`ROAD_GRAPH: expected total axis length ${EXPECTED.AXIS_LENGTH}, got ${axisLength}`);
    }
    nodes.forEach((node) => {
        if (node.degree === 0) {
            errors.push(`ROAD_GRAPH: node ${node.id} is isolated`);
        } else if (node.degree === 1 && !EXPECTED.TERMINAL_NODES.includes(node.id)) {
            errors.push(`ROAD_GRAPH: node ${node.id} is an unplanned dead end`);
        }
    });

    const asphaltRects: Rect[] = [...edges.map((edge) => edge.strip), ...pads.map((pad) => pad.rect)];
    const sidewalkShells: Rect[] = [
        ...edges.map((edge) => expandRect(edge.strip, edge.sidewalk)),
        // Corner frame: fills the 1.5 x 1.5 notches the per-edge shells leave at
        // the four ring turns, so the pavement is continuous around the corner.
        ...pads.map((pad) => expandRect(pad.rect, ROAD.KINDS.courtyard.sidewalk))
    ];

    return {
        nodes,
        edges,
        nodeById,
        pads,
        asphaltRects,
        sidewalkShells,
        components,
        cycles,
        axisLength,
        expectedAsphaltArea: 2278.75,
        errors
    };
}
