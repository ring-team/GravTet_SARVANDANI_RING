/**
 * Initial-model gravity helpers: `bounds.ts`.
 */

import type { Bounds, InitialModelPrimitive } from './types'

export function computeBounds(primitives: InitialModelPrimitive[]): Bounds {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity

  for (const p of primitives) {
    const halfX = p.sizeX / 2
    const halfY = p.sizeZ / 2
    const halfZ = p.sizeY / 2

    minX = Math.min(minX, p.centerX - halfX)
    maxX = Math.max(maxX, p.centerX + halfX)
    minY = Math.min(minY, p.centerZ - halfY)
    maxY = Math.max(maxY, p.centerZ + halfY)
    minZ = Math.min(minZ, p.centerY - halfZ)
    maxZ = Math.max(maxZ, p.centerY + halfZ)
  }

  minY = Math.min(minY, 0)
  maxY = Math.max(maxY, 0)

  const targetX = (minX + maxX) / 2
  const targetY = (minY + maxY) / 2
  const targetZ = (minZ + maxZ) / 2

  const dx = maxX - minX
  const dy = maxY - minY
  const dz = maxZ - minZ
  const diag = Math.sqrt(dx * dx + dy * dy + dz * dz)
  const radius = Math.max(50, diag / 2)

  return {
    target: [targetX, targetY, targetZ],
    radius,
    minX,
    maxX,
    minY,
    maxY,
    minZ,
    maxZ,
  }
}

export function computeBoundsFromImportedField(field: { xs: number[]; ys: number[]; zGrid: number[][] }): Bounds {
  const { xs, ys, zGrid } = field
  const ny = ys.length
  const nx = xs.length
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity

  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      const depth = zGrid[iy][ix]
      const x = xs[ix]
      const yApp = ys[iy]
      const yThree = -depth
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, yThree)
      maxY = Math.max(maxY, yThree)
      minZ = Math.min(minZ, yApp)
      maxZ = Math.max(maxZ, yApp)
    }
  }

  minY = Math.min(minY, 0)
  maxY = Math.max(maxY, 0)

  const targetX = (minX + maxX) / 2
  const targetY = (minY + maxY) / 2
  const targetZ = (minZ + maxZ) / 2
  const dx = maxX - minX
  const dy = maxY - minY
  const dz = maxZ - minZ
  const diag = Math.sqrt(dx * dx + dy * dy + dz * dz)
  const radius = Math.max(50, diag / 2)

  return {
    target: [targetX, targetY, targetZ],
    radius,
    minX,
    maxX,
    minY,
    maxY,
    minZ,
    maxZ,
  }
}
