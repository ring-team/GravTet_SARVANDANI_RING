/**
 * Forward Gravity page: quadrature second-order and analytical closed-form solvers.
 */

import AnalyticalClosedFormView from './forward_method_parameter/analytical_closedform/AnalyticalClosedFormView'
import QuadratureView from './forward_method_parameter/quadrature_gravity/QuadratureView'
import type { ForwardRunMeta } from './lib/forwardRunMeta'
import type { MethodKey, RunState } from './state/gravityRuns'
export interface GravityRunsContentApi {
  baseProps: any
  getRun: (key: MethodKey) => RunState
  setResults: (key: MethodKey, results: number[]) => void
  setCalculationTime: (key: MethodKey, time: number | null) => void
  setLastReceivers: (key: MethodKey, x: number, y: number) => void
}

type ExecutionMode = 'reference' | 'tiled' | 'simd_tiled' | 'simd_tiled_threading'

function execModeKeySuffix(mode: ExecutionMode): 'reference' | 'tiled' | 'simd_tiled' | 'simd_threads' {
  return mode === 'simd_tiled_threading' ? 'simd_threads' : mode
}

function methodRunProps(g: GravityRunsContentApi, key: MethodKey) {
  const run = g.getRun(key)
  return {
    gravityResults: run.results,
    setGravityResults: (r: number[]) => g.setResults(key, r),
    calculationTime: run.calculationTime,
    setCalculationTime: (t: number | null) => g.setCalculationTime(key, t),
    lastRunNumReceiversX: run.lastRx,
    lastRunNumReceiversY: run.lastRy,
    onLastRunNumReceiversSet: (x: number, y: number) => g.setLastReceivers(key, x, y),
  }
}

function forwardRunMetaProps(
  p: {
    forwardRunMetaByKey?: Record<string, ForwardRunMeta>
    onForwardRunMetaSet?: (key: string, meta: ForwardRunMeta) => void
  },
  key: string,
) {
  return {
    lastRunMeta: p.forwardRunMetaByKey?.[key] ?? null,
    onLastRunMetaSet: p.onForwardRunMetaSet
      ? (meta: ForwardRunMeta) => p.onForwardRunMetaSet!(key, meta)
      : undefined,
  }
}

export default function ForwardGravityPage({
  content,
  p,
  gravity,
}: {
  content: string
  p: any
  gravity: GravityRunsContentApi
}) {
  if (content === 'quadrature') {
    const executionMode: ExecutionMode =
      p.view === 'quadrature_reference'
        ? 'reference'
        : p.view === 'quadrature_reference_tiled'
        ? 'tiled'
        : p.view === 'quadrature_simd_tiled'
        ? 'simd_tiled'
        : 'simd_tiled_threading'
    const key = `quadrature/${execModeKeySuffix(executionMode)}` as MethodKey
    return (
      <QuadratureView
        executionMode={executionMode}
        {...gravity.baseProps}
        {...forwardRunMetaProps(p, key)}
        {...methodRunProps(gravity, key)}
      />
    )
  }
  if (content === 'analytical') {
    const key: MethodKey = 'analytical/reference'
    return (
      <AnalyticalClosedFormView
        {...gravity.baseProps}
        {...forwardRunMetaProps(p, key)}
        {...methodRunProps(gravity, key)}
      />
    )
  }
  return null
}
