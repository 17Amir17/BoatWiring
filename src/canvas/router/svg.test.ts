import { describe, expect, it } from 'vitest';
import { cellsToSvgPath, type Cell, type GridLite } from './svg';

const grid: GridLite = { cellSize: 10, originX: 0, originY: 0 };

function cellCenter(cx: number, cy: number, g: GridLite = grid) {
  return {
    x: g.originX + cx * g.cellSize + g.cellSize / 2,
    y: g.originY + cy * g.cellSize + g.cellSize / 2,
  };
}

function parseCommands(d: string): { cmd: string; args: number[] }[] {
  const tokens = d.trim().split(/\s+/);
  const out: { cmd: string; args: number[] }[] = [];
  let cur: { cmd: string; args: number[] } | null = null;
  for (const t of tokens) {
    if (/^[A-Za-z]$/.test(t)) {
      if (cur) out.push(cur);
      cur = { cmd: t, args: [] };
    } else if (cur) {
      cur.args.push(Number(t));
    }
  }
  if (cur) out.push(cur);
  return out;
}

describe('cellsToSvgPath', () => {
  it('returns empty d for empty cells', () => {
    const result = cellsToSvgPath([], grid, { x: 1, y: 2 }, { x: 3, y: 4 });
    expect(result.d).toBe('');
    expect(result.labelX).toBe(1);
    expect(result.labelY).toBe(2);
  });

  it('returns straight line for a single cell', () => {
    const result = cellsToSvgPath(
      [{ cx: 0, cy: 0 }],
      grid,
      { x: 1, y: 2 },
      { x: 9, y: 8 },
    );
    const cmds = parseCommands(result.d);
    expect(cmds).toHaveLength(2);
    expect(cmds[0].cmd).toBe('M');
    expect(cmds[0].args).toEqual([1, 2]);
    expect(cmds[1].cmd).toBe('L');
    expect(cmds[1].args).toEqual([9, 8]);
    expect(result.labelX).toBeCloseTo(5);
    expect(result.labelY).toBeCloseTo(5);
  });

  it('emits a single M ... L ... for a horizontal straight run', () => {
    const cells: Cell[] = Array.from({ length: 5 }, (_, i) => ({
      cx: i,
      cy: 0,
    }));
    const start = cellCenter(0, 0);
    const end = cellCenter(4, 0);
    const result = cellsToSvgPath(cells, grid, start, end);
    const cmds = parseCommands(result.d);
    expect(cmds).toHaveLength(2);
    expect(cmds[0].cmd).toBe('M');
    expect(cmds[0].args).toEqual([start.x, start.y]);
    expect(cmds[1].cmd).toBe('L');
    expect(cmds[1].args).toEqual([end.x, end.y]);
    expect(result.d).not.toContain('Q');
    expect(result.labelX).toBeCloseTo((start.x + end.x) / 2);
    expect(result.labelY).toBeCloseTo((start.y + end.y) / 2);
  });

  it('collapses a 10-cell straight row to a 2-point line', () => {
    const cells: Cell[] = Array.from({ length: 10 }, (_, i) => ({
      cx: i,
      cy: 0,
    }));
    const start = cellCenter(0, 0);
    const end = cellCenter(9, 0);
    const result = cellsToSvgPath(cells, grid, start, end);
    const cmds = parseCommands(result.d);
    expect(cmds).toHaveLength(2);
    expect(cmds[0].cmd).toBe('M');
    expect(cmds[1].cmd).toBe('L');
    expect(result.d).not.toContain('Q');
  });

  it('emits a single Q at the corner of an L-shape', () => {
    const cells: Cell[] = [
      { cx: 0, cy: 0 },
      { cx: 1, cy: 0 },
      { cx: 1, cy: 1 },
    ];
    const start = cellCenter(0, 0);
    const end = cellCenter(1, 1);
    const result = cellsToSvgPath(cells, grid, start, end, { cornerRadius: 3 });
    const cmds = parseCommands(result.d);
    const qCount = cmds.filter((c) => c.cmd === 'Q').length;
    expect(qCount).toBe(1);
    expect(cmds[0].cmd).toBe('M');
    expect(cmds[cmds.length - 1].cmd).toBe('L');
    const corner = cellCenter(1, 0);
    const q = cmds.find((c) => c.cmd === 'Q')!;
    expect(q.args[0]).toBeCloseTo(corner.x);
    expect(q.args[1]).toBeCloseTo(corner.y);
  });

  it('anchors the start and end at the provided points, not cell centers', () => {
    const cells: Cell[] = [
      { cx: 0, cy: 0 },
      { cx: 1, cy: 0 },
      { cx: 2, cy: 0 },
    ];
    const start = { x: -3, y: 5 };
    const end = { x: 30, y: 5 };
    const result = cellsToSvgPath(cells, grid, start, end);
    const cmds = parseCommands(result.d);
    expect(cmds[0].cmd).toBe('M');
    expect(cmds[0].args).toEqual([-3, 5]);
    const lastL = [...cmds].reverse().find((c) => c.cmd === 'L')!;
    expect(lastL.args).toEqual([30, 5]);
  });

  it('clamps cornerRadius to half the shortest neighbor distance', () => {
    const cells: Cell[] = [
      { cx: 0, cy: 0 },
      { cx: 1, cy: 0 },
      { cx: 1, cy: 1 },
    ];
    const start = cellCenter(0, 0);
    const end = cellCenter(1, 1);
    const result = cellsToSvgPath(cells, grid, start, end, {
      cornerRadius: 1000,
    });
    const cmds = parseCommands(result.d);
    const corner = cellCenter(1, 0);
    const segLen = grid.cellSize;
    const expectedR = segLen / 2;

    const lFirst = cmds[1];
    expect(lFirst.cmd).toBe('L');
    const lEndPt = { x: lFirst.args[0], y: lFirst.args[1] };
    const dStartToCorner = Math.hypot(
      corner.x - start.x,
      corner.y - start.y,
    );
    const dLEndToCorner = Math.hypot(
      corner.x - lEndPt.x,
      corner.y - lEndPt.y,
    );
    expect(dLEndToCorner).toBeCloseTo(expectedR);
    expect(dLEndToCorner).toBeLessThanOrEqual(dStartToCorner);

    const q = cmds.find((c) => c.cmd === 'Q')!;
    const qEndPt = { x: q.args[2], y: q.args[3] };
    const dQEndToCorner = Math.hypot(
      corner.x - qEndPt.x,
      corner.y - qEndPt.y,
    );
    expect(dQEndToCorner).toBeCloseTo(expectedR);
  });

  it('places label at midpoint of an L-shape by arc length', () => {
    const cells: Cell[] = [
      { cx: 0, cy: 0 },
      { cx: 1, cy: 0 },
      { cx: 1, cy: 1 },
    ];
    const start = cellCenter(0, 0);
    const end = cellCenter(1, 1);
    const result = cellsToSvgPath(cells, grid, start, end);
    const corner = cellCenter(1, 0);
    expect(result.labelX).toBeCloseTo(corner.x);
    expect(result.labelY).toBeCloseTo(corner.y);
  });

  it('honors a non-zero grid origin', () => {
    const g: GridLite = { cellSize: 20, originX: 100, originY: 50 };
    const cells: Cell[] = [
      { cx: 0, cy: 0 },
      { cx: 1, cy: 0 },
      { cx: 2, cy: 0 },
    ];
    const start = cellCenter(0, 0, g);
    const end = cellCenter(2, 0, g);
    const result = cellsToSvgPath(cells, g, start, end);
    const cmds = parseCommands(result.d);
    expect(cmds[0].args).toEqual([110, 60]);
    expect(cmds[1].args).toEqual([150, 60]);
  });
});
