import type { Edge, Node } from '@xyflow/react';
import { aStar } from './astar';
import { buildGrid, pointToCell, type Bbox, type Grid } from './grid';
import { cellsToSvgPath, type Cell } from './svg';

export interface EdgeRoute {
  d: string;
  labelX: number;
  labelY: number;
}

export type PortLookup = (nodeId: string, handleId: string | null) => { x: number; y: number } | null;

const REUSE_PENALTY = 30;
const TURN_PENALTY = 8;
const CELL_SIZE = 12;
const MARGIN_CELLS = 8;
const CLEARANCE_CELLS = 1;
/** Cells of perpendicular stub from the port out before the path is free to
 *  turn. Forces wires to leave a node along the port's outward normal instead
 *  of cutting across the body. */
const STUB_CELLS = 2;

type Dir = { dx: -1 | 0 | 1; dy: -1 | 0 | 1 };

export function routeEdges(
  edges: Edge[],
  nodes: Node[],
  portPos: PortLookup,
): Map<string, EdgeRoute> {
  const out = new Map<string, EdgeRoute>();
  if (nodes.length === 0 || edges.length === 0) return out;

  const byId = new Map<string, Node>();
  const bboxById = new Map<string, Bbox>();
  const bboxes: Bbox[] = [];
  for (const n of nodes) {
    byId.set(n.id, n);
    const w = n.measured?.width ?? n.width ?? 0;
    const h = n.measured?.height ?? n.height ?? 0;
    if (w > 0 && h > 0) {
      const b = { id: n.id, x: n.position.x, y: n.position.y, w, h };
      bboxes.push(b);
      bboxById.set(n.id, b);
    }
  }

  const grid = buildGrid(bboxes, {
    cellSize: CELL_SIZE,
    marginCells: MARGIN_CELLS,
    clearanceCells: CLEARANCE_CELLS,
  });
  const usage = new Map<number, number>();

  // Route longer edges first so they claim the prime corridors; short edges
  // adapt around them.
  const sorted = [...edges].sort((a, b) => edgeLen(b, byId) - edgeLen(a, byId));

  for (const e of sorted) {
    const sn = byId.get(e.source);
    const tn = byId.get(e.target);
    if (!sn || !tn) continue;
    const sBbox = bboxById.get(sn.id);
    const tBbox = bboxById.get(tn.id);
    if (!sBbox || !tBbox) continue;

    const sPt = portPos(sn.id, e.sourceHandle ?? null);
    const tPt = portPos(tn.id, e.targetHandle ?? null);
    if (!sPt || !tPt) continue;

    const sDir = portDirection(sPt, sBbox);
    const tDir = portDirection(tPt, tBbox);

    const sStart = pointToCell(grid, sPt.x, sPt.y);
    const tStart = pointToCell(grid, tPt.x, tPt.y);
    const sN = pickStubLength(sStart, sDir, grid);
    const tN = pickStubLength(tStart, tDir, grid);
    const sStub = projectCells(sStart, sDir, sN, grid);
    const tStub = projectCells(tStart, tDir, tN, grid);

    // A* runs between the stub-end cells, both of which sit OUTSIDE every node
    // bbox (since we projected past the port's clearance). No carve-out: the
    // path can't enter any node.
    const path = aStar({
      cols: grid.cols,
      rows: grid.rows,
      walkable: grid.walkable,
      start: sStub,
      end: tStub,
      extraCost: usage,
      turnPenalty: TURN_PENALTY,
    });
    if (!path || path.length === 0) continue;

    // Prepend the source stub (port → sStub) and append the target stub
    // (tStub → port) so the wire visually anchors at the actual pin.
    const fullCells: Cell[] = [
      sStart,
      ...stubCells(sStart, sDir, sN),
      ...path.slice(1, -1),
      ...stubCells(tStart, tDir, tN).reverse(),
      tStart,
    ];

    // Only penalize the trunk (the A* portion) so future wires sharing a port
    // can still get out via the same perpendicular stub. Without this, the 2nd
    // wire from a shared port can't pathfind because its stub cells are heavily
    // penalized by the 1st wire's usage entries.
    for (const c of path) {
      const idx = c.cy * grid.cols + c.cx;
      if (idx >= 0 && idx < grid.walkable.length) {
        usage.set(idx, (usage.get(idx) ?? 0) + REUSE_PENALTY);
      }
    }

    const svg = cellsToSvgPath(fullCells, grid, sPt, tPt, { cornerRadius: 6 });
    out.set(e.id, svg);
  }

  return out;
}

/** Which edge of the bbox is the port closest to? Returns the OUTWARD-pointing
 *  unit vector (one of L/R/U/D). Falls back to nearest edge by distance. */
function portDirection(pt: { x: number; y: number }, b: Bbox): Dir {
  const dl = pt.x - b.x;
  const dr = (b.x + b.w) - pt.x;
  const dt = pt.y - b.y;
  const db = (b.y + b.h) - pt.y;
  const m = Math.min(dl, dr, dt, db);
  if (m === dl) return { dx: -1, dy: 0 };
  if (m === dr) return { dx: 1, dy: 0 };
  if (m === dt) return { dx: 0, dy: -1 };
  return { dx: 0, dy: 1 };
}

function projectCells(start: Cell, dir: Dir, n: number, grid: Grid): Cell {
  const cx = clamp(start.cx + dir.dx * n, 0, grid.cols - 1);
  const cy = clamp(start.cy + dir.dy * n, 0, grid.rows - 1);
  return { cx, cy };
}

/** Walk outward from `start` along `dir` until we hit a walkable cell. Prefer
 *  STUB_CELLS, but extend further if the default lands inside a neighboring
 *  node. Cap at `maxN` to avoid runaway. Returns 0 if we never find one. */
function pickStubLength(start: Cell, dir: Dir, grid: Grid): number {
  const maxN = STUB_CELLS + 8;
  // Try the canonical length first; if blocked, walk OUT until we escape.
  for (let n = STUB_CELLS; n <= maxN; n++) {
    const c = projectCells(start, dir, n, grid);
    const idx = c.cy * grid.cols + c.cx;
    if (idx >= 0 && idx < grid.walkable.length && grid.walkable[idx] === 1) return n;
  }
  // Last resort: shorter than STUB_CELLS.
  for (let n = STUB_CELLS - 1; n >= 1; n--) {
    const c = projectCells(start, dir, n, grid);
    const idx = c.cy * grid.cols + c.cx;
    if (idx >= 0 && idx < grid.walkable.length && grid.walkable[idx] === 1) return n;
  }
  return 0;
}

function stubCells(start: Cell, dir: Dir, n: number): Cell[] {
  const out: Cell[] = [];
  for (let i = 1; i <= n; i++) {
    out.push({ cx: start.cx + dir.dx * i, cy: start.cy + dir.dy * i });
  }
  return out;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function edgeLen(e: Edge, byId: Map<string, Node>): number {
  const a = byId.get(e.source);
  const b = byId.get(e.target);
  if (!a || !b) return 0;
  const aw = a.measured?.width ?? a.width ?? 0;
  const ah = a.measured?.height ?? a.height ?? 0;
  const bw = b.measured?.width ?? b.width ?? 0;
  const bh = b.measured?.height ?? b.height ?? 0;
  const dx = (a.position.x + aw / 2) - (b.position.x + bw / 2);
  const dy = (a.position.y + ah / 2) - (b.position.y + bh / 2);
  return Math.sqrt(dx * dx + dy * dy);
}

export type { Cell, Grid };
