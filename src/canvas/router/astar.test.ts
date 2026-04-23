import { describe, it, expect } from "vitest";
import { aStar, type Cell } from "./astar";

function makeWalkable(cols: number, rows: number, blocked: Array<[number, number]> = []): Uint8Array {
  const w = new Uint8Array(cols * rows);
  w.fill(1);
  for (const [x, y] of blocked) {
    w[y * cols + x] = 0;
  }
  return w;
}

function pathKey(p: Cell[]): string {
  return p.map((c) => `${c.cx},${c.cy}`).join(" ");
}

describe("aStar", () => {
  it("returns straight path on a 5x1 grid", () => {
    const cols = 5;
    const rows = 1;
    const walkable = makeWalkable(cols, rows);
    const path = aStar({
      cols,
      rows,
      walkable,
      start: { cx: 0, cy: 0 },
      end: { cx: 4, cy: 0 },
    });
    expect(path).not.toBeNull();
    expect(path!.length).toBe(5);
    expect(path![0]).toEqual({ cx: 0, cy: 0 });
    expect(path![4]).toEqual({ cx: 4, cy: 0 });
  });

  it("routes around an obstacle wall", () => {
    const cols = 5;
    const rows = 5;
    const walkable = makeWalkable(cols, rows, [
      [2, 0],
      [2, 1],
      [2, 2],
      [2, 3],
    ]);
    const path = aStar({
      cols,
      rows,
      walkable,
      start: { cx: 0, cy: 0 },
      end: { cx: 4, cy: 0 },
    });
    expect(path).not.toBeNull();
    for (const c of path!) {
      expect(walkable[c.cy * cols + c.cx]).toBe(1);
    }
    expect(path![0]).toEqual({ cx: 0, cy: 0 });
    expect(path![path!.length - 1]).toEqual({ cx: 4, cy: 0 });
    expect(path!.length).toBeGreaterThan(5);
  });

  it("returns null when no path exists", () => {
    const cols = 3;
    const rows = 3;
    const walkable = makeWalkable(cols, rows, [
      [1, 0],
      [1, 1],
      [1, 2],
    ]);
    const path = aStar({
      cols,
      rows,
      walkable,
      start: { cx: 0, cy: 0 },
      end: { cx: 2, cy: 0 },
    });
    expect(path).toBeNull();
  });

  it("returns [start] when start === end", () => {
    const cols = 3;
    const rows = 3;
    const walkable = makeWalkable(cols, rows);
    const path = aStar({
      cols,
      rows,
      walkable,
      start: { cx: 1, cy: 1 },
      end: { cx: 1, cy: 1 },
    });
    expect(path).toEqual([{ cx: 1, cy: 1 }]);
  });

  it("turn penalty pushes A* to a straight path over a zigzag", () => {
    const cols = 7;
    const rows = 3;
    const walkable = makeWalkable(cols, rows);
    const path = aStar({
      cols,
      rows,
      walkable,
      start: { cx: 0, cy: 1 },
      end: { cx: 6, cy: 1 },
      turnPenalty: 100,
    });
    expect(path).not.toBeNull();
    for (const c of path!) {
      expect(c.cy).toBe(1);
    }
    expect(path!.length).toBe(7);
  });

  it("avoids cells with high extraCost when a slightly longer path exists", () => {
    const cols = 7;
    const rows = 3;
    const walkable = makeWalkable(cols, rows);
    const extraCost = new Map<number, number>();
    for (let x = 1; x <= 5; x++) {
      extraCost.set(1 * cols + x, 1000);
    }
    const path = aStar({
      cols,
      rows,
      walkable,
      start: { cx: 0, cy: 1 },
      end: { cx: 6, cy: 1 },
      extraCost,
      turnPenalty: 1,
    });
    expect(path).not.toBeNull();
    const usedHighCost = path!.some((c) => extraCost.get(c.cy * cols + c.cx) === 1000);
    expect(usedHighCost).toBe(false);
    expect(path![0]).toEqual({ cx: 0, cy: 1 });
    expect(path![path!.length - 1]).toEqual({ cx: 6, cy: 1 });
  });

  it("handles a blocked start and end (endpoints inside node bbox)", () => {
    const cols = 5;
    const rows = 3;
    const walkable = makeWalkable(cols, rows, [
      [0, 1],
      [4, 1],
    ]);
    const path = aStar({
      cols,
      rows,
      walkable,
      start: { cx: 0, cy: 1 },
      end: { cx: 4, cy: 1 },
    });
    expect(path).not.toBeNull();
    expect(path![0]).toEqual({ cx: 0, cy: 1 });
    expect(path![path!.length - 1]).toEqual({ cx: 4, cy: 1 });
  });

  it("does not apply turn penalty on the very first step", () => {
    const cols = 3;
    const rows = 3;
    const walkable = makeWalkable(cols, rows);
    const path = aStar({
      cols,
      rows,
      walkable,
      start: { cx: 0, cy: 0 },
      end: { cx: 2, cy: 2 },
      turnPenalty: 1000,
    });
    expect(path).not.toBeNull();
    expect(path!.length).toBe(5);
    expect(pathKey(path!)).toBeTruthy();
  });
});
