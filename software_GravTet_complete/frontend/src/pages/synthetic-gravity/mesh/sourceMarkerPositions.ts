/**
 * Forward-model source marker positions: 3D sample points aligned with backend hexahedral layouts.
 *
 * Maps `CountSet` grids to `Float32Array` positions in Three.js Y-up space (with axis swaps noted per shape).
 */
import type { CountSet } from '../default_data/defaultSources'

/**
 * Volume source positions matching `gravity_sources_hexahedral.cpp`, then mapped to Three.js
 * (Y-up, geology depth on **Y**). Backend sphere uses **Z** as polar axis; we reorder to match
 * `sphericalToCartesian` / ellipsoid mesh conventions: `(tx, ty, tz) = (sx, sz, sy)`.
 */
export function getSphereVolumeSourcePositions(radius: number, counts: CountSet): Float32Array {
  const nr = Math.max(1, Math.round(counts.numSourcesX ?? 8))
  const nTheta = Math.max(1, Math.round(counts.numSourcesY ?? 24))
  const nPhi = Math.max(1, Math.round(counts.numSourcesZ ?? 24))

  const dr = radius / nr
  const dtheta = (2 * Math.PI) / nTheta
  const dphi = Math.PI / nPhi

  const pts: number[] = []
  for (let i = 0; i < nr; i++) {
    const rInner = i * dr
    const rOuter = (i + 1) * dr
    const rAvg = (rInner + rOuter) / 2

    for (let j = 0; j < nTheta; j++) {
      const theta = j * dtheta
      for (let k = 0; k < nPhi; k++) {
        const phi = k * dphi + dphi / 2
        const sx = rAvg * Math.sin(phi) * Math.cos(theta)
        const sy = rAvg * Math.sin(phi) * Math.sin(theta)
        const sz = rAvg * Math.cos(phi)
        pts.push(sx, sz, sy)
      }
    }
  }
  return new Float32Array(pts)
}

/**
 * Same as `generate_ellipsoid_sources_hexahedral`: AABB grid, keep voxels inside the ellipsoid.
 * Semiaxes `(a,b,c)` follow the backend: X / Y / Z; map to Three.js `(bx, bz, by)` for mesh.
 */
export function getEllipsoidVolumeSourcePositions(a: number, b: number, c: number, counts: CountSet): Float32Array {
  const nx = Math.max(1, Math.round(counts.numSourcesX ?? 8))
  const ny = Math.max(1, Math.round(counts.numSourcesY ?? 8))
  const nz = Math.max(1, Math.round(counts.numSourcesZ ?? 8))

  const dx = (2 * a) / nx
  const dy = (2 * b) / ny
  const dz = (2 * c) / nz

  const pts: number[] = []
  for (let i = 0; i < nx; i++) {
    const bx = -a + dx / 2 + i * dx
    for (let j = 0; j < ny; j++) {
      const by = -b + dy / 2 + j * dy
      for (let k = 0; k < nz; k++) {
        const bz = -c + dz / 2 + k * dz
        const norm = (bx / a) ** 2 + (by / b) ** 2 + (bz / c) ** 2
        if (norm <= 1) {
          pts.push(bx, bz, by)
        }
      }
    }
  }
  return new Float32Array(pts)
}

/**
 * Forward-model source locations for preview markers (Blue / ts display).
 * Matches axis-aligned box convention in `cubeMesh.ts`: [x, depth, horizontal] with spans x, z, y.
 */
export function getCubeCuboidSourcePositions(
  x: number,
  y: number,
  z: number,
  nx: number,
  ny: number,
  nz: number
): Float32Array {
  const dx = x / nx
  const dy = y / ny
  const dz = z / nz
  const n = nx * ny * nz
  const out = new Float32Array(n * 3)
  let p = 0
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      for (let k = 0; k < ny; k++) {
        out[p++] = -x / 2 + (i + 0.5) * dx
        out[p++] = -z / 2 + (j + 0.5) * dz
        out[p++] = -y / 2 + (k + 0.5) * dy
      }
    }
  }
  return out
}

/**
 * Matches `generate_faulted_block_sources_hexahedral`: split at x=0, right block depth shifted by faultOffset.
 * Three.js local coords: (x, depth, horizontal) with spans (sizeX, sizeZ, sizeY).
 */
export function getFaultedBlockVolumeSourcePositions(
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  faultOffset: number,
  nx: number,
  ny: number,
  nz: number,
): Float32Array {
  const dx = sizeX / nx
  const dy = sizeY / ny
  const dz = sizeZ / nz
  const n = nx * ny * nz
  const out = new Float32Array(n * 3)
  let p = 0
  for (let i = 0; i < nx; i++) {
    const tx = -sizeX / 2 + (i + 0.5) * dx
    const leftBlock = tx < 0
    for (let j = 0; j < nz; j++) {
      const tyBase = -sizeZ / 2 + (j + 0.5) * dz
      const ty = leftBlock ? tyBase : tyBase - faultOffset
      for (let k = 0; k < ny; k++) {
        out[p++] = tx
        out[p++] = ty
        out[p++] = -sizeY / 2 + (k + 0.5) * dy
      }
    }
  }
  return out
}

/**
 * Volume cell centers; same as `generate_vertical_cylinder_sources_hexahedral` with
 * `(x,y,z)_three = (x_b, z_b, y_b)` so horizontal plane is XZ and depth is Y (matches mesh).
 */
export function getVerticalCylinderVolumeSourcePositions(
  radius: number,
  height: number,
  nRadial: number,
  nTheta: number,
  nZ: number
): Float32Array {
  const dr = radius / nRadial
  const dtheta = (2 * Math.PI) / nTheta
  const dz = height / nZ
  const n = nRadial * nTheta * nZ
  const out = new Float32Array(n * 3)
  let p = 0
  for (let i = 0; i < nRadial; i++) {
    const rAvg = (i + 0.5) * dr
    for (let j = 0; j < nTheta; j++) {
      const theta = j * dtheta
      const cx = rAvg * Math.cos(theta)
      const cz = rAvg * Math.sin(theta)
      for (let k = 0; k < nZ; k++) {
        const cy = -height / 2 + dz / 2 + k * dz
        out[p++] = cx
        out[p++] = cy
        out[p++] = cz
      }
    }
  }
  return out
}

/** Local frame matches `cylinderHorizontalMesh.ts` (axis along Y); parent `MeshWireframe` applies rotation. */
export function getHorizontalCylinderVolumeSourcePositions(
  radius: number,
  length: number,
  nRadial: number,
  nTheta: number,
  nLength: number
): Float32Array {
  const dr = radius / nRadial
  const dtheta = (2 * Math.PI) / nTheta
  const dl = length / nLength
  const n = nRadial * nTheta * nLength
  const out = new Float32Array(n * 3)
  let p = 0
  for (let i = 0; i < nRadial; i++) {
    const rAvg = (i + 0.5) * dr
    for (let j = 0; j < nTheta; j++) {
      const theta = j * dtheta
      const lx = rAvg * Math.cos(theta)
      const lz = rAvg * Math.sin(theta)
      for (let k = 0; k < nLength; k++) {
        const ly = -length / 2 + dl / 2 + k * dl
        out[p++] = lx
        out[p++] = ly
        out[p++] = lz
      }
    }
  }
  return out
}

export function getFourCubesSourcePositions(
  cube1X: number,
  cube1Y: number,
  cube1Z: number,
  cube1H: number,
  cube2X: number,
  cube2Y: number,
  cube2Z: number,
  cube2H: number,
  cube3X: number,
  cube3Y: number,
  cube3Z: number,
  cube3H: number,
  cube4X: number,
  cube4Y: number,
  cube4Z: number,
  cube4H: number,
  spacingX: number,
  spacingY: number,
  cube1OffsetX: number,
  cube1OffsetY: number,
  cube2OffsetX: number,
  cube2OffsetY: number,
  cube3OffsetX: number,
  cube3OffsetY: number,
  cube4OffsetX: number,
  cube4OffsetY: number,
  nx: number,
  ny: number,
  nz: number
): Float32Array {
  const cubePositions: [number, number, number][] = [
    [-spacingX / 2 + cube1OffsetX, 0, -spacingY / 2 + cube1OffsetY],
    [spacingX / 2 + cube2OffsetX, 0, -spacingY / 2 + cube2OffsetY],
    [-spacingX / 2 + cube3OffsetX, 0, spacingY / 2 + cube3OffsetY],
    [spacingX / 2 + cube4OffsetX, 0, spacingY / 2 + cube4OffsetY],
  ]
  const cubeParams = [
    { x: cube1X, y: cube1Y, z: cube1Z, h: cube1H },
    { x: cube2X, y: cube2Y, z: cube2Z, h: cube2H },
    { x: cube3X, y: cube3Y, z: cube3Z, h: cube3H },
    { x: cube4X, y: cube4Y, z: cube4Z, h: cube4H },
  ]
  const per = nx * ny * nz
  const out = new Float32Array(per * 4 * 3)
  let p = 0
  for (let cubeIdx = 0; cubeIdx < 4; cubeIdx++) {
    const pos = cubePositions[cubeIdx]
    const { x, y, z, h } = cubeParams[cubeIdx]
    const centerY = -h - z / 2
    const local = getCubeCuboidSourcePositions(x, y, z, nx, ny, nz)
    for (let i = 0; i < local.length; i += 3) {
      out[p++] = local[i] + pos[0]
      out[p++] = local[i + 1] + centerY
      out[p++] = local[i + 2] + pos[2]
    }
  }
  return out
}
