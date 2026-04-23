export interface Bbox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Grid {
  cellSize: number;
  cols: number;
  rows: number;
  originX: number;
  originY: number;
  walkable: Uint8Array;
  blockerByCell: Map<number, string>;
}

export interface BuildGridOptions {
  cellSize?: number;
  marginCells?: number;
  clearanceCells?: number;
}

export function buildGrid(nodes: Bbox[], opts: BuildGridOptions = {}): Grid {
  const cellSize = opts.cellSize ?? 16;
  const marginCells = opts.marginCells ?? 6;
  const clearanceCells = opts.clearanceCells ?? 1;

  if (nodes.length === 0) {
    return {
      cellSize,
      cols: 1,
      rows: 1,
      originX: -cellSize / 2,
      originY: -cellSize / 2,
      walkable: new Uint8Array([1]),
      blockerByCell: new Map(),
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x + n.w > maxX) maxX = n.x + n.w;
    if (n.y + n.h > maxY) maxY = n.y + n.h;
  }

  const margin = marginCells * cellSize;
  const originX = Math.floor((minX - margin) / cellSize) * cellSize;
  const originY = Math.floor((minY - margin) / cellSize) * cellSize;
  const farX = maxX + margin;
  const farY = maxY + margin;
  const cols = Math.max(1, Math.ceil((farX - originX) / cellSize) + 1);
  const rows = Math.max(1, Math.ceil((farY - originY) / cellSize) + 1);

  const walkable = new Uint8Array(cols * rows);
  walkable.fill(1);
  const blockerByCell = new Map<number, string>();

  const clearance = clearanceCells * cellSize;

  for (const n of nodes) {
    const x0 = n.x - clearance;
    const y0 = n.y - clearance;
    const x1 = n.x + n.w + clearance;
    const y1 = n.y + n.h + clearance;

    const cx0 = Math.max(0, Math.ceil((x0 - originX) / cellSize - 0.5));
    const cy0 = Math.max(0, Math.ceil((y0 - originY) / cellSize - 0.5));
    const cx1 = Math.min(cols - 1, Math.ceil((x1 - originX) / cellSize - 0.5) - 1);
    const cy1 = Math.min(rows - 1, Math.ceil((y1 - originY) / cellSize - 0.5) - 1);

    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const idx = cy * cols + cx;
        walkable[idx] = 0;
        blockerByCell.set(idx, n.id);
      }
    }
  }

  return { cellSize, cols, rows, originX, originY, walkable, blockerByCell };
}

export function pointToCell(grid: Grid, x: number, y: number): { cx: number; cy: number } {
  const cx = Math.floor((x - grid.originX) / grid.cellSize);
  const cy = Math.floor((y - grid.originY) / grid.cellSize);
  return {
    cx: Math.max(0, Math.min(grid.cols - 1, cx)),
    cy: Math.max(0, Math.min(grid.rows - 1, cy)),
  };
}

export function cellToPoint(grid: Grid, cx: number, cy: number): { x: number; y: number } {
  return {
    x: grid.originX + (cx + 0.5) * grid.cellSize,
    y: grid.originY + (cy + 0.5) * grid.cellSize,
  };
}

export function carveOut(grid: Grid, nodeIds: string[]): Uint8Array {
  const out = new Uint8Array(grid.walkable);
  if (nodeIds.length === 0) return out;
  const ids = new Set(nodeIds);
  for (const [idx, blocker] of grid.blockerByCell) {
    if (ids.has(blocker)) out[idx] = 1;
  }
  return out;
}
