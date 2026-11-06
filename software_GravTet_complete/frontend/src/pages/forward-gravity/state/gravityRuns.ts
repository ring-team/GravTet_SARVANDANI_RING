/**
 * Normalized state for forward-gravity method/execution-mode combinations.
 */

export type MethodKey =
  | 'quadrature/reference'
  | 'quadrature/tiled'
  | 'quadrature/simd_tiled'
  | 'quadrature/simd_threads'
  | 'analytical/reference'

export interface RunState {
  results: number[]
  calculationTime: number | null
  lastRx: number | null
  lastRy: number | null
}

export const EMPTY_RUN: RunState = {
  results: [],
  calculationTime: null,
  lastRx: null,
  lastRy: null,
}

export type RunsState = Partial<Record<MethodKey, RunState>>

export type RunsAction =
  | { type: 'setResults'; key: MethodKey; results: number[] }
  | { type: 'setCalculationTime'; key: MethodKey; time: number | null }
  | { type: 'setLastReceivers'; key: MethodKey; x: number | null; y: number | null }
  | { type: 'resetAll' }

function withRun(state: RunsState, key: MethodKey, patch: Partial<RunState>): RunsState {
  const current = state[key] ?? EMPTY_RUN
  return { ...state, [key]: { ...current, ...patch } }
}

export function runsReducer(state: RunsState, action: RunsAction): RunsState {
  switch (action.type) {
    case 'setResults':
      return withRun(state, action.key, { results: action.results })
    case 'setCalculationTime':
      return withRun(state, action.key, { calculationTime: action.time })
    case 'setLastReceivers':
      return withRun(state, action.key, { lastRx: action.x, lastRy: action.y })
    case 'resetAll':
      return {}
    default:
      return state
  }
}
