// Reachability solver used by the validator only. The plan itself is fixed: this
// module never invents roads or links, it answers "can the pilot / the mech get
// there" on a 0.5 grid with 4 neighbours plus a continuous segment re-check.
import { GRID } from '../../config/layout.js';
import type { PointXZ, Rect } from './rect.js';

interface NavGrid {
    size: number;
    step: number;
    bounds: number;
    blocked: Uint8Array;
    centers: Float32Array;
    toCell: (value: number) => number;
    isBlocked: (i: number, j: number) => boolean;
}

export interface NavTarget {
    id: string;
    x: number;
    z: number;
}

// Square probe, matching the game's collision model (TZ §10: a 1.5 m passage
// leaves 1.5 − 2×0.42 of free lateral travel, i.e. radius added once per side).
export function isFreeAt(x: number, z: number, radius: number, obstacles: Rect[], bounds: number): boolean {
    if (Math.abs(x) + radius > bounds || Math.abs(z) + radius > bounds) return false;
    for (let index = 0; index < obstacles.length; index++) {
        const rect = obstacles[index];
        if (x + radius > rect.minX && x - radius < rect.maxX && z + radius > rect.minZ && z - radius < rect.maxZ) {
            return false;
        }
    }
    return true;
}

function segmentFree(
    from: PointXZ,
    to: PointXZ,
    radius: number,
    obstacles: Rect[],
    bounds: number,
    sampleStep: number = 0.1
): boolean {
    const length = Math.hypot(to.x - from.x, to.z - from.z);
    const steps = Math.max(1, Math.ceil(length / sampleStep));
    for (let step = 0; step <= steps; step++) {
        const t = step / steps;
        const x = from.x + (to.x - from.x) * t;
        const z = from.z + (to.z - from.z) * t;
        if (!isFreeAt(x, z, radius, obstacles, bounds)) return false;
    }
    return true;
}

export function polylineFree(points: PointXZ[], radius: number, obstacles: Rect[], bounds: number): boolean {
    for (let index = 0; index < points.length - 1; index++) {
        if (!segmentFree(points[index], points[index + 1], radius, obstacles, bounds)) return false;
    }
    return true;
}

function createGrid({
    bounds,
    step,
    obstacles,
    radius
}: {
    bounds: number;
    step: number;
    obstacles: Rect[];
    radius: number;
}): NavGrid {
    const size = Math.ceil((bounds * 2) / step);
    const blocked = new Uint8Array(size * size);
    const centers = new Float32Array(size);

    for (let index = 0; index < size; index++) {
        centers[index] = -bounds + step * (index + 0.5);
    }

    for (let j = 0; j < size; j++) {
        for (let i = 0; i < size; i++) {
            if (!isFreeAt(centers[i], centers[j], radius, obstacles, bounds)) {
                blocked[j * size + i] = 1;
            }
        }
    }

    const toCell = (value: number): number => {
        const index = Math.floor((value + bounds) / step);
        return Math.min(size - 1, Math.max(0, index));
    };

    return { size, step, bounds, blocked, centers, toCell, isBlocked: (i: number, j: number) => i < 0 || j < 0 || i >= size || j >= size || blocked[j * size + i] === 1 };
}

export function createNavigationWorld({
    barriers,
    bounds,
    step = GRID.AXIS_STEP
}: {
    barriers: Rect[];
    bounds: number;
    step?: number;
}) {
    const grids = new Map<string, NavGrid>();

    const gridFor = (radius: number): NavGrid => {
        const key = radius.toFixed(3);
        if (!grids.has(key)) {
            grids.set(key, createGrid({ bounds, step, obstacles: barriers, radius }));
        }
        return grids.get(key)!;
    };

    const nearestFree = (grid: NavGrid, x: number, z: number): { i: number; j: number } | null => {
        const i0 = grid.toCell(x);
        const j0 = grid.toCell(z);
        for (let ring = 0; ring <= 4; ring++) {
            for (let dj = -ring; dj <= ring; dj++) {
                for (let di = -ring; di <= ring; di++) {
                    if (Math.max(Math.abs(di), Math.abs(dj)) !== ring) continue;
                    if (!grid.isBlocked(i0 + di, j0 + dj)) return { i: i0 + di, j: j0 + dj };
                }
            }
        }
        return null;
    };

    // Breadth-first flood over free cells; returns the visited mask and parents.
    const flood = (grid: NavGrid, start: { i: number; j: number }): Uint8Array => {
        const total = grid.size * grid.size;
        const visited = new Uint8Array(total);
        const queue = new Int32Array(total);
        let head = 0;
        let tail = 0;
        const startCell = start.j * grid.size + start.i;
        visited[startCell] = 1;
        queue[tail++] = startCell;

        while (head < tail) {
            const cell = queue[head++];
            const i = cell % grid.size;
            const j = (cell - i) / grid.size;
            const neighbours = [
                [i + 1, j],
                [i - 1, j],
                [i, j + 1],
                [i, j - 1]
            ];
            for (let n = 0; n < 4; n++) {
                const [ni, nj] = neighbours[n];
                if (grid.isBlocked(ni, nj)) continue;
                const next = nj * grid.size + ni;
                if (visited[next]) continue;
                visited[next] = 1;
                queue[tail++] = next;
            }
        }

        return visited;
    };

    const startCell = (grid: NavGrid, point: PointXZ) => nearestFree(grid, point.x, point.z);

    const reachable = ({
        from,
        targets,
        radius
    }: {
        from: PointXZ;
        targets: NavTarget[];
        radius: number;
    }): { ok: boolean; unreachable: string[]; visited?: number } => {
        const grid = gridFor(radius);
        const start = startCell(grid, from);
        if (!start) return { ok: false, unreachable: targets.map((target) => target.id), visited: 0 };
        const visited = flood(grid, start);
        const unreachable: string[] = [];
        targets.forEach((target) => {
            const cell = startCell(grid, target);
            if (!cell || !visited[cell.j * grid.size + cell.i]) unreachable.push(target.id);
        });
        return { ok: unreachable.length === 0, unreachable };
    };

    const findPath = ({ from, to, radius }: { from: PointXZ; to: PointXZ; radius: number }): PointXZ[] | null => {
        const grid = gridFor(radius);
        const start = startCell(grid, from);
        const goal = startCell(grid, to);
        if (!start || !goal) return null;

        const total = grid.size * grid.size;
        const parent = new Int32Array(total).fill(-1);
        const queue = new Int32Array(total);
        let head = 0;
        let tail = 0;
        const startCellIndex = start.j * grid.size + start.i;
        const goalCellIndex = goal.j * grid.size + goal.i;
        parent[startCellIndex] = startCellIndex;
        queue[tail++] = startCellIndex;

        while (head < tail) {
            const cell = queue[head++];
            if (cell === goalCellIndex) break;
            const i = cell % grid.size;
            const j = (cell - i) / grid.size;
            const neighbours = [
                [i + 1, j],
                [i - 1, j],
                [i, j + 1],
                [i, j - 1]
            ];
            for (let n = 0; n < 4; n++) {
                const [ni, nj] = neighbours[n];
                if (grid.isBlocked(ni, nj)) continue;
                const next = nj * grid.size + ni;
                if (parent[next] !== -1) continue;
                parent[next] = cell;
                queue[tail++] = next;
            }
        }

        if (parent[goalCellIndex] === -1) return null;

        const cells: PointXZ[] = [];
        let cursor = goalCellIndex;
        while (cursor !== startCellIndex) {
            const i = cursor % grid.size;
            const j = (cursor - i) / grid.size;
            cells.push({ x: grid.centers[i], z: grid.centers[j] });
            cursor = parent[cursor];
        }
        cells.push({ x: grid.centers[start.i], z: grid.centers[start.j] });
        cells.reverse();
        return cells;
    };

    return { gridFor, reachable, findPath, nearestFree: (radius: number, x: number, z: number) => nearestFree(gridFor(radius), x, z) };
}
