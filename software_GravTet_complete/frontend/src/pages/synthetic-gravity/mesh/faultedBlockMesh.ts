/**
 * Faulted-block wireframe builder.
 *
 * The faulted model is rendered as two half-block meshes in `FaultedBlockModel3DView`.
 * This file keeps a dedicated per-object mesh entry point, consistent with other objects.
 */
import * as THREE from 'three'
import type { CubeWireStyle } from '../default_data/defaultSources'
import { createCuboidWireframe } from './cuboidMesh'

export function createFaultedBlockWireframe(
  x: number,
  y: number,
  z: number,
  counts: any,
  wireStyle: CubeWireStyle,
  colorTsWireframe = false
): THREE.BufferGeometry {
  return createCuboidWireframe(x, y, z, counts, wireStyle, colorTsWireframe)
}
