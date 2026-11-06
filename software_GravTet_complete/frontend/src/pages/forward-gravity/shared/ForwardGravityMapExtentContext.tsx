import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { padGravityMapExtent, type GravityMapExtent } from '../lib/forwardGravityMapExtent'

type Ctx = {
  /** mGal colorbar extent from the last completed forward calculation (unchanged while editing parameters). */
  mapExtent: GravityMapExtent | null
  setMapExtentFromRun: (stats: { min: number; max: number }) => void
}

const ForwardGravityMapExtentContext = createContext<Ctx | null>(null)

export function ForwardGravityMapExtentProvider({ children }: { children: ReactNode }) {
  const [mapExtent, setMapExtent] = useState<GravityMapExtent | null>(null)

  const setMapExtentFromRun = useCallback((stats: { min: number; max: number }) => {
    if (!Number.isFinite(stats.min) || !Number.isFinite(stats.max)) return
    setMapExtent(padGravityMapExtent(stats.min, stats.max))
  }, [])

  const value = useMemo(
    () => ({ mapExtent, setMapExtentFromRun }),
    [mapExtent, setMapExtentFromRun],
  )

  return (
    <ForwardGravityMapExtentContext.Provider value={value}>
      {children}
    </ForwardGravityMapExtentContext.Provider>
  )
}

export function useForwardGravityMapExtent(): Ctx {
  const ctx = useContext(ForwardGravityMapExtentContext)
  if (!ctx) {
    return {
      mapExtent: null,
      setMapExtentFromRun: () => {},
    }
  }
  return ctx
}
