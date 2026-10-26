// Axis-aligned rectangle helpers in the XZ plane. Everything the planner reasons
// about (roads, masks, footprints, reservations) is expressed with these.
export interface Rect {
    minX: number;
    minZ: number;
    maxX: number;
    maxZ: number;
}

export interface PointXZ {
    x: number;
    z: number;
}

export function createRect(minX: number, minZ: number, maxX: number, maxZ: number): Rect {
    return {
        minX: Math.min(minX, maxX),
        minZ: Math.min(minZ, maxZ),
        maxX: Math.max(minX, maxX),
        maxZ: Math.max(minZ, maxZ)
    };
}

export function rectFromCenter(cx: number, cz: number, width: number, depth: number): Rect {
    return createRect(cx - width / 2, cz - depth / 2, cx + width / 2, cz + depth / 2);
}

export function expandRect(rect: Rect, amount: number): Rect {
    return {
        minX: rect.minX - amount,
        minZ: rect.minZ - amount,
        maxX: rect.maxX + amount,
        maxZ: rect.maxZ + amount
    };
}

export function rectWidth(rect: Rect): number {
    return rect.maxX - rect.minX;
}

export function rectDepth(rect: Rect): number {
    return rect.maxZ - rect.minZ;
}

// Euclid distance between two AABB in XZ (0 when they touch or overlap).
export function rectDistance(a: Rect, b: Rect): number {
    const dx = Math.max(a.minX - b.maxX, b.minX - a.maxX, 0);
    const dz = Math.max(a.minZ - b.maxZ, b.minZ - a.maxZ, 0);
    return Math.hypot(dx, dz);
}

export function pointRectDistance(x: number, z: number, rect: Rect): number {
    const dx = Math.max(rect.minX - x, 0, x - rect.maxX);
    const dz = Math.max(rect.minZ - z, 0, z - rect.maxZ);
    return Math.hypot(dx, dz);
}
