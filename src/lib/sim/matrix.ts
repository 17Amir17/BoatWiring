/**
 * Dense Gaussian elimination with partial pivoting.
 * Solves A·x = b where A is n×n. Mutates inputs.
 * Returns null when the system is singular (no current path / floating node).
 */
export function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  if (n === 0) return [];
  for (let i = 0; i < n; i++) {
    let pivotRow = i;
    let pivotVal = Math.abs(A[i][i]);
    for (let k = i + 1; k < n; k++) {
      const v = Math.abs(A[k][i]);
      if (v > pivotVal) {
        pivotVal = v;
        pivotRow = k;
      }
    }
    if (pivotVal < 1e-14) return null;
    if (pivotRow !== i) {
      [A[i], A[pivotRow]] = [A[pivotRow], A[i]];
      [b[i], b[pivotRow]] = [b[pivotRow], b[i]];
    }
    const piv = A[i][i];
    for (let k = i + 1; k < n; k++) {
      const factor = A[k][i] / piv;
      if (factor === 0) continue;
      for (let j = i; j < n; j++) A[k][j] -= factor * A[i][j];
      b[k] -= factor * b[i];
    }
  }
  const x = new Array<number>(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = b[i];
    for (let j = i + 1; j < n; j++) sum -= A[i][j] * x[j];
    x[i] = sum / A[i][i];
  }
  return x;
}

export function zeros(n: number): number[][] {
  const out: number[][] = new Array(n);
  for (let i = 0; i < n; i++) out[i] = new Array<number>(n).fill(0);
  return out;
}
