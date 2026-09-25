/**
 * `useAmfmCalculation`: runs AMFM gravity forward modeling via the API and tracks stats for the view.
 *
 * Wires `amfmBuildRequest` to `api.gravityAmfm`, normalizes responses, and exposes run/clear/save handlers for the view.
 */
import { useState } from 'react'
import { api, normalizeGravityResponse, type GravityStatsFromFullGrid } from '../../../../services/api'
import { safeMin, safeMax } from '../../lib/gravityArrayStats'
import type { SurfaceBounds } from '../../shared/GravityMapView'
import { amfmBuildRequest, type AmfmModelParams } from './amfmBuildRequest'
import { resolveForwardSourceCount } from '../../lib/forwardSourceEstimate'
import { AMFM_MAX_RECEIVERS, AMFM_MAX_LOG_SCALED_INTERACTIONS } from './amfmConstants'
import { logScaledInteractionMeasure } from '../../lib/logScaledInteractionMeasure'
import {
  meshDiscretizationFromCatalogModelType,
  syntheticShapeParametersOnly,
} from '../../lib/syntheticPersistSubset'
import { computeDurationPersistFields } from '../../lib/computeDurationPersist'
import {
  buildRunParametersSnapshot,
  type RunParametersSnapshot,
} from '../../lib/runParametersSnapshot'
import { attachGmshServerComputeToGravityBody, attachMeshToGravityBody, buildForwardMeshRequestAsync, gmshStatsFromSolverMeta } from '../../lib/forwardGravityMeshRequest'
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

export type AmfmCalculationInput = AmfmModelParams & {
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
  criticalDistanceFactor: number
  maxDepth: number
  maxSourcesPerNode: number
}

// --- Run parameters snapshot (downloaded from Analysis as ``parameters.json``) ---

function buildAmfmRunParameters(
  method: string,
  fullGridStats: GravityStatsFromFullGrid | null,
  calculationTimeSnapshot: number | null,
  ctx: AmfmCalculationInput,
): RunParametersSnapshot {
  const shape = syntheticShapeParametersOnly(ctx.modelType, ctx)
  const parameters = {
    forwardGravityMethod: 'amf_plus_advanced_newton',
    meshDiscretization: meshDiscretizationFromCatalogModelType(ctx.modelType),
    numSourcesX: ctx.numSourcesX,
    numSourcesY: ctx.numSourcesY,
    numSourcesZ: ctx.numSourcesZ,
    numReceiversX: ctx.numReceiversX,
    numReceiversY: ctx.numReceiversY,
    surfaceXMin: ctx.forwardSurfaceBounds.xMin,
    surfaceXMax: ctx.forwardSurfaceBounds.xMax,
    surfaceYMin: ctx.forwardSurfaceBounds.yMin,
    surfaceYMax: ctx.forwardSurfaceBounds.yMax,
    criticalDistanceFactor: ctx.criticalDistanceFactor,
    maxDepth: ctx.maxDepth,
    maxSourcesPerNode: ctx.maxSourcesPerNode,
    ...shape,
    ...computeDurationPersistFields(calculationTimeSnapshot),
    gravityResultsCount: ctx.gravityResults.length,
    minGravity:
      ctx.gravityResults.length > 0 ? fullGridStats?.min ?? safeMin(ctx.gravityResults) : 0,
    maxGravity:
      ctx.gravityResults.length > 0 ? fullGridStats?.max ?? safeMax(ctx.gravityResults) : 0,
  }
  return buildRunParametersSnapshot(method, ctx.modelType || 'Unknown', parameters)
}

// --- Main hook: validate caps → API → normalize → optional snapshot ---

export function useAmfmCalculation(input: AmfmCalculationInput) {
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
    if (usesMeshPayload && !forwardUsesGmshTetraMeshRequest(input.modelType)) {
      const sourceCount = resolveForwardSourceCount(
        input.modelType,
        input.numSourcesX,
        input.numSourcesY,
        input.numSourcesZ,
        input.gmshCachedElementCount,
      )
      const receiverCount = input.numReceiversX * input.numReceiversY
      const eff = logScaledInteractionMeasure(sourceCount, receiverCount)
      const rawPairs = sourceCount * receiverCount
      if (eff > AMFM_MAX_LOG_SCALED_INTERACTIONS) {
        setError(
          `Too many log-scaled source–receiver workload units for AMF+ Advanced Newton ` +
            `(effective N·M/log₂N = ${eff.toLocaleString()}; raw N·M = ${rawPairs.toLocaleString()}). ` +
            `Current safety cap is ${AMFM_MAX_LOG_SCALED_INTERACTIONS.toLocaleString()}. ` +
            'Reduce mesh resolution or the observation grid.'
        )
        return
      }
    } else if (!usesMeshPayload) {
      const sourceCount = resolveForwardSourceCount(
        input.modelType,
        input.numSourcesX,
        input.numSourcesY,
        input.numSourcesZ,
        input.gmshCachedElementCount,
      )
      const receiverCount = input.numReceiversX * input.numReceiversY
      const eff = logScaledInteractionMeasure(sourceCount, receiverCount)
      const rawPairs = sourceCount * receiverCount
      if (eff > AMFM_MAX_LOG_SCALED_INTERACTIONS) {
        setError(
          `Too many log-scaled source–receiver workload units for AMF+ Advanced Newton ` +
            `(effective N·M/log₂N = ${eff.toLocaleString()}; raw N·M = ${rawPairs.toLocaleString()}). ` +
            `Current safety cap is ${AMFM_MAX_LOG_SCALED_INTERACTIONS.toLocaleString()}. ` +
            'Reduce mesh resolution or the observation grid.'
        )
        return
      }
    }
    if (!usesMeshPayload) {
      const receiverCount = input.numReceiversX * input.numReceiversY
      if (receiverCount > AMFM_MAX_RECEIVERS) {
        setError(
          `Too many observation points for AMF+ Advanced Newton (${receiverCount.toLocaleString()}). ` +
            `Current safety cap is ${AMFM_MAX_RECEIVERS.toLocaleString()}.`
        )
        return
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
      const body = amfmBuildRequest({
        model: input,
        numSourcesX: input.numSourcesX,
        numSourcesY: input.numSourcesY,
        numSourcesZ: input.numSourcesZ,
        numReceiversX: input.numReceiversX,
        numReceiversY: input.numReceiversY,
        surfaceBounds: input.forwardSurfaceBounds,
        criticalDistanceFactor: input.criticalDistanceFactor,
        maxDepth: input.maxDepth,
        maxSourcesPerNode: input.maxSourcesPerNode,
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
      const data = await api.computeGravityAMFM(
        gmshServerComputeBody
          ? attachGmshServerComputeToGravityBody(body, gmshServerComputeBody)
          : meshRequest
            ? attachMeshToGravityBody(body, meshRequest)
            : body,
      )
      const {
        results,
        computeMs: backendComputeMs,
        statsFromFullGrid,
        mapNumX,
        mapNumY,
        solverMeta,
      } = normalizeGravityResponse(data)
      const gmshStats = gmshStatsFromSolverMeta(solverMeta)
      if (gmshStats) input.onGmshBuildStatsSet?.(gmshStats)
      setComputeMs(backendComputeMs)
      const timeMs = performance.now() - startTime
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
        const persistCtx: AmfmCalculationInput = { ...input, gravityResults: results }
        setLastRunParametersSnapshot(
          buildAmfmRunParameters('amf_plus_advanced_newton', statsFromFullGrid, timeMs, persistCtx),
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Adaptive multilevel fast multipole (amfm) calculation error:', err)
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
