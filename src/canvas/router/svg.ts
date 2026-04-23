export interface GridLite {
  cellSize: number;
  originX: number;
  originY: number;
}

export interface Cell {
  cx: number;
  cy: number;
}

export interface Pt {
  x: number;
  y: number;
}

export interface PathOutput {
  d: string;
  labelX: number;
  labelY: number;
}

interface Opts {
  cornerRadius?: number;
}

function cellToWorld(cell: Cell, grid: GridLite): Pt {
  const half = grid.cellSize / 2;
  return {
    x: grid.originX + cell.cx * grid.cellSize + half,
    y: grid.originY + cell.cy * grid.cellSize + half,
  };
}

function collapseCollinear(pts: Pt[]): Pt[] {
  if (pts.length <= 2) return pts.slice();
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = out[out.length - 1];
    const cur = pts[i];
    const next = pts[i + 1];
    const sameX = prev.x === cur.x && cur.x === next.x;
    const sameY = prev.y === cur.y && cur.y === next.y;
    if (sameX || sameY) continue;
    out.push(cur);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function dedupe(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) out.push(p);
  }
  return out;
}

function dist(a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
}

function shorten(from: Pt, to: Pt, by: number): Pt {
  const d = dist(from, to);
  if (d === 0) return { x: to.x, y: to.y };
  const t = (d - by) / d;
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  };
}

function fmt(n: number): string {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
}

function midpointByLength(pts: Pt[]): Pt {
  if (pts.length === 0) return { x: 0, y: 0 };
  if (pts.length === 1) return { x: pts[0].x, y: pts[0].y };
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) total += dist(pts[i], pts[i + 1]);
  const target = total / 2;
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = dist(pts[i], pts[i + 1]);
    if (acc + seg >= target) {
      const remain = target - acc;
      const t = seg === 0 ? 0 : remain / seg;
      return {
        x: pts[i].x + (pts[i + 1].x - pts[i].x) * t,
        y: pts[i].y + (pts[i + 1].y - pts[i].y) * t,
      };
    }
    acc += seg;
  }
  const last = pts[pts.length - 1];
  return { x: last.x, y: last.y };
}

export function cellsToSvgPath(
  cells: Cell[],
  grid: GridLite,
  startPt: Pt,
  endPt: Pt,
  opts?: Opts,
): PathOutput {
  if (cells.length === 0) {
    return { d: '', labelX: startPt.x, labelY: startPt.y };
  }

  const cornerRadius = opts?.cornerRadius ?? 6;

  if (cells.length === 1) {
    if (startPt.x === endPt.x && startPt.y === endPt.y) {
      return {
        d: `M ${fmt(startPt.x)} ${fmt(startPt.y)}`,
        labelX: startPt.x,
        labelY: startPt.y,
      };
    }
    const mid = midpointByLength([startPt, endPt]);
    return {
      d: `M ${fmt(startPt.x)} ${fmt(startPt.y)} L ${fmt(endPt.x)} ${fmt(endPt.y)}`,
      labelX: mid.x,
      labelY: mid.y,
    };
  }

  const worldPts: Pt[] = cells.map((c) => cellToWorld(c, grid));
  worldPts[0] = { x: startPt.x, y: startPt.y };
  worldPts[worldPts.length - 1] = { x: endPt.x, y: endPt.y };

  const deduped = dedupe(worldPts);

  if (deduped.length === 1) {
    return {
      d: `M ${fmt(deduped[0].x)} ${fmt(deduped[0].y)}`,
      labelX: deduped[0].x,
      labelY: deduped[0].y,
    };
  }

  const collapsed = collapseCollinear(deduped);

  const mid = midpointByLength(collapsed);

  if (collapsed.length === 2) {
    const a = collapsed[0];
    const b = collapsed[1];
    return {
      d: `M ${fmt(a.x)} ${fmt(a.y)} L ${fmt(b.x)} ${fmt(b.y)}`,
      labelX: mid.x,
      labelY: mid.y,
    };
  }

  const parts: string[] = [];
  const first = collapsed[0];
  parts.push(`M ${fmt(first.x)} ${fmt(first.y)}`);

  for (let i = 1; i < collapsed.length - 1; i++) {
    const a = collapsed[i - 1];
    const p = collapsed[i];
    const b = collapsed[i + 1];
    const r = Math.min(cornerRadius, dist(a, p) / 2, dist(p, b) / 2);
    const lineEnd = shorten(a, p, r);
    const curveEnd = shorten(b, p, r);
    parts.push(`L ${fmt(lineEnd.x)} ${fmt(lineEnd.y)}`);
    parts.push(
      `Q ${fmt(p.x)} ${fmt(p.y)} ${fmt(curveEnd.x)} ${fmt(curveEnd.y)}`,
    );
  }

  const last = collapsed[collapsed.length - 1];
  parts.push(`L ${fmt(last.x)} ${fmt(last.y)}`);

  return {
    d: parts.join(' '),
    labelX: mid.x,
    labelY: mid.y,
  };
}
