/**
 * `useDirectNewtonCalculation`: runs direct Newton gravity forward modeling for the results map.
 *
 * Calls `directNewtonBuildRequest` and the gravity API, then normalizes stats for `GravityResultsView`.
 */
import { useState } from 'react'
import { api, normalizeGravityResponse, type GravityStatsFromFullGrid, type TetraMeshRequest } from '../../../../services/api'
import { safeMin, safeMax } from '../../lib/gravityArrayStats'
import type { SurfaceBounds } from '../../shared/GravityMapView'
import { resolveForwardSourceCount } from '../../lib/forwardSourceEstimate'
import { directNewtonBuildRequest, type DirectNewtonModelParams } from './directNewtonBuildRequest'
import { forwardSolverPersistFields } from './directNewtonPersistMeta'
import { DIRECT_NEWTON_MAX_INTERACTIONS, DIRECT_NEWTON_MAX_RECEIVERS } from './directNewtonConstants'
import {
  meshDiscretizationFromCatalogModelType,
  syntheticShapeParametersOnly,
} from '../../lib/syntheticPersistSubset'
import { computeDurationPersistFields, resolveForwardModelingTimeMs } from '../../lib/computeDurationPersist'
import {
  buildRunParametersSnapshot,
  type RunParametersSnapshot,
} from '../../lib/runParametersSnapshot'
import { buildForwardMeshRequestAsync, gmshStatsFromSolverMeta } from '../../lib/forwardGravityMeshRequest'
import type { GmshMeshBuildStats } from '../../../synthetic-gravity/lib/gmshMeshSupport'
import {
  forwardUsesGmshTetraMeshRequest,
  forwardUsesTetraMeshPayload,
  GMSH_MESH_UNSUPPORTED_SHAPE_MESSAGE,
  isGmshMeshBuildSupported,
} from '../../../synthetic-gravity/lib/gmshMeshSupport'
import { forwardRunGeometryKey } from '../../lib/forwardRunGeometryKey'
import type { ForwardRunMeta } from '../../lib/forwardRunMeta'
import { useForwardGravityMapExtent } from '../../shared/ForwardGravityMapExtentContext'

// --- Hook state / input types ---

export type GravityResponseMetaState = {
  stats: GravityStatsFromFullGrid | null
  mapNx: number | null
  mapNy: number | null
  /** Echo of backend ``solver_meta`` (execution mode, thread count, etc.). */
  solverMeta: Record<string, unknown> | null
} | null

export type DirectNewtonCalculationInput = DirectNewtonModelParams & {
  solverKind?: 'direct_newton' | 'analytical_closedform'
  executionMode: 'reference' | 'tiled' | 'simd_tiled' | 'simd_tiled_threading'
  /** Optional thread count override for simd_tiled_threading execution mode. */
  numThreads?: number
  /** Cache-blocking Br (0 = default). */
  receiverBlockSize?: number
  /** Cache-blocking Bs (0 = default). */
  sourceBlockSize?: number
  numSourcesX: number
  numSourcesY: number
  numSourcesZ: number
  numReceiversX: number
  numReceiversY: number
  forwardSurfaceBounds: SurfaceBounds
  gravityResults: number[]
  setGravityResults: (results: number[]) => void
  calculationTime: number | null
  setCalculationTime: (time: number | null) => void
  onLastRunNumReceiversSet: (x: number, y: number) => void
  onLastRunMetaSet?: (meta: ForwardRunMeta) => void
  onGmshBuildStatsSet?: (stats: GmshMeshBuildStats) => void
  gmshCachedElementCount?: number | null
}

// --- Run parameters snapshot (downloaded from Analysis as ``parameters.json``) ---

function buildDirectNewtonRunParameters(
  method: string,
  fullGridStats: GravityStatsFromFullGrid | null,
  calculationTimeSnapshot: number | null,
  ctx: DirectNewtonCalculationInput,
): RunParametersSnapshot {
  const sk = ctx.solverKind ?? 'direct_newton'
  const shape = syntheticShapeParametersOnly(ctx.modelType, ctx)
  const solverMeta = forwardSolverPersistFields(sk, ctx.executionMode, ctx.numThreads)
  const parameters = {
    meshDiscretization: meshDiscretizationFromCatalogModelType(ctx.modelType),
    forwardSurfaceBounds: {
      xMin: ctx.forwardSurfaceBounds.xMin,
      xMax: ctx.forwardSurfaceBounds.xMax,
      yMin: ctx.forwardSurfaceBounds.yMin,
      yMax: ctx.forwardSurfaceBounds.yMax,
    },
    numSourcesX: ctx.numSourcesX,
    numSourcesY: ctx.numSourcesY,
    numSourcesZ: ctx.numSourcesZ,
    numReceiversX: ctx.numReceiversX,
    numReceiversY: ctx.numReceiversY,
    ...shape,
    ...solverMeta,
    ...computeDurationPersistFields(calculationTimeSnapshot),
    gravityResultsCount: ctx.gravityResults.length,
    minGravity:
      ctx.gravityResults.length > 0 ? fullGridStats?.min ?? safeMin(ctx.gravityResults) : 0,
    maxGravity:
      ctx.gravityResults.length > 0 ? fullGridStats?.max ?? safeMax(ctx.gravityResults) : 0,
  }
  return buildRunParametersSnapshot(method, ctx.modelType || 'Unknown', parameters)
}

function buildDirectNewtonMeshRunParameters(
  meshRequest: TetraMeshRequest,
  ctx: DirectNewtonCalculationInput,
  fullGridStats: GravityStatsFromFullGrid | null,
  calculationTimeSnapshot: number | null,
  gravityResults: number[],
): RunParametersSnapshot {
  const tets = meshRequest.mesh.tets ?? meshRequest.mesh.elements ?? []
  const method = 'direct_newton'
  const meshExec = meshRequest.executionMode ?? ctx.executionMode
  const solverMeta = forwardSolverPersistFields('direct_newton', meshExec, ctx.numThreads)
  const parameters = {
    runKind: 'tetra_mesh_forward',
    meshDiscretization: meshDiscretizationFromCatalogModelType(ctx.modelType),
    analysisMethod: meshRequest.analysisMethod,
    ...solverMeta,
    meshNodeCount: meshRequest.mesh.nodes.length,
    meshElementCount: tets.length,
    numReceiversX: meshRequest.numReceiversX,
    numReceiversY: meshRequest.numReceiversY,
    surfaceXMin: meshRequest.surfaceXMin,
    surfaceXMax: meshRequest.surfaceXMax,
    surfaceYMin: meshRequest.surfaceYMin,
    surfaceYMax: meshRequest.surfaceYMax,
    surfaceZ: meshRequest.surfaceZ,
    ...computeDurationPersistFields(calculationTimeSnapshot),
    gravityResultsCount: gravityResults.length,
    minGravity:
      gravityResults.length > 0 ? fullGridStats?.min ?? safeMin(gravityResults) : 0,
    maxGravity:
      gravityResults.length > 0 ? fullGridStats?.max ?? safeMax(gravityResults) : 0,
  }
  return buildRunParametersSnapshot(method, ctx.modelType || 'Tetrahedral mesh', parameters)
}

function buildDirectNewtonGmshServerRunParameters(
  gmshBody: Record<string, unknown>,
  ctx: DirectNewtonCalculationInput,
  fullGridStats: GravityStatsFromFullGrid | null,
  calculationTimeSnapshot: number | null,
  gravityResults: number[],
  gmshStats: { numNodes: number; numElements: number } | null,
): RunParametersSnapshot {
  const method = 'direct_newton'
  const meshExec =
    (typeof gmshBody.executionMode === 'string'
      ? gmshBody.executionMode
      : ctx.executionMode) as DirectNewtonCalculationInput['executionMode']
  const solverMeta = forwardSolverPersistFields('direct_newton', meshExec, ctx.numThreads)
  const parameters: Record<string, unknown> = {
    runKind: 'tetra_mesh_forward',
    meshDiscretization: meshDiscretizationFromCatalogModelType(ctx.modelType),
    gmshServerMesh: true,
    ...solverMeta,
    numReceiversX: gmshBody.numReceiversX,
    numReceiversY: gmshBody.numReceiversY,
    surfaceXMin: gmshBody.surfaceXMin,
    surfaceXMax: gmshBody.surfaceXMax,
    surfaceYMin: gmshBody.surfaceYMin,
    surfaceYMax: gmshBody.surfaceYMax,
    surfaceZ: gmshBody.surfaceZ,
    ...computeDurationPersistFields(calculationTimeSnapshot),
    gravityResultsCount: gravityResults.length,
    minGravity:
      gravityResults.length > 0 ? fullGridStats?.min ?? safeMin(gravityResults) : 0,
    maxGravity:
      gravityResults.length > 0 ? fullGridStats?.max ?? safeMax(gravityResults) : 0,
  }
  if (gmshBody.targetElementSize != null) parameters.targetElementSize = gmshBody.targetElementSize
  if (gmshBody.surfaceRefinement != null) parameters.surfaceRefinement = gmshBody.surfaceRefinement
  if (gmshBody.localRefinementNearEdges != null) {
    parameters.localRefinementNearEdges = gmshBody.localRefinementNearEdges
  }
  if (gmshStats) {
    parameters.meshNodeCount = gmshStats.numNodes
    parameters.meshElementCount = gmshStats.numElements
  }
  return buildRunParametersSnapshot(method, ctx.modelType || 'Tetrahedral mesh', parameters)
}

// --- Main hook: interaction budget → direct Newton API → optional snapshot ---

export function useDirectNewtonCalculation(input: DirectNewtonCalculationInput) {
  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [computeMs, setComputeMs] = useState<number | null>(null)
  const [numSources, setNumSources] = useState<number | null>(null)
  const [gravityResponseMeta, setGravityResponseMeta] = useState<GravityResponseMetaState>(null)
  const [lastRunGeometryKey, setLastRunGeometryKey] = useState<string | null>(null)
  const [lastRunParametersSnapshot, setLastRunParametersSnapshot] = useState<RunParametersSnapshot | null>(null)
  const { mapExtent: fixedMapColorExtent, setMapExtentFromRun } = useForwardGravityMapExtent()

  const recordSuccessfulRun = (mapNx: number | null, mapNy: number | null) => {
    const geometryKey = forwardRunGeometryKey(
      input,
      input.numSourcesX,
      input.numSourcesY,
      input.numSourcesZ,
      input.forwardSurfaceBounds,
    )
    setLastRunGeometryKey(geometryKey)
    input.onLastRunMetaSet?.({ geometryKey, mapNx, mapNy })
  }

  const recordRunMapExtent = (
    results: number[],
    statsFromFullGrid: GravityStatsFromFullGrid | null,
  ) => {
    if (results.length === 0) return
    setMapExtentFromRun({
      min: statsFromFullGrid?.min ?? safeMin(results),
      max: statsFromFullGrid?.max ?? safeMax(results),
    })
  }

  const calculateGravity = async () => {
    if (!input.modelType) {
      setError('No model selected')
      return
    }
    if (forwardUsesGmshTetraMeshRequest(input.modelType) && !isGmshMeshBuildSupported(input.modelType)) {
      setError(GMSH_MESH_UNSUPPORTED_SHAPE_MESSAGE)
      return
    }
    const isAnalytical = input.solverKind === 'analytical_closedform'
    let meshRequest: TetraMeshRequest | null = null
    let gmshServerComputeBody: Record<string, unknown> | null = null
    if (!isAnalytical && forwardUsesTetraMeshPayload(input.modelType)) {
      setIsCalculating(true)
      setError(null)
      try {
        const built = await buildForwardMeshRequestAsync({
          model: input,
          numSourcesX: input.numSourcesX,
          numSourcesY: input.numSourcesY,
          numSourcesZ: input.numSourcesZ,
          numReceiversX: input.numReceiversX,
          numReceiversY: input.numReceiversY,
          surfaceBounds: input.forwardSurfaceBounds,
          executionMode: input.executionMode,
          numThreads: input.numThreads,
          receiverBlockSize: input.receiverBlockSize,
          sourceBlockSize: input.sourceBlockSize,
        })
        meshRequest = built?.meshRequest ?? null
        gmshServerComputeBody = built?.gmshServerComputeBody ?? null
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Mesh request build failed')
        setIsCalculating(false)
        return
      }
      if (!meshRequest && !gmshServerComputeBody) {
        setError('Failed to build tetrahedral mesh.')
        setIsCalculating(false)
        return
      }
    }
    if (!isAnalytical) {
      const receiverCount = input.numReceiversX * input.numReceiversY
      const sourceCount = meshRequest
        ? (meshRequest.mesh.elements ?? meshRequest.mesh.tets ?? []).length
        : resolveForwardSourceCount(
            input.modelType,
            input.numSourcesX,
            input.numSourcesY,
            input.numSourcesZ,
            input.gmshCachedElementCount,
          )
      const interactionCount = sourceCount * receiverCount
      if (receiverCount > DIRECT_NEWTON_MAX_RECEIVERS) {
        setError(
          `Too many observation points (${receiverCount.toLocaleString()}). ` +
            `Current safety cap is ${DIRECT_NEWTON_MAX_RECEIVERS.toLocaleString()} for Direct Newton in this app mode.`
        )
        setIsCalculating(false)
        return
      }
      if (interactionCount > DIRECT_NEWTON_MAX_INTERACTIONS) {
        setError(
          `Too many source-receiver interactions (${interactionCount.toLocaleString()}). ` +
            `Reduce source or observation points (limit: ${DIRECT_NEWTON_MAX_INTERACTIONS.toLocaleString()}).`
        )
        setIsCalculating(false)
        return
      }
    }

    if (gmshServerComputeBody) {
      await calculateGravityFromServerMeshBody(gmshServerComputeBody)
      return
    }

    if (meshRequest) {
      await calculateGravityFromMesh(meshRequest)
      return
    }

    setIsCalculating(true)
    setError(null)
    setGravityResponseMeta(null)
    input.setGravityResults([])
    input.setCalculationTime(null)
    setComputeMs(null)
    setNumSources(null)
    setLastRunParametersSnapshot(null)

    const startTime = performance.now()
    try {
      const requestBody = directNewtonBuildRequest({
        model: input,
        executionMode: input.executionMode,
        numThreads: input.numThreads,
        receiverBlockSize: input.receiverBlockSize,
        sourceBlockSize: input.sourceBlockSize,
        numSourcesX: input.numSourcesX,
        numSourcesY: input.numSourcesY,
        numSourcesZ: input.numSourcesZ,
        numReceiversX: input.numReceiversX,
        numReceiversY: input.numReceiversY,
        surfaceBounds: input.forwardSurfaceBounds,
      })
      const isAnalytical = input.solverKind === 'analytical_closedform'
      const data = isAnalytical
        ? await api.computeGravityAnalytical(requestBody)
        : await api.computeGravity(requestBody)
      const {
        results,
        computeMs: backendComputeMs,
        totalMs: backendTotalMs,
        statsFromFullGrid,
        mapNumX,
        mapNumY,
        numSources: backendNumSources,
        solverMeta: backendSolverMeta,
      } = normalizeGravityResponse(data)
      setComputeMs(backendComputeMs)
      setNumSources(backendNumSources)
      const totalRequestMs = performance.now() - startTime
      const modelComputeMs = resolveForwardModelingTimeMs(totalRequestMs, backendComputeMs, backendTotalMs)
      input.setCalculationTime(modelComputeMs)
      input.setGravityResults(results)
      setGravityResponseMeta({
        stats: statsFromFullGrid,
        mapNx: mapNumX,
        mapNy: mapNumY,
        solverMeta: backendSolverMeta,
      })
      recordRunMapExtent(results, statsFromFullGrid)
      recordSuccessfulRun(mapNumX, mapNumY)
      input.onLastRunNumReceiversSet(input.numReceiversX, input.numReceiversY)

      if (results.length > 0) {
        const persistMethod =
          input.solverKind === 'analytical_closedform'
            ? 'analytical_closedform'
            : 'direct_newton'
        const persistCtx: DirectNewtonCalculationInput = { ...input, gravityResults: results }
        setLastRunParametersSnapshot(
          buildDirectNewtonRunParameters(persistMethod, statsFromFullGrid, modelComputeMs, persistCtx),
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Gravity calculation error:', err)
    } finally {
      setIsCalculating(false)
    }
  }

  const calculateGravityFromServerMeshBody = async (body: Record<string, unknown>) => {
    setIsCalculating(true)
    setError(null)
    setGravityResponseMeta(null)
    input.setGravityResults([])
    input.setCalculationTime(null)
    setComputeMs(null)
    setNumSources(null)
    setLastRunParametersSnapshot(null)
    const startTime = performance.now()
    try {
      const data = await api.computeGravityMeshDirect(body)
      const {
        results,
        computeMs: backendComputeMs,
        totalMs: backendTotalMs,
        statsFromFullGrid,
        mapNumX,
        mapNumY,
        numSources: backendNumSources,
        solverMeta: backendSolverMeta,
      } = normalizeGravityResponse(data)
      const gmshStats = gmshStatsFromSolverMeta(backendSolverMeta)
      if (gmshStats) input.onGmshBuildStatsSet?.(gmshStats)
      setComputeMs(backendComputeMs)
      setNumSources(backendNumSources)
      const totalRequestMs = performance.now() - startTime
      const modelComputeMs = resolveForwardModelingTimeMs(totalRequestMs, backendComputeMs, backendTotalMs)
      input.setCalculationTime(modelComputeMs)
      input.setGravityResults(results)
      setGravityResponseMeta({
        stats: statsFromFullGrid,
        mapNx: mapNumX,
        mapNy: mapNumY,
        solverMeta: backendSolverMeta,
      })
      recordRunMapExtent(results, statsFromFullGrid)
      recordSuccessfulRun(mapNumX, mapNumY)
      input.onLastRunNumReceiversSet(input.numReceiversX, input.numReceiversY)

      if (results.length > 0) {
        setLastRunParametersSnapshot(
          buildDirectNewtonGmshServerRunParameters(
            body,
            input,
            statsFromFullGrid,
            modelComputeMs,
            results,
            gmshStats,
          ),
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Gmsh mesh gravity calculation error:', err)
    } finally {
      setIsCalculating(false)
    }
  }

  const calculateGravityFromMesh = async (meshRequest: TetraMeshRequest) => {
    const tets = meshRequest.mesh.tets ?? meshRequest.mesh.elements ?? []
    const sourceCount = tets.length
    const receiverCount = meshRequest.numReceiversX * meshRequest.numReceiversY
    const interactionCount = sourceCount * receiverCount
    if (receiverCount > DIRECT_NEWTON_MAX_RECEIVERS) {
      setError(
        `Too many observation points (${receiverCount.toLocaleString()}). ` +
          `Current safety cap is ${DIRECT_NEWTON_MAX_RECEIVERS.toLocaleString()}.`
      )
      setIsCalculating(false)
      return
    }
    if (interactionCount > DIRECT_NEWTON_MAX_INTERACTIONS) {
      setError(
        `Too many tetra–receiver interactions (${interactionCount.toLocaleString()}). ` +
          `Reduce mesh resolution or the observation grid (limit: ${DIRECT_NEWTON_MAX_INTERACTIONS.toLocaleString()}). ` +
          `For unstructured models, prefer the Quadrature second-order tab.`
      )
      setIsCalculating(false)
      return
    }
    setIsCalculating(true)
    setError(null)
    setGravityResponseMeta(null)
    input.setGravityResults([])
    input.setCalculationTime(null)
    setComputeMs(null)
    setNumSources(null)
    setLastRunParametersSnapshot(null)
    const startTime = performance.now()
    try {
      const data = await api.computeGravityMeshDirect(meshRequest)
      const {
        results,
        computeMs: backendComputeMs,
        totalMs: backendTotalMs,
        statsFromFullGrid,
        mapNumX,
        mapNumY,
        numSources: backendNumSources,
        solverMeta: backendSolverMeta,
      } = normalizeGravityResponse(data)
      setComputeMs(backendComputeMs)
      setNumSources(backendNumSources)
      const totalRequestMs = performance.now() - startTime
      const modelComputeMs = resolveForwardModelingTimeMs(totalRequestMs, backendComputeMs, backendTotalMs)
      input.setCalculationTime(modelComputeMs)
      input.setGravityResults(results)
      setGravityResponseMeta({
        stats: statsFromFullGrid,
        mapNx: mapNumX,
        mapNy: mapNumY,
        solverMeta: backendSolverMeta,
      })
      recordRunMapExtent(results, statsFromFullGrid)
      recordSuccessfulRun(mapNumX, mapNumY)
      input.onLastRunNumReceiversSet(meshRequest.numReceiversX, meshRequest.numReceiversY)

      if (results.length > 0) {
        setLastRunParametersSnapshot(
          buildDirectNewtonMeshRunParameters(meshRequest, input, statsFromFullGrid, modelComputeMs, results),
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Mesh gravity calculation error:', err)
    } finally {
      setIsCalculating(false)
    }
  }

  return {
    isCalculating,
    error,
    computeMs,
    numSources,
    gravityResponseMeta,
    fixedMapColorExtent,
    lastRunGeometryKey,
    lastRunParametersSnapshot,
    calculateGravity,
    calculateGravityFromMesh,
  }
}
