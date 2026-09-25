import type { SurfaceBounds } from '../lib/surfaceBounds'
import { horizontalHalfExtentsFromSurfaceBounds } from '../lib/surfaceBounds'

export const SYNTHETIC_MODEL_CAMERA_FOV = 50
export const SYNTHETIC_MODEL_CAMERA_NEAR = 0.1

/** Horizontal half-extent used for axis length (matches `AxesHelper3D`). */
export function syntheticModelViewHalfExtent(
  sizeX: number,
  sizeY: number,
  surfaceBounds?: SurfaceBounds,
): number {
  if (surfaceBounds) {
    const { halfX, halfY } = horizontalHalfExtentsFromSurfaceBounds(surfaceBounds)
    return Math.max(halfX, halfY)
  }
  return Math.max(sizeX, sizeY) * 1.5
}

export function syntheticModelCameraDistance(halfExtent: number): number {
  // Pull back enough to frame axes + subsurface box with margin (publication default).
  return Math.max(580, halfExtent * 2.2)
}

/**
 * Side-front view: X horizontal, Y (Three.js Z) toward viewer, Z (Three.js Y) vertical.
 * Camera at eye level beside the model (minimal elevation, not from above).
 */
export function syntheticModelCameraPosition(halfExtent: number): [number, number, number] {
  const d = syntheticModelCameraDistance(halfExtent)
  return [0, d * 0.12, d]
}

export function syntheticModelDefaultCamera(halfExtent: number) {
  const d = syntheticModelCameraDistance(halfExtent)
  return {
    position: syntheticModelCameraPosition(halfExtent),
    fov: SYNTHETIC_MODEL_CAMERA_FOV,
    far: Math.max(2_000_000, d * 20),
    near: SYNTHETIC_MODEL_CAMERA_NEAR,
  }
}
