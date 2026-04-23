export interface Cell {
  cx: number;
  cy: number;
}

export interface AStarInput {
  cols: number;
  rows: number;
  walkable: Uint8Array;
  start: Cell;
  end: Cell;
  extraCost?: Map<number, number>;
  turnPenalty?: number;
}

const DIR_NONE = 0;

const DX = [0, 1, -1, 0, 0];
const DY = [0, 0, 0, -1, 1];

class MinHeap {
  private nodes: number[] = [];
  private fs: number[] = [];

  size(): number {
    return this.nodes.length;
  }

  push(node: number, f: number): void {
    this.nodes.push(node);
    this.fs.push(f);
    this.bubbleUp(this.nodes.length - 1);
  }

  pop(): number {
    const top = this.nodes[0];
    const last = this.nodes.length - 1;
    if (last > 0) {
      this.nodes[0] = this.nodes[last];
      this.fs[0] = this.fs[last];
    }
    this.nodes.pop();
    this.fs.pop();
    if (this.nodes.length > 0) this.sinkDown(0);
    return top;
  }

  private bubbleUp(i: number): void {
    const nodes = this.nodes;
    const fs = this.fs;
    const node = nodes[i];
    const f = fs[i];
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (fs[parent] <= f) break;
      nodes[i] = nodes[parent];
      fs[i] = fs[parent];
      i = parent;
    }
    nodes[i] = node;
    fs[i] = f;
  }

  private sinkDown(i: number): void {
    const nodes = this.nodes;
    const fs = this.fs;
    const len = nodes.length;
    const node = nodes[i];
    const f = fs[i];
    while (true) {
      const l = 2 * i + 1;
      const r = l + 1;
      let smallest = i;
      let smallestF = f;
      if (l < len && fs[l] < smallestF) {
        smallest = l;
        smallestF = fs[l];
      }
      if (r < len && fs[r] < smallestF) {
        smallest = r;
        smallestF = fs[r];
      }
      if (smallest === i) break;
      nodes[i] = nodes[smallest];
      fs[i] = fs[smallest];
      i = smallest;
    }
    nodes[i] = node;
    fs[i] = f;
  }
}

export function aStar(input: AStarInput): Cell[] | null {
  const { cols, rows, walkable, start, end } = input;
  const turnPenalty = input.turnPenalty ?? 5;
  const extraCost = input.extraCost;

  const startIdx = start.cy * cols + start.cx;
  const endIdx = end.cy * cols + end.cx;

  if (startIdx === endIdx) {
    return [{ cx: start.cx, cy: start.cy }];
  }

  if (
    start.cx < 0 || start.cx >= cols || start.cy < 0 || start.cy >= rows ||
    end.cx < 0 || end.cx >= cols || end.cy < 0 || end.cy >= rows
  ) {
    return null;
  }

  const total = cols * rows;
  const gScore = new Float64Array(total);
  const closed = new Uint8Array(total);
  const opened = new Uint8Array(total);
  const parent = new Int32Array(total);
  const dirFrom = new Uint8Array(total);

  for (let i = 0; i < total; i++) gScore[i] = Infinity;

  gScore[startIdx] = 0;
  parent[startIdx] = -1;
  dirFrom[startIdx] = DIR_NONE;

  const heap = new MinHeap();
  const hStart = Math.abs(start.cx - end.cx) + Math.abs(start.cy - end.cy);
  heap.push(startIdx, hStart);
  opened[startIdx] = 1;

  while (heap.size() > 0) {
    const current = heap.pop();
    if (current === endIdx) {
      const path: Cell[] = [];
      let n = current;
      while (n !== -1) {
        path.push({ cx: n % cols, cy: (n / cols) | 0 });
        n = parent[n];
      }
      path.reverse();
      return path;
    }

    if (closed[current]) continue;
    closed[current] = 1;

    const cx = current % cols;
    const cy = (current / cols) | 0;
    const curG = gScore[current];
    const incomingDir = dirFrom[current];

    for (let d = 1; d <= 4; d++) {
      const nx = cx + DX[d];
      const ny = cy + DY[d];
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      const nIdx = ny * cols + nx;
      if (closed[nIdx]) continue;

      const isEndpoint = nIdx === endIdx || nIdx === startIdx;
      if (!isEndpoint && walkable[nIdx] === 0) continue;

      let stepCost = 1;
      if (extraCost !== undefined) {
        const ec = extraCost.get(nIdx);
        if (ec !== undefined) stepCost += ec;
      }
      if (incomingDir !== DIR_NONE && incomingDir !== d) {
        stepCost += turnPenalty;
      }

      const tentativeG = curG + stepCost;
      if (tentativeG < gScore[nIdx]) {
        gScore[nIdx] = tentativeG;
        parent[nIdx] = current;
        dirFrom[nIdx] = d;
        const h = Math.abs(nx - end.cx) + Math.abs(ny - end.cy);
        heap.push(nIdx, tentativeG + h);
        opened[nIdx] = 1;
      }
    }
  }

  return null;
}
