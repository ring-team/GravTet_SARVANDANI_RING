/**
 * Initial-model gravity helpers: `math.ts`.
 */

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

export function lerp1d(arr: number[], p: number): number {
  const n = arr.length
  if (n === 0) return 0
  if (n === 1) return arr[0]
  const maxI = n - 1
  const x = clamp(p, 0, maxI)
  const i0 = Math.floor(x)
  const i1 = Math.min(i0 + 1, maxI)
  const tf = x - i0
  return arr[i0] * (1 - tf) + arr[i1] * tf
}

/** Bilinear sample on zGrid[iy][ix]; (fx,fy) in [0,1] maps to grid corners. */
export function bilinearZ(zGrid: number[][], nx: number, ny: number, fx: number, fy: number): number {
  const u = clamp(fx, 0, 1) * (nx - 1)
  const v = clamp(fy, 0, 1) * (ny - 1)
  const ix0 = Math.floor(u)
  const iy0 = Math.floor(v)
  const ix1 = Math.min(ix0 + 1, nx - 1)
  const iy1 = Math.min(iy0 + 1, ny - 1)
  const tx = u - ix0
  const ty = v - iy0
  const z00 = zGrid[iy0][ix0]
  const z10 = zGrid[iy0][ix1]
  const z01 = zGrid[iy1][ix0]
  const z11 = zGrid[iy1][ix1]
  const z0 = z00 * (1 - tx) + z10 * tx
  const z1 = z01 * (1 - tx) + z11 * tx
  return z0 * (1 - ty) + z1 * ty
}

export function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16)
}

export function formatAnomalyTick(v: number): string {
  const a = Math.abs(v)
  if (!Number.isFinite(v)) return '—'
  if (a >= 1e6 || (a > 0 && a < 1e-4)) return v.toExponential(2)
  if (a >= 1000) return v.toFixed(1)
  if (a >= 10) return v.toFixed(2)
  if (a >= 1) return v.toFixed(3)
  return v.toFixed(4)
}
