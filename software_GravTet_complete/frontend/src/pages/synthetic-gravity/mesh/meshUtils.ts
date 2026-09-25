/**
 * **Shared mesh helpers** for synthetic gravity wireframes: small geometry ops + surface points.
 *
 * - **Wire inflation** (`inflateSphereWireframeRadial`, `inflateCylinderWireframeXZ`): reduce z-fighting vs solids.
 * - **Face builders** (`addTriangle`, `addPentagon`, …): append indexed line/triangle strips into flat buffers.
 * - **Surfaces** (`sphericalToCartesian`, `ellipsoidSurfacePoint`, `surfaceAngularMeshCountsFromXYZ`): map UI counts → resolutions.
 *
 * Shape-specific wiring lives in `sphereMesh.ts`, `cubeMesh.ts`, etc.; this file is the common toolbox.
 */
import * as THREE from 'three'

// --- Inflate wireframes (reduce z-fighting vs solid mesh) ---

/** Push wireframe vertices slightly past the analytic surface (radial from origin). Reduces z-fighting vs solid mesh. */
export function inflateSphereWireframeRadial(geometry: THREE.BufferGeometry, factor: number): void {
  if (factor <= 1.0000001) return
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute | undefined
  if (!pos) return
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, pos.getX(i) * factor, pos.getY(i) * factor, pos.getZ(i) * factor)
  }
  pos.needsUpdate = true
}

/** Y-up cylinder wireframe: scale XZ for the side surface and nudge cap vertices along +/-Y. */
export function inflateCylinderWireframeXZ(geometry: THREE.BufferGeometry, factor: number): void {
  if (factor <= 1.0000001) return
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute | undefined
  if (!pos) return
  let maxAbsY = 0
  let maxRadius = 0
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    maxAbsY = Math.max(maxAbsY, Math.abs(y))
    maxRadius = Math.max(maxRadius, Math.hypot(x, z))
  }
  const capTolerance = Math.max(1e-6, maxAbsY * 1e-4)
  const capOffset = Math.max(1e-6, maxRadius * (factor - 1))
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    pos.setX(i, x * factor)
    pos.setZ(i, z * factor)
    if (Math.abs(Math.abs(y) - maxAbsY) <= capTolerance) {
      pos.setY(i, y + Math.sign(y || 1) * capOffset)
    }
  }
  pos.needsUpdate = true
}

// --- Indexed polygon helpers (flat position + index buffers) ---

export function addTriangle(
  points: number[],
  indices: number[],
  p1: number[],
  p2: number[],
  p3: number[]
) {
  const startIdx = points.length / 3
  points.push(...p1, ...p2, ...p3)
  indices.push(startIdx, startIdx + 1, startIdx + 1, startIdx + 2, startIdx + 2, startIdx)
}

export function addPentagon(
  points: number[],
  indices: number[],
  center: number[],
  corner1: number[],
  corner2: number[],
  corner3: number[],
  corner4: number[],
  /** When set with `vertexRgb`, appends matching per-vertex RGB (0–1) for line `vertexColors`. */
  colorsOut?: number[] | null,
  vertexRgb?: [number, number, number]
) {
  const baseStartIdx = points.length / 3
  points.push(...corner1, ...corner2, ...corner3, ...corner4)
  if (colorsOut && vertexRgb) {
    for (let q = 0; q < 4; q++) {
      colorsOut.push(vertexRgb[0], vertexRgb[1], vertexRgb[2])
    }
  }

  indices.push(
    baseStartIdx, baseStartIdx + 1,
    baseStartIdx + 1, baseStartIdx + 2,
    baseStartIdx + 2, baseStartIdx + 3,
    baseStartIdx + 3, baseStartIdx
  )

  const centerIdx = points.length / 3
  points.push(...center)
  if (colorsOut && vertexRgb) {
    colorsOut.push(vertexRgb[0], vertexRgb[1], vertexRgb[2])
  }
  indices.push(
    centerIdx, baseStartIdx,
    centerIdx, baseStartIdx + 1,
    centerIdx, baseStartIdx + 2,
    centerIdx, baseStartIdx + 3
  )
}

// --- Analytic surface points (spherical / ellipsoidal) ---

export function sphericalToCartesian(r: number, theta: number, phi: number): number[] {
  const x = r * Math.sin(phi) * Math.cos(theta)
  const y = r * Math.cos(phi)
  const z = r * Math.sin(phi) * Math.sin(theta)
  return [x, y, z]
}

export function ellipsoidSurfacePoint(a: number, b: number, c: number, theta: number, phi: number): number[] {
  const x = a * Math.sin(phi) * Math.cos(theta)
  const y = c * Math.cos(phi)
  const z = b * Math.sin(phi) * Math.sin(theta)
  return [x, y, z]
}

// --- Map UI X/Y/Z counts to angular mesh resolution (sphere / ellipsoid wireframes) ---

/**
 * Forward-model X/Y/Z counts → two surface resolutions for sphere/ellipsoid wireframes.
 *
 * UI meanings (and backend parameter meanings) are:
 * - X → radial (r) density (used here as a global refinement multiplier)
 * - Y → azimuthal angle θ density
 * - Z → polar / colatitude angle φ density
 *
 * Note: the wireframe lives on the object's surface, so r does not add "layers" by itself.
 * Instead we use r as a refinement multiplier for both (θ, φ).
 */
export function surfaceAngularMeshCountsFromXYZ(counts: {
  numSourcesX?: number
  numSourcesY?: number
  numSourcesZ?: number
}): { nx: number; nz: number } {
  const r = Math.max(1, counts.numSourcesX ?? 8)
  const theta = Math.max(2, counts.numSourcesY ?? 24)
  const phi = Math.max(2, counts.numSourcesZ ?? 24)

  // The wireframe is only on the surface, so radial ("r") should not scale
  // the angular resolution too aggressively (unstructured tetra meshes can
  // otherwise explode in size). Use a mild sqrt influence.
  const rScale = 0.7 + 0.3 * Math.sqrt(r / 8) // r=8 => 1.0

  // nx: azimuthal refinement; nz: polar refinement. Floor at 2 so coarse
  // unstructured sliders can actually thin the preview (still enough for a closed loop).
  const nx = Math.max(2, Math.round(theta * rScale))
  const nz = Math.max(2, Math.round(phi * rScale))
  return { nx, nz }
}
