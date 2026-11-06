/**
 * `useGravityRuns`: ergonomic wrapper around the forward-gravity runs reducer.
 *
 * Exposes a per-method `getRun` selector plus stable setters so view wiring stays
 * declarative. `resetAll` replaces the ~45-line manual reset effect from the old `App`.
 */
import { useCallback, useMemo, useReducer } from 'react'
import {
  EMPTY_RUN,
  runsReducer,
  type MethodKey,
  type RunState,
  type RunsState,
} from '../state/gravityRuns'

export interface GravityRunsApi {
  runs: RunsState
  getRun: (key: MethodKey) => RunState
  setResults: (key: MethodKey, results: number[]) => void
  setCalculationTime: (key: MethodKey, time: number | null) => void
  setLastReceivers: (key: MethodKey, x: number, y: number) => void
  resetAll: () => void
}

export function useGravityRuns(): GravityRunsApi {
  const [runs, dispatch] = useReducer(runsReducer, {} as RunsState)

  const getRun = useCallback((key: MethodKey): RunState => runs[key] ?? EMPTY_RUN, [runs])
  const setResults = useCallback(
    (key: MethodKey, results: number[]) => dispatch({ type: 'setResults', key, results }),
    [],
  )
  const setCalculationTime = useCallback(
    (key: MethodKey, time: number | null) => dispatch({ type: 'setCalculationTime', key, time }),
    [],
  )
  const setLastReceivers = useCallback(
    (key: MethodKey, x: number, y: number) => dispatch({ type: 'setLastReceivers', key, x, y }),
    [],
  )
  const resetAll = useCallback(() => dispatch({ type: 'resetAll' }), [])

  return useMemo(
    () => ({ runs, getRun, setResults, setCalculationTime, setLastReceivers, resetAll }),
    [runs, getRun, setResults, setCalculationTime, setLastReceivers, resetAll],
  )
}
