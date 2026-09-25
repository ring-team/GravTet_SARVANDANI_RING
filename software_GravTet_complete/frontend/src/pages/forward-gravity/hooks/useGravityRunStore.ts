import { useCallback, useMemo, useState } from 'react'
import { createEmptyGravityRunState, type GravityRunState } from '../state/runState'

export function useGravityRunStore() {
  const [byKey, setByKey] = useState<Record<string, GravityRunState>>({})

  const setRun = useCallback((key: string, patch: Partial<GravityRunState>) => {
    setByKey((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? createEmptyGravityRunState()),
        ...patch,
      },
    }))
  }, [])

  const resetRun = useCallback((key: string) => {
    setByKey((prev) => ({
      ...prev,
      [key]: createEmptyGravityRunState(),
    }))
  }, [])

  const resetAll = useCallback(() => setByKey({}), [])

  return useMemo(
    () => ({ byKey, setRun, resetRun, resetAll }),
    [byKey, resetAll, resetRun, setRun],
  )
}
