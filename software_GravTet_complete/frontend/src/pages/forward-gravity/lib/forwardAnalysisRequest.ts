import type { TetraMeshRequest } from '../../../services/api'
import type { ForwardModelParams } from './forwardModelParams'
import type { SurfaceBounds } from '../shared/GravityMapView'
import { attachGmshServerComputeToGravityBody, attachMeshToGravityBody, buildForwardMeshRequestAsync } from './forwardGravityMeshRequest'
import type { GmshMeshBuildStats } from '../../synthetic-gravity/lib/gmshMeshSupport'

/** Analysis POST body: attach tet mesh + map grid metadata so backend compares the displayed field. */
export async function buildForwardGravityAnalysisBodyAsync<T extends Record<string, unknown>>(
  body: T,
  input: {
    model: ForwardModelParams
    numSourcesX: number
    numSourcesY: number
    numSourcesZ: number
    numReceiversX: number
    numReceiversY: number
    surfaceBounds: SurfaceBounds
    executionMode?: TetraMeshRequest['executionMode']
    numThreads?: number
    receiverBlockSize?: number
    sourceBlockSize?: number
    simdLanes?: number
    candidateResults: number[]
    mapNumX?: number | null
    mapNumY?: number | null
    onGmshBuildStatsSet?: (stats: GmshMeshBuildStats) => void
  },
): Promise<T & Record<string, unknown>> {
  const withCandidate: Record<string, unknown> = {
    ...body,
    candidateResults: input.candidateResults,
  }
  if (input.mapNumX != null && input.mapNumX > 0) {
    withCandidate.mapNumX = input.mapNumX
  }
  if (input.mapNumY != null && input.mapNumY > 0) {
    withCandidate.mapNumY = input.mapNumY
  }

  const built = await buildForwardMeshRequestAsync({
    model: input.model,
    numSourcesX: input.numSourcesX,
    numSourcesY: input.numSourcesY,
    numSourcesZ: input.numSourcesZ,
    numReceiversX: input.numReceiversX,
    numReceiversY: input.numReceiversY,
    surfaceBounds: input.surfaceBounds,
    executionMode: input.executionMode,
    numThreads: input.numThreads,
    receiverBlockSize: input.receiverBlockSize,
    sourceBlockSize: input.sourceBlockSize,
    simdLanes: input.simdLanes,
  })
  if (built?.gmshServerComputeBody) {
    return attachGmshServerComputeToGravityBody(withCandidate, built.gmshServerComputeBody) as T & Record<string, unknown>
  }
  if (!built?.meshRequest) return withCandidate as T & Record<string, unknown>
  return attachMeshToGravityBody(withCandidate, built.meshRequest) as T & Record<string, unknown>
}
