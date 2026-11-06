/**
 * Closed-form gravity forward: `/api/compute_gravity_analytical` (no mesh discretization).
 */
import { useState } from 'react'
import { api, normalizeGravityResponse, type GravityStatsFromFullGrid } from '../../../../services/api'
import { safeMin, safeMax } from '../../lib/gravityArrayStats'
import type { SurfaceBounds } from '../../shared/GravityMapView'
import { buildAnalyticalReferenceRequest } from '../../lib/forwardAnalyticalReferenceRequest'
import type { ForwardModelParams } from '../../lib/forwardModelParams'
import { isAnalyticalClosedFormModelSupported } from '../../lib/analyticalClosedFormSupport'
import { computeDurationPersistFields, resolveForwardModelingTimeMs } from '../../lib/computeDurationPersist'
import {
  buildRunParametersSnapshot,
  type RunParametersSnapshot,
} from '../../lib/runParametersSnapshot'
import { meshDiscretizationFromCatalogModelType, syntheticShapeParametersOnly } from '../../lib/syntheticPersistSubset'
import { forwardRunGeometryKey } from '../../lib/forwardRunGeometryKey'
import type { ForwardRunMeta } from '../../lib/forwardRunMeta'
import { useForwardGravityMapExtent } from '../../shared/ForwardGravityMapExtentContext'

export type AnalyticalCalcInput = ForwardModelParams & {
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
}

export type GravityResponseMetaState = {
  stats: GravityStatsFromFullGrid | null
  mapNx: number | null
  mapNy: number | null
  solverMeta: Record<string, unknown> | null
} | null

function buildSnapshot(
  ctx: AnalyticalCalcInput,
  fullGridStats: GravityStatsFromFullGrid | null,
  modelComputeMs: number | null,
): RunParametersSnapshot {
  const shape = syntheticShapeParametersOnly(ctx.modelType, ctx)
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
    method: 'analytical_closedform',
    ...computeDurationPersistFields(modelComputeMs),
    gravityResultsCount: ctx.gravityResults.length,
    minGravity: ctx.gravityResults.length > 0 ? fullGridStats?.min ?? safeMin(ctx.gravityResults) : 0,
    maxGravity: ctx.gravityResults.length > 0 ? fullGridStats?.max ?? safeMax(ctx.gravityResults) : 0,
  }
  return buildRunParametersSnapshot('analytical_closedform', ctx.modelType || 'Unknown', parameters)
}

export function useAnalyticalClosedFormCalculation(input: AnalyticalCalcInput) {
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

  const recordRunMapExtent = (results: number[], statsFromFullGrid: GravityStatsFromFullGrid | null) => {
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
    if (!isAnalyticalClosedFormModelSupported(input.modelType)) {
      setError('Analytical closed-form supports Cube and Sphere catalog models only.')
      return
    }
    const body = buildAnalyticalReferenceRequest(
      input,
      input.forwardSurfaceBounds,
      input.numReceiversX,
      input.numReceiversY,
    )
    if (!body) {
      setError('Could not build analytical request for this model.')
      return
    }

    setIsCalculating(true)
    setError(null)
    setGravityResponseMeta(null)
    input.setGravityResults([])
    input.setCalculationTime(null)
    setComputeMs(null)
    setLastRunParametersSnapshot(null)

    const startTime = performance.now()
    try {
      const data = await api.computeGravityAnalytical(body)
      const {
        results,
        computeMs: backendComputeMs,
        totalMs: backendTotalMs,
        statsFromFullGrid,
        mapNumX,
        mapNumY,
        solverMeta: backendSolverMeta,
      } = normalizeGravityResponse(data)
      setComputeMs(backendComputeMs)
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
          buildSnapshot({ ...input, gravityResults: results }, statsFromFullGrid, modelComputeMs),
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Analytical gravity calculation error:', err)
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
