import type { SurfaceBounds } from '../lib/surfaceBounds'

/**
 * Matches `generate_surface_receivers` (C++) row-major grid on the observation surface.
 * Returns Three.js positions: X = backend X, Y = surface height, Z = backend Y.
 */
export function buildSurfaceReceiverPositionsThreeJs(
  numReceiversX: number,
  numReceiversY: number,
  bounds: SurfaceBounds,
  surfaceY = 0.05,
): Float32Array {
  const nx = Math.max(1, Math.round(numReceiversX))
  const ny = Math.max(1, Math.round(numReceiversY))
  const dx = nx > 1 ? (bounds.xMax - bounds.xMin) / (nx - 1) : 0
  const dy = ny > 1 ? (bounds.yMax - bounds.yMin) / (ny - 1) : 0
  const out = new Float32Array(nx * ny * 3)
  let p = 0
  for (let i = 0; i < nx; i++) {
    const bx = bounds.xMin + i * dx
    for (let j = 0; j < ny; j++) {
      const by = bounds.yMin + j * dy
      out[p++] = bx
      out[p++] = surfaceY
      out[p++] = by
    }
  }
  return out
}
