/** Fixed forward-gravity map colorbar extent (mGal), independent of mesh source count. */

export type GravityMapExtent = { min: number; max: number }

export function padGravityMapExtent(min: number, max: number, padFraction = 0.03): GravityMapExtent {
  const span = max - min
  const pad =
    span > 0
      ? span * padFraction
      : Math.max(1e-9, Math.abs(max) * 0.05, Math.abs(min) * 0.05, 0.01)
  // Synthetic forward maps are non-negative at the observation surface; do not pad below zero.
  const paddedMin = min - pad
  return {
    min: min >= 0 ? Math.max(0, paddedMin) : paddedMin,
    max: max + pad,
  }
}

export function mergeGravityMapExtent(
  prev: GravityMapExtent | null,
  stats: { min: number; max: number },
): GravityMapExtent {
  if (!Number.isFinite(stats.min) || !Number.isFinite(stats.max)) return prev ?? { min: 0, max: 1 }
  if (!prev) return { min: stats.min, max: stats.max }
  return {
    min: Math.min(prev.min, stats.min),
    max: Math.max(prev.max, stats.max),
  }
}
