// Debug view of the plan (TZ §11). Debug-only: never participates in collision,
// never adds to the acceptance geometry. Two views share one source of truth —
// a 2D top-down drawing (1 px = 1/scale unit) and a thin 3D overlay.
import { COLORS } from '../config/colors.js';
import { SURFACE } from '../config/world.js';
import { transformPoint, type ObjectTransform } from './layout/footprints.js';
import { INTERIOR } from './interiors/interiorProfile.js';
import type { InteriorDescriptor } from './interiors/interiorSelection.js';
import type { Rect } from './layout/rect.js';
import type { BuiltLayout, Layout } from './layout/createLayout.js';
import type { Validation } from './layout/validateLayout.js';
import * as THREE from 'three';

const PALETTE = {
    asphalt: '#23272b',
    sidewalk: '#43484e',
    pedestrian: '#6f7d8a',
    paving: '#343a40',
    crossing: '#95a2ae',
    zone: '#8a7a3a',
    physical: '#c2554f',
    visual: '#c2a04f',
    route: '#7fd0c0',
    spawn: '#d8dfe4',
    text: '#aeb6bd',
    // Interiors: the stair core, the accessible flats and the doorway they are
    // entered through. Debug only, like everything on this drawing.
    interiorCore: '#4f8f86',
    interiorFlat: '#7fd0c0',
    interiorDoor: '#c07f4f'
};

const ZONE_COLORS = {
    PLAY: '#3f6b48',
    TP_YARD: '#6b5a2f',
    KIOSK_APRON: '#5a3f6b'
};

function fillRect(context: CanvasRenderingContext2D, rect: Rect, color: string, scale: number, half: number): void {
    context.fillStyle = color;
    context.fillRect(
        (rect.minX + half) * scale,
        (rect.minZ + half) * scale,
        (rect.maxX - rect.minX) * scale,
        (rect.maxZ - rect.minZ) * scale
    );
}

function strokeRect(context: CanvasRenderingContext2D, rect: Rect, color: string, scale: number, half: number, width = 1): void {
    context.strokeStyle = color;
    context.lineWidth = width;
    context.strokeRect(
        (rect.minX + half) * scale,
        (rect.minZ + half) * scale,
        (rect.maxX - rect.minX) * scale,
        (rect.maxZ - rect.minZ) * scale
    );
}

function drawMasks(context: CanvasRenderingContext2D, built: BuiltLayout, scale: number): void {
    const { layout, masks, grid } = built;
    const half = layout.world.half;

    fillRect(context, { minX: -half, minZ: -half, maxX: half, maxZ: half }, '#101214', scale, half);
    grid.forEachCell(masks.sidewalk, (rect) => fillRect(context, rect, PALETTE.sidewalk, scale, half));
    grid.forEachCell(masks.paving, (rect) => fillRect(context, rect, PALETTE.paving, scale, half));
    grid.forEachCell(masks.asphalt, (rect) => fillRect(context, rect, PALETTE.asphalt, scale, half));
    grid.forEachCell(masks.pedestrian, (rect) => fillRect(context, rect, PALETTE.pedestrian, scale, half));
    grid.forEachCell(masks.crossing, (rect) => fillRect(context, rect, PALETTE.crossing, scale, half));
}

function drawZones(context: CanvasRenderingContext2D, layout: Layout, scale: number): void {
    const half = layout.world.half;
    layout.zones.forEach((zone) => {
        const zoneColor = ZONE_COLORS[zone.id as keyof typeof ZONE_COLORS] || PALETTE.zone;
        context.setLineDash([3, 2]);
        strokeRect(context, zone.rect, zoneColor, scale, half, 1);
        context.setLineDash([]);
        context.fillStyle = zoneColor;
        context.font = '7px monospace';
        context.fillText(zone.id, (zone.rect.minX + half) * scale + 2, (zone.rect.minZ + half) * scale + 8);
    });
}

function drawFootprints(context: CanvasRenderingContext2D, layout: Layout, scale: number): void {
    const half = layout.world.half;
    layout.objects.forEach((object) => {
        object.worldFootprints.forEach((footprint) => strokeRect(context, footprint, PALETTE.physical, scale, half));
        if (object.worldVisualFootprint) {
            context.setLineDash([2, 2]);
            strokeRect(context, object.worldVisualFootprint, PALETTE.visual, scale, half);
            context.setLineDash([]);
        }
    });
}

function drawRoutes(context: CanvasRenderingContext2D, layout: Layout, scale: number): void {
    const half = layout.world.half;
    context.strokeStyle = PALETTE.route;
    context.lineWidth = 1;
    layout.mechRoute.routes.forEach((route) => {
        context.beginPath();
        route.points.forEach((point, index) => {
            const px = (point.x + half) * scale;
            const pz = (point.z + half) * scale;
            if (index === 0) context.moveTo(px, pz);
            else context.lineTo(px, pz);
        });
        context.stroke();
    });

    const spawn = layout.spawn;
    context.strokeStyle = PALETTE.spawn;
    context.beginPath();
    context.arc((spawn.x + half) * scale, (spawn.z + half) * scale, spawn.radius * scale, 0, Math.PI * 2);
    context.stroke();
}

function drawNodes(context: CanvasRenderingContext2D, layout: Layout, scale: number): void {
    const half = layout.world.half;
    context.fillStyle = PALETTE.text;
    context.font = '7px monospace';
    layout.roadGraph.nodes.forEach((node) => {
        const px = (node.x + half) * scale;
        const pz = (node.z + half) * scale;
        context.fillRect(px - 1, pz - 1, 2, 2);
        context.fillText(node.id, px + 3, pz - 2);
    });
    layout.roadGraph.edges.forEach((edge) => {
        const midX = (edge.strip.minX + edge.strip.maxX) / 2;
        const midZ = (edge.strip.minZ + edge.strip.maxZ) / 2;
        context.fillText(`${edge.kind[0]}${edge.width}`, (midX + half) * scale, (midZ + half) * scale);
    });
}

// Interiors of the opened porches: the stair core, the accessible flats and the
// doorway they are reached through. Every rectangle is a local plan rect pushed
// through the block transform, so the drawing cannot disagree with the plan.
function localRectToWorld(transform: ObjectTransform, minX: number, minZ: number, maxX: number, maxZ: number): Rect {
    const corners = [
        transformPoint(transform, minX, minZ),
        transformPoint(transform, maxX, minZ),
        transformPoint(transform, maxX, maxZ),
        transformPoint(transform, minX, maxZ)
    ];
    return {
        minX: Math.min(...corners.map((corner) => corner.x)),
        maxX: Math.max(...corners.map((corner) => corner.x)),
        minZ: Math.min(...corners.map((corner) => corner.z)),
        maxZ: Math.max(...corners.map((corner) => corner.z))
    };
}

function drawInteriors(context: CanvasRenderingContext2D, layout: Layout, scale: number): void {
    const half = layout.world.half;

    layout.objects.forEach((object) => {
        const interior = object.parameters.interior as InteriorDescriptor | null | undefined;
        if (!interior) return;
        const transform = object.transform;

        const core = localRectToWorld(
            transform,
            interior.porchX - INTERIOR.CORE.HALF,
            INTERIOR.INNER_BACK,
            interior.porchX + INTERIOR.CORE.HALF,
            INTERIOR.FACADE_Z
        );
        fillRect(context, core, 'rgba(79,143,134,0.35)', scale, half);
        strokeRect(context, core, PALETTE.interiorCore, scale, half);

        interior.flats.forEach((flat) => {
            const rect = localRectToWorld(transform, flat.x0, INTERIOR.INNER_BACK, flat.x1, INTERIOR.INNER_FRONT);
            fillRect(context, rect, 'rgba(127,208,192,0.28)', scale, half);
            strokeRect(context, rect, PALETTE.interiorFlat, scale, half);
        });

        const door = localRectToWorld(
            transform,
            interior.porchX - INTERIOR.PORCH_DOOR.WIDTH / 2,
            INTERIOR.FACADE_Z - 0.1,
            interior.porchX + INTERIOR.PORCH_DOOR.WIDTH / 2,
            INTERIOR.FACADE_Z + 0.1
        );
        strokeRect(context, door, PALETTE.interiorDoor, scale, half, 2);
    });
}

function drawPlan(context: CanvasRenderingContext2D, built: BuiltLayout, scale = 4): void {
    const { layout } = built;
    const size = layout.world.size * scale;

    context.clearRect(0, 0, size, size);
    drawMasks(context, built, scale);
    drawZones(context, layout, scale);
    drawRoutes(context, layout, scale);
    drawFootprints(context, layout, scale);
    drawInteriors(context, layout, scale);
    drawNodes(context, layout, scale);

    context.strokeStyle = '#000';
    context.lineWidth = 1;
    context.strokeRect(0.5, 0.5, size - 1, size - 1);
}

function createPlanCanvas(built: BuiltLayout, scale = 4): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = built.layout.world.size * scale;
    canvas.height = built.layout.world.size * scale;
    canvas.className = 'plan-canvas';
    const context = canvas.getContext('2d');
    if (context) drawPlan(context, built, scale);
    return canvas;
}

// Thin 3D overlay: road centrelines, node pads and the spawn circle, drawn a few
// centimetres above the pavement with depth testing off.
export function createLayoutOverlay(layout: Layout): THREE.Group {
    const group = new THREE.Group();
    group.name = 'layout-overlay';

    const routeMaterial = new THREE.MeshBasicMaterial({
        color: 0x7fd0c0,
        transparent: true,
        opacity: 0.55,
        depthTest: false
    });
    const nodeMaterial = new THREE.MeshBasicMaterial({
        color: 0xd8dfe4,
        transparent: true,
        opacity: 0.7,
        depthTest: false
    });

    const y = SURFACE.CURB_TOP + 0.02;

    layout.roadGraph.edges.forEach((edge) => {
        const alongX = edge.axis === 'x';
        const width = alongX ? edge.length : 0.12;
        const depth = alongX ? 0.12 : edge.length;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.02, depth), routeMaterial);
        mesh.position.set((edge.strip.minX + edge.strip.maxX) / 2, y, (edge.strip.minZ + edge.strip.maxZ) / 2);
        group.add(mesh);
    });

    layout.roadGraph.nodes.forEach((node) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.6), nodeMaterial);
        mesh.position.set(node.x, y, node.z);
        group.add(mesh);
    });

    const spawnRing = new THREE.Mesh(
        new THREE.RingGeometry(layout.spawn.radius - 0.12, layout.spawn.radius, 32),
        new THREE.MeshBasicMaterial({ color: COLORS.MECH_HULL, transparent: true, opacity: 0.5, depthTest: false })
    );
    spawnRing.rotation.x = -Math.PI / 2;
    spawnRing.position.set(layout.spawn.x, y, layout.spawn.z);
    group.add(spawnRing);

    group.traverse((entry) => {
        entry.renderOrder = 5;
    });
    return group;
}

function formatValidation(validation: Validation): string {
    const lines: string[] = [];
    const failed = validation.checks.filter((check) => !check.passed);
    lines.push(`layout ${validation.ok ? 'OK' : 'REJECTED'} — ${validation.checks.length} checks, ${failed.length} failed`);
    failed.forEach((check) => lines.push(`  ${check.id}: ${check.detail}`));
    return lines.join('\n');
}

function formatMeasurements(validation: Validation, layout: Layout): string {
    const measurements = validation.measurements;
    const interiors = layout.objects
        .map((object) => ({ id: object.id, interior: object.parameters.interior as InteriorDescriptor | null | undefined }))
        .filter((entry) => entry.interior)
        .map((entry) => `${entry.id} ${entry.interior!.mode} (эт. ${entry.interior!.levels.map((level) => level + 1).join(', ')})`);
    return [
        `seed ${layout.seed}, generator ${layout.generatorVersion}, hash ${layout.configHash}`,
        `mech radius ${validation.mechRadius} (solid silhouettes, 16 phases)`,
        `asphalt ${measurements.asphaltArea} m², sidewalk ${measurements.sidewalkArea} m², pedestrian ${measurements.pedestrianArea} m²`,
        `curbs ${layout.maskSummary.curbLength} m in ${layout.curbs.length} segments`,
        interiors.length > 0 ? `interiors ${interiors.join(' | ')}` : 'interiors none'
    ].join('\n');
}

// Fixed side panel with the plan drawing and the report text. Also used as the
// hard-error overlay (the caller passes `errorsOnly`).
export function mountDebugPanel(built: BuiltLayout): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'plan-panel';

    const title = document.createElement('div');
    title.className = 'plan-title';
    title.textContent = 'LAYOUT PLAN';
    panel.appendChild(title);
    panel.appendChild(createPlanCanvas(built));

    const report = document.createElement('pre');
    report.className = 'plan-report';
    report.textContent = `${formatValidation(built.validation)}\n${formatMeasurements(built.validation, built.layout)}`;
    panel.appendChild(report);

    document.body.appendChild(panel);
    return panel;
}

export function mountErrorOverlay(validation: Validation): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.className = 'layout-error';

    const title = document.createElement('div');
    title.textContent = 'LAYOUT REJECTED — NO GEOMETRY BUILT';
    overlay.appendChild(title);

    const list = document.createElement('pre');
    list.textContent = validation.errors.join('\n');
    overlay.appendChild(list);

    document.body.appendChild(overlay);
    return overlay;
}
