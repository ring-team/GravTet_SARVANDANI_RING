/**
 * `useBarnesHutCalculation`: runs Barnes–Hut gravity forward modeling.
 *
 * Posts to the Barnes–Hut endpoint with `barnesHutBuildRequest` and feeds normalized stats to the results UI.
 */
import { useState } from 'react'
import { api, normalizeGravityResponse, type GravityStatsFromFullGrid } from '../../../../services/api'
import { safeMin, safeMax } from '../../lib/gravityArrayStats'
import type { SurfaceBounds } from '../../shared/GravityMapView'
import { barnesHutBuildRequest, type BarnesHutModelParams } from './barnesHutBuildRequest'
import { BARNES_HUT_MAX_RECEIVERS } from './barnesHutConstants'
import { resolveForwardSourceCount } from '../../lib/forwardSourceEstimate'
import { MAX_APPROXIMATE_LOG_SCALED_INTERACTIONS } from '../../lib/forwardApproximateLimits'
import { logScaledInteractionMeasure } from '../../lib/logScaledInteractionMeasure'
import {
  meshDiscretizationFromCatalogModelType,
  syntheticShapeParametersOnly,
} from '../../lib/syntheticPersistSubset'
import { computeDurationPersistFields, resolveForwardModelingTimeMs } from '../../lib/computeDurationPersist'
import {
  buildRunParametersSnapshot,
  type RunParametersSnapshot,
} from '../../lib/runParametersSnapshot'
import { attachGmshServerComputeToGravityBody, attachMeshToGravityBody, buildForwardMeshRequestAsync, ensureGmshMeshGeometryReady, gmshStatsFromSolverMeta } from '../../lib/forwardGravityMeshRequest'
import {
  forwardUsesGmshTetraMeshRequest,
  forwardUsesTetraMeshPayload,
  GMSH_MESH_UNSUPPORTED_SHAPE_MESSAGE,
  isGmshMeshBuildSupported,
  type GmshMeshBuildStats,
} from '../../../synthetic-gravity/lib/gmshMeshSupport'
import { useForwardGravityMapExtent } from '../../shared/ForwardGravityMapExtentContext'
import { forwardRunGeometryKey } from '../../lib/forwardRunGeometryKey'
import type { ForwardRunMeta } from '../../lib/forwardRunMeta'

// --- Hook state / input types ---

export type GravityResponseMetaState = {
  stats: GravityStatsFromFullGrid | null
  mapNx: number | null
  mapNy: number | null
  solverMeta: Record<string, unknown> | null
} | null

export type BarnesHutCalculationInput = BarnesHutModelParams & {
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
  theta0: number
}

// --- Run parameters snapshot (downloaded from Analysis as ``parameters.json``) ---

function buildBarnesHutRunParameters(
  method: string,
  fullGridStats: GravityStatsFromFullGrid | null,
  calculationTimeSnapshot: number | null,
  ctx: BarnesHutCalculationInput,
): RunParametersSnapshot {
  const shape = syntheticShapeParametersOnly(ctx.modelType, ctx)
  const bh = barnesHutBuildRequest({
    model: ctx,
    numSourcesX: ctx.numSourcesX,
    numSourcesY: ctx.numSourcesY,
    numSourcesZ: ctx.numSourcesZ,
    numReceiversX: ctx.numReceiversX,
    numReceiversY: ctx.numReceiversY,
    surfaceBounds: ctx.forwardSurfaceBounds,
    theta0: ctx.theta0,
  })
  const parameters = {
    ...shape,
    meshDiscretization: meshDiscretizationFromCatalogModelType(ctx.modelType),
    modelType: bh.modelType,
    centerX: bh.centerX,
    centerY: bh.centerY,
    centerZ: bh.centerZ,
    numSourcesX: ctx.numSourcesX,
    numSourcesY: ctx.numSourcesY,
    numSourcesZ: ctx.numSourcesZ,
    numReceiversX: ctx.numReceiversX,
    numReceiversY: ctx.numReceiversY,
    surfaceXMin: ctx.forwardSurfaceBounds.xMin,
    surfaceXMax: ctx.forwardSurfaceBounds.xMax,
    surfaceYMin: ctx.forwardSurfaceBounds.yMin,
    surfaceYMax: ctx.forwardSurfaceBounds.yMax,
    surfaceZ: 0,
    theta0: ctx.theta0,
    forwardGravityMethod: 'barnes_hut_plus_advanced_newton',
    ...computeDurationPersistFields(calculationTimeSnapshot),
    gravityResultsCount: ctx.gravityResults.length,
    minGravity:
      ctx.gravityResults.length > 0 ? fullGridStats?.min ?? safeMin(ctx.gravityResults) : 0,
    maxGravity:
      ctx.gravityResults.length > 0 ? fullGridStats?.max ?? safeMax(ctx.gravityResults) : 0,
  }
  return buildRunParametersSnapshot(method, ctx.modelType || 'Unknown', parameters)
}

// --- Main hook: Barnes–Hut API → normalize → optional snapshot ---

export function useBarnesHutCalculation(input: BarnesHutCalculationInput) {
  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [computeMs, setComputeMs] = useState<number | null>(null)
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

  const calculateGravity = async () => {
    if (!input.modelType) {
      setError('Please select a model first')
      return
    }
    if (forwardUsesGmshTetraMeshRequest(input.modelType) && !isGmshMeshBuildSupported(input.modelType)) {
      setError(GMSH_MESH_UNSUPPORTED_SHAPE_MESSAGE)
      return
    }
    const usesMeshPayload = forwardUsesTetraMeshPayload(input.modelType)
    if (!usesMeshPayload || !forwardUsesGmshTetraMeshRequest(input.modelType)) {
      const sourceCount = resolveForwardSourceCount(
        input.modelType,
        input.numSourcesX,
        input.numSourcesY,
        input.numSourcesZ,
        input.gmshCachedElementCount,
      )
      const receiverCount = input.numReceiversX * input.numReceiversY
      if (receiverCount > BARNES_HUT_MAX_RECEIVERS) {
        setError(
          `Too many observation points for Barnes–Hut + Advanced Newton (${receiverCount.toLocaleString()}). ` +
            `Current safety cap is ${BARNES_HUT_MAX_RECEIVERS.toLocaleString()}.`
        )
        return
      }
      if (!forwardUsesGmshTetraMeshRequest(input.modelType)) {
        const eff = logScaledInteractionMeasure(sourceCount, receiverCount)
        const rawPairs = sourceCount * receiverCount
        if (eff > MAX_APPROXIMATE_LOG_SCALED_INTERACTIONS) {
          setError(
            `Too many log-scaled source–receiver workload units for Barnes–Hut + Advanced Newton ` +
              `(effective N·M/log₂N = ${eff.toLocaleString()}; raw N·M = ${rawPairs.toLocaleString()}). ` +
              `Current safety cap is ${MAX_APPROXIMATE_LOG_SCALED_INTERACTIONS.toLocaleString()}. ` +
              'Reduce mesh resolution or the observation grid.'
          )
          return
        }
      }
    }
    setIsCalculating(true)
    setError(null)
    setComputeMs(null)
    setGravityResponseMeta(null)
    setLastRunParametersSnapshot(null)
    input.setGravityResults([])
    input.setCalculationTime(null)
    const startTime = performance.now()
    try {
      if (usesMeshPayload && forwardUsesGmshTetraMeshRequest(input.modelType)) {
        const { stats: warmStats, calculateReady } = await ensureGmshMeshGeometryReady({
          model: input,
          numSourcesX: input.numSourcesX,
          numSourcesY: input.numSourcesY,
          numSourcesZ: input.numSourcesZ,
        })
        if (!calculateReady) {
          throw new Error('Mesh geometry is not ready yet. Wait until mesh preparation finishes, then try again.')
        }
        input.onGmshBuildStatsSet?.(warmStats)
      }
      const body = barnesHutBuildRequest({
        model: input,
        numSourcesX: input.numSourcesX,
        numSourcesY: input.numSourcesY,
        numSourcesZ: input.numSourcesZ,
        numReceiversX: input.numReceiversX,
        numReceiversY: input.numReceiversY,
        surfaceBounds: input.forwardSurfaceBounds,
        theta0: input.theta0,
      })
      const built = usesMeshPayload
        ? await buildForwardMeshRequestAsync({
            model: input,
            numSourcesX: input.numSourcesX,
            numSourcesY: input.numSourcesY,
            numSourcesZ: input.numSourcesZ,
            numReceiversX: input.numReceiversX,
            numReceiversY: input.numReceiversY,
            surfaceBounds: input.forwardSurfaceBounds,
          })
        : null
      const meshRequest = built?.meshRequest ?? null
      const gmshServerComputeBody = built?.gmshServerComputeBody ?? null
      const data = await api.computeGravityBarnesHut(
        gmshServerComputeBody
          ? attachGmshServerComputeToGravityBody(body, gmshServerComputeBody)
          : meshRequest
            ? attachMeshToGravityBody(body, meshRequest)
            : body,
      )
      const {
        results,
        computeMs: backendComputeMs,
        totalMs: backendTotalMs,
        statsFromFullGrid,
        mapNumX,
        mapNumY,
        solverMeta,
      } = normalizeGravityResponse(data)
      const gmshStats = gmshStatsFromSolverMeta(solverMeta)
      if (gmshStats) input.onGmshBuildStatsSet?.(gmshStats)
      setComputeMs(backendComputeMs)
      const totalRequestMs = performance.now() - startTime
      const timeMs =
        usesMeshPayload && forwardUsesGmshTetraMeshRequest(input.modelType)
          ? Math.round(
              typeof backendTotalMs === 'number' && Number.isFinite(backendTotalMs)
                ? Math.max(totalRequestMs, backendTotalMs)
                : totalRequestMs,
            )
          : resolveForwardModelingTimeMs(totalRequestMs, backendComputeMs, backendTotalMs)
      input.setCalculationTime(timeMs)
      input.setGravityResults(results)
      setGravityResponseMeta({
        stats: statsFromFullGrid,
        mapNx: mapNumX,
        mapNy: mapNumY,
        solverMeta,
      })
      if (results.length > 0) {
        setMapExtentFromRun({
          min: statsFromFullGrid?.min ?? safeMin(results),
          max: statsFromFullGrid?.max ?? safeMax(results),
        })
      }
      input.onLastRunNumReceiversSet(input.numReceiversX, input.numReceiversY)
      recordSuccessfulRun(mapNumX, mapNumY)

      if (results.length > 0) {
        const persistCtx: BarnesHutCalculationInput = { ...input, gravityResults: results }
        setLastRunParametersSnapshot(
          buildBarnesHutRunParameters('barnes_hut_plus_advanced_newton', statsFromFullGrid, timeMs, persistCtx),
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsCalculating(false)
    }
  }

  return {
    isCalculating,
    error,
    computeMs,
    gravityResponseMeta,
    fixedMapColorExtent,
    lastRunGeometryKey,
    lastRunParametersSnapshot,
    calculateGravity,
  }
}
