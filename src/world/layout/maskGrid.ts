// Coordinate-compression grid for surface masks. All rectangles of the plan are
// projected onto one shared set of X/Z boundaries, so neighbouring cells always
// share identical vertices — the resulting meshes are watertight even after PS1
// vertex snapping, and the covered area is the exact union (not a mesh sum).
import type { Rect } from './rect.js';

export interface Mask {
    cells: Uint8Array;
    nx: number;
    nz: number;
}

interface VerticalSegment {
    x: number;
    z0: number;
    z1: number;
    side: number;
}

interface HorizontalSegment {
    z: number;
    x0: number;
    x1: number;
    side: number;
}

interface MaskBoundary {
    vertical: VerticalSegment[];
    horizontal: HorizontalSegment[];
}

interface MaskGridOptions {
    minX: number;
    minZ: number;
    maxX: number;
    maxZ: number;
    rects: Rect[];
}

const SNAP = 1e4;

function round(value: number): number {
    // Kill float noise so equal boundaries collapse into one grid line.
    return Math.round(value * SNAP) / SNAP;
}

function collectAxis(base: number[], rects: Rect[], pick: (rect: Rect) => number): number[] {
    const values = new Set(base.map(round));
    rects.forEach((rect) => values.add(round(pick(rect))));
    return Array.from(values).sort((a, b) => a - b);
}

export function createMaskGrid({ minX, minZ, maxX, maxZ, rects }: MaskGridOptions) {
    const xs = collectAxis([minX, maxX], rects, (rect) => rect.minX).concat(
        collectAxis([], rects, (rect) => rect.maxX)
    );
    const zs = collectAxis([minZ, maxZ], rects, (rect) => rect.minZ).concat(
        collectAxis([], rects, (rect) => rect.maxZ)
    );

    const uniqueX = Array.from(new Set(xs.map(round))).sort((a, b) => a - b);
    const uniqueZ = Array.from(new Set(zs.map(round))).sort((a, b) => a - b);

    const xIndex = new Map(uniqueX.map((value, index): [number, number] => [value, index]));
    const zIndex = new Map(uniqueZ.map((value, index): [number, number] => [value, index]));

    const nx = uniqueX.length - 1;
    const nz = uniqueZ.length - 1;

    function createMask(): Mask {
        return { cells: new Uint8Array(nx * nz), nx, nz };
    }

    function cellIndex(i: number, j: number): number {
        return j * nx + i;
    }

    function isSet(mask: Mask, i: number, j: number): boolean {
        if (i < 0 || j < 0 || i >= nx || j >= nz) return false;
        return mask.cells[cellIndex(i, j)] === 1;
    }

    function mark(mask: Mask, rectsToMark: Rect[]): Mask {
        rectsToMark.forEach((rect) => {
            const i0 = xIndex.get(round(rect.minX));
            const i1 = xIndex.get(round(rect.maxX));
            const j0 = zIndex.get(round(rect.minZ));
            const j1 = zIndex.get(round(rect.maxZ));
            if (i0 === undefined || i1 === undefined || j0 === undefined || j1 === undefined) {
                throw new Error(`Rect ${JSON.stringify(rect)} is not aligned with the mask grid`);
            }
            for (let j = j0; j < j1; j++) {
                for (let i = i0; i < i1; i++) {
                    mask.cells[cellIndex(i, j)] = 1;
                }
            }
        });
        return mask;
    }

    function clearRects(mask: Mask, rectsToClear: Rect[]): Mask {
        rectsToClear.forEach((rect) => {
            const i0 = xIndex.get(round(rect.minX));
            const i1 = xIndex.get(round(rect.maxX));
            const j0 = zIndex.get(round(rect.minZ));
            const j1 = zIndex.get(round(rect.maxZ));
            if (i0 === undefined || i1 === undefined || j0 === undefined || j1 === undefined) return;
            for (let j = j0; j < j1; j++) {
                for (let i = i0; i < i1; i++) {
                    mask.cells[cellIndex(i, j)] = 0;
                }
            }
        });
        return mask;
    }

    function subtractMask(mask: Mask, other: Mask): Mask {
        for (let index = 0; index < mask.cells.length; index++) {
            if (other.cells[index] === 1) mask.cells[index] = 0;
        }
        return mask;
    }

    function copyMask(mask: Mask): Mask {
        return { cells: mask.cells.slice(), nx, nz };
    }

    function cellRect(i: number, j: number): Rect {
        return { minX: uniqueX[i], minZ: uniqueZ[j], maxX: uniqueX[i + 1], maxZ: uniqueZ[j + 1] };
    }

    function area(mask: Mask): number {
        let total = 0;
        for (let j = 0; j < nz; j++) {
            for (let i = 0; i < nx; i++) {
                if (mask.cells[cellIndex(i, j)] === 1) {
                    total += (uniqueX[i + 1] - uniqueX[i]) * (uniqueZ[j + 1] - uniqueZ[j]);
                }
            }
        }
        return total;
    }

    function cellCount(mask: Mask): number {
        let total = 0;
        for (let index = 0; index < mask.cells.length; index++) {
            if (mask.cells[index] === 1) total++;
        }
        return total;
    }

    function forEachCell(mask: Mask, callback: (rect: Rect, i: number, j: number) => void): void {
        for (let j = 0; j < nz; j++) {
            for (let i = 0; i < nx; i++) {
                if (mask.cells[cellIndex(i, j)] === 1) callback(cellRect(i, j), i, j);
            }
        }
    }

    function isCoveredAt(mask: Mask, x: number, z: number): boolean {
        const i = xIndex.get(round(x));
        const j = zIndex.get(round(z));
        if (i === undefined || j === undefined) return false;
        return isSet(mask, i, j) || isSet(mask, i - 1, j) || isSet(mask, i - 1, j - 1) || isSet(mask, i, j - 1);
    }

    // Boundary edges between a covered cell and an uncovered one. `exclude` treats
    // cells of another mask as "no border" (used for pedestrian crossings).
    function boundary(mask: Mask, exclude: Mask | null = null): MaskBoundary {
        const vertical = new Map<string, number[]>();
        const horizontal = new Map<string, number[]>();

        const pushVertical = (i: number, side: number, j: number): void => {
            const key = `${i}|${side}`;
            if (!vertical.has(key)) vertical.set(key, []);
            vertical.get(key)!.push(j);
        };
        const pushHorizontal = (j: number, side: number, i: number): void => {
            const key = `${j}|${side}`;
            if (!horizontal.has(key)) horizontal.set(key, []);
            horizontal.get(key)!.push(i);
        };

        for (let j = 0; j < nz; j++) {
            for (let i = 0; i < nx; i++) {
                if (!isSet(mask, i, j)) continue;
                if (!isSet(mask, i - 1, j) && !(exclude && isSet(exclude, i - 1, j))) pushVertical(i, -1, j);
                if (!isSet(mask, i + 1, j) && !(exclude && isSet(exclude, i + 1, j))) pushVertical(i + 1, 1, j);
                if (!isSet(mask, i, j - 1) && !(exclude && isSet(exclude, i, j - 1))) pushHorizontal(j, -1, i);
                if (!isSet(mask, i, j + 1) && !(exclude && isSet(exclude, i, j + 1))) pushHorizontal(j + 1, 1, i);
            }
        }

        const merge = <T,>(map: Map<string, number[]>, toSegment: (key: string, from: number, to: number) => T): T[] => {
            const segments: T[] = [];
            map.forEach((indices, key) => {
                const sorted = indices.slice().sort((a, b) => a - b);
                let runStart = sorted[0];
                let previous = sorted[0];
                for (let k = 1; k <= sorted.length; k++) {
                    const current = sorted[k];
                    if (current !== previous + 1) {
                        segments.push(toSegment(key, runStart, previous + 1));
                        runStart = current;
                    }
                    previous = current;
                }
            });
            return segments;
        };

        return {
            vertical: merge(vertical, (key, from, to): VerticalSegment => {
                const [i, side] = key.split('|').map(Number);
                return { x: uniqueX[i], z0: uniqueZ[from], z1: uniqueZ[to], side };
            }),
            horizontal: merge(horizontal, (key, from, to): HorizontalSegment => {
                const [j, side] = key.split('|').map(Number);
                return { z: uniqueZ[j], x0: uniqueX[from], x1: uniqueX[to], side };
            })
        };
    }

    function checksum(mask: Mask): string {
        let hash = 0x811c9dc5;
        for (let index = 0; index < mask.cells.length; index++) {
            hash ^= mask.cells[index];
            hash = Math.imul(hash, 0x01000193) >>> 0;
        }
        return hash.toString(16).padStart(8, '0');
    }

    return {
        xs: uniqueX,
        zs: uniqueZ,
        nx,
        nz,
        createMask,
        mark,
        clearRects,
        subtractMask,
        copyMask,
        cellRect,
        area,
        cellCount,
        forEachCell,
        isCoveredAt,
        isSet,
        boundary,
        checksum
    };
}

export type MaskGrid = ReturnType<typeof createMaskGrid>;
