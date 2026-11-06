import { estimateMeshElementCount } from '../../synthetic-gravity/lib/tetraMeshSourceEstimate'
import { forwardUsesGmshTetraMeshRequest } from '../../synthetic-gravity/lib/gmshMeshSupport'

/** Shared source-count estimate used by forward solvers before sending a request. */
export function estimateForwardSourceCount(
  modelType: string | null,
  numSourcesX: number,
  numSourcesY: number,
  numSourcesZ: number,
) {
  return estimateMeshElementCount(modelType, numSourcesX, numSourcesY, numSourcesZ)
}

/** Prefer cached Gmsh element count from the synthetic page; never recount on forward tabs. */
export function resolveForwardSourceCount(
  modelType: string | null,
  numSourcesX: number,
  numSourcesY: number,
  numSourcesZ: number,
  gmshElementCount?: number | null,
): number {
  if (
    modelType &&
    forwardUsesGmshTetraMeshRequest(modelType) &&
    typeof gmshElementCount === 'number' &&
    gmshElementCount > 0
  ) {
    return gmshElementCount
  }
  return estimateForwardSourceCount(modelType, numSourcesX, numSourcesY, numSourcesZ)
}
