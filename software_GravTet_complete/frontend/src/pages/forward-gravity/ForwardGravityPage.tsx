/**
 * Forward Gravity page (header "Forward Gravity" button): renders the selected forward
 * solver view (Direct Newton / Quadrature / Analytical / Barnes–Hut / AMFM).
 *
 * Model + observation-grid props come from `gravity.baseProps`; per-method run state
 * (results, timing, last receivers) is wired from the gravity runs reducer.
 */

import DirectNewtonView from './forward_method_parameter/direct_newton_gravity/DirectNewtonView'
import QuadratureView from './forward_method_parameter/quadrature_gravity/QuadratureView'
import BarnesHutView from './forward_method_parameter/barnes_hut/BarnesHutView'
import AMFMView from './forward_method_parameter/amfm_gravity/AMFMView'
import { isExecutionBundle } from '../../config/appVariant'
import type { ForwardRunMeta } from './lib/forwardRunMeta'
import type { MethodKey, RunState } from './state/gravityRuns'
import type { GravityRunStore } from './state/runState'

// --- Per-method run wiring (sourced from the gravity runs reducer in `App`) ---

export interface GravityRunsContentApi {
  /**
   * Shared model + observation-grid props passed to every forward solver view.
   * Typed loosely because each solver view declares its own props interface; the shared
   * subset is spread in and run wiring is added per call.
   */
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

/** Builds the results/timing/last-receiver props for one method from the runs reducer. */
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
  runStore,
}: {
  content: string
  p: any
  gravity: GravityRunsContentApi
  runStore: GravityRunStore
}) {
  if (content === 'directnewton') {
    const executionMode: ExecutionMode =
      p.view === 'method1_reference'
        ? 'reference'
        : p.view === 'method1_reference_tiled'
        ? 'tiled'
        : p.view === 'method1_simd_tiled'
        ? 'simd_tiled'
        : 'simd_tiled_threading'
    const key = `direct_newton/${execModeKeySuffix(executionMode)}` as MethodKey
    return (
      <DirectNewtonView
        executionMode={executionMode}
        {...gravity.baseProps}
        {...forwardRunMetaProps(p, key)}
        {...methodRunProps(gravity, key)}
        runStore={runStore}
        runKey={key}
      />
    )
  }
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
        runStore={runStore}
        runKey={key}
      />
    )
  }
  if (content === 'analytical') {
    const key: MethodKey = 'analytical/reference'
    return (
      <DirectNewtonView
        solverKind="analytical_closedform"
        executionMode="reference"
        {...gravity.baseProps}
        {...forwardRunMetaProps(p, key)}
        {...methodRunProps(gravity, key)}
        runStore={runStore}
        runKey={key}
      />
    )
  }
  if (content === 'barnes_hut') {
    if (isExecutionBundle) return null
    const key: MethodKey = 'barnes_hut/reference'
    return (
      <BarnesHutView
        {...gravity.baseProps}
        {...forwardRunMetaProps(p, key)}
        {...methodRunProps(gravity, key)}
        runStore={runStore}
        runKey={key}
      />
    )
  }
  if (content === 'amfm') {
    if (isExecutionBundle) return null
    const key: MethodKey = 'amfm/reference'
    return (
      <AMFMView
        {...gravity.baseProps}
        {...forwardRunMetaProps(p, key)}
        {...methodRunProps(gravity, key)}
        runStore={runStore}
        runKey={key}
      />
    )
  }
  return null
}
