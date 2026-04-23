import { describe, it, expect } from "vitest";
import { buildGrid, carveOut, cellToPoint, pointToCell, type Bbox } from "./grid";

describe("buildGrid", () => {
  it("computes origin and dimensions for a single node with margin", () => {
    const nodes: Bbox[] = [{ id: "a", x: 100, y: 100, w: 80, h: 80 }];
    const grid = buildGrid(nodes, { cellSize: 16, marginCells: 4, clearanceCells: 1 });

    expect(grid.cellSize).toBe(16);
    expect(grid.originX).toBe(Math.floor((100 - 64) / 16) * 16);
    expect(grid.originY).toBe(Math.floor((100 - 64) / 16) * 16);
    expect(grid.originX).toBe(32);
    expect(grid.originY).toBe(32);
    expect(grid.cols).toBeGreaterThan(0);
    expect(grid.rows).toBeGreaterThan(0);
  });

  it("blocks cells inside bbox + 1-cell clearance and leaves outside walkable", () => {
    const nodes: Bbox[] = [{ id: "a", x: 100, y: 100, w: 80, h: 80 }];
    const grid = buildGrid(nodes, { cellSize: 16, marginCells: 4, clearanceCells: 1 });

    const centerCell = pointToCell(grid, 140, 140);
    expect(grid.walkable[centerCell.cy * grid.cols + centerCell.cx]).toBe(0);

    const insideTL = pointToCell(grid, 108, 108);
    expect(grid.walkable[insideTL.cy * grid.cols + insideTL.cx]).toBe(0);
    const insideBR = pointToCell(grid, 172, 172);
    expect(grid.walkable[insideBR.cy * grid.cols + insideBR.cx]).toBe(0);

    const justInsideClearance = pointToCell(grid, 100 - 8, 140);
    expect(grid.walkable[justInsideClearance.cy * grid.cols + justInsideClearance.cx]).toBe(0);

    const farAway = pointToCell(grid, 40, 40);
    expect(grid.walkable[farAway.cy * grid.cols + farAway.cx]).toBe(1);

    const farAway2 = pointToCell(grid, 240, 240);
    expect(grid.walkable[farAway2.cy * grid.cols + farAway2.cx]).toBe(1);
  });

  it("blockerByCell correctly maps blocked cells to the node id", () => {
    const nodes: Bbox[] = [{ id: "node-x", x: 100, y: 100, w: 80, h: 80 }];
    const grid = buildGrid(nodes, { cellSize: 16, marginCells: 4, clearanceCells: 1 });

    let blockedCount = 0;
    for (let i = 0; i < grid.walkable.length; i++) {
      if (grid.walkable[i] === 0) {
        blockedCount++;
        expect(grid.blockerByCell.get(i)).toBe("node-x");
      }
    }
    expect(blockedCount).toBeGreaterThan(0);
    expect(grid.blockerByCell.size).toBe(blockedCount);
  });

  it("registers blockers for two non-overlapping nodes", () => {
    const nodes: Bbox[] = [
      { id: "a", x: 100, y: 100, w: 64, h: 64 },
      { id: "b", x: 400, y: 100, w: 64, h: 64 },
    ];
    const grid = buildGrid(nodes, { cellSize: 16, marginCells: 4, clearanceCells: 1 });

    const aCenter = pointToCell(grid, 132, 132);
    const bCenter = pointToCell(grid, 432, 132);

    expect(grid.blockerByCell.get(aCenter.cy * grid.cols + aCenter.cx)).toBe("a");
    expect(grid.blockerByCell.get(bCenter.cy * grid.cols + bCenter.cx)).toBe("b");

    const ids = new Set(grid.blockerByCell.values());
    expect(ids.has("a")).toBe(true);
    expect(ids.has("b")).toBe(true);
  });

  it("returns a tiny 1x1 walkable grid for empty nodes array", () => {
    const grid = buildGrid([]);
    expect(grid.cols).toBe(1);
    expect(grid.rows).toBe(1);
    expect(grid.walkable.length).toBe(1);
    expect(grid.walkable[0]).toBe(1);
    expect(grid.blockerByCell.size).toBe(0);
  });
});

describe("carveOut", () => {
  it("returns a different array than grid.walkable and leaves the original intact", () => {
    const nodes: Bbox[] = [{ id: "a", x: 100, y: 100, w: 80, h: 80 }];
    const grid = buildGrid(nodes, { cellSize: 16, marginCells: 4, clearanceCells: 1 });
    const originalSnapshot = new Uint8Array(grid.walkable);

    const carved = carveOut(grid, ["a"]);
    expect(carved).not.toBe(grid.walkable);
    expect(grid.walkable).toEqual(originalSnapshot);
  });

  it("unblocks exactly the cells whose blocker matches the passed ids", () => {
    const nodes: Bbox[] = [
      { id: "a", x: 100, y: 100, w: 64, h: 64 },
      { id: "b", x: 400, y: 100, w: 64, h: 64 },
    ];
    const grid = buildGrid(nodes, { cellSize: 16, marginCells: 4, clearanceCells: 1 });

    const carved = carveOut(grid, ["a"]);
    for (const [idx, blocker] of grid.blockerByCell) {
      if (blocker === "a") {
        expect(carved[idx]).toBe(1);
      } else {
        expect(carved[idx]).toBe(0);
      }
    }
  });

  it("carves out multiple ids when both passed", () => {
    const nodes: Bbox[] = [
      { id: "a", x: 100, y: 100, w: 64, h: 64 },
      { id: "b", x: 400, y: 100, w: 64, h: 64 },
    ];
    const grid = buildGrid(nodes, { cellSize: 16, marginCells: 4, clearanceCells: 1 });

    const carved = carveOut(grid, ["a", "b"]);
    for (const [idx] of grid.blockerByCell) {
      expect(carved[idx]).toBe(1);
    }
  });
});

describe("pointToCell / cellToPoint", () => {
  it("round-trips approximately within cellSize/2", () => {
    const nodes: Bbox[] = [{ id: "a", x: 100, y: 100, w: 80, h: 80 }];
    const grid = buildGrid(nodes, { cellSize: 16, marginCells: 4, clearanceCells: 1 });

    const samples = [
      { x: 120, y: 130 },
      { x: 200, y: 200 },
      { x: 50, y: 60 },
      { x: 137, y: 89 },
    ];

    for (const p of samples) {
      const cell = pointToCell(grid, p.x, p.y);
      const back = cellToPoint(grid, cell.cx, cell.cy);
      expect(Math.abs(back.x - p.x)).toBeLessThanOrEqual(grid.cellSize / 2);
      expect(Math.abs(back.y - p.y)).toBeLessThanOrEqual(grid.cellSize / 2);
    }
  });

  it("clamps points outside the grid", () => {
    const nodes: Bbox[] = [{ id: "a", x: 100, y: 100, w: 80, h: 80 }];
    const grid = buildGrid(nodes, { cellSize: 16, marginCells: 4, clearanceCells: 1 });

    const tooFarTL = pointToCell(grid, -10000, -10000);
    expect(tooFarTL.cx).toBe(0);
    expect(tooFarTL.cy).toBe(0);

    const tooFarBR = pointToCell(grid, 10000, 10000);
    expect(tooFarBR.cx).toBe(grid.cols - 1);
    expect(tooFarBR.cy).toBe(grid.rows - 1);
  });
});
