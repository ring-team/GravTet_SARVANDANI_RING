import { useEffect, useMemo } from 'react'
import type { ViewKey } from '../types/view'
import { migrateCatalogModelType } from '../pages/synthetic-gravity/constants/synthetic'
import getContentKey from '../routes/getContentKey'
import { useForwardModelControls } from '../pages/forward-gravity/hooks/useForwardModelControls'
import { useGravityRuns } from '../pages/forward-gravity/hooks/useGravityRuns'
import { useGravityRunStore } from '../pages/forward-gravity/hooks/useGravityRunStore'
import useSyntheticParameters from '../pages/synthetic-gravity/hooks/useSyntheticParameters'

export interface UseGravityAppStateArgs {
  view: ViewKey
  gravityModel: string | null
  setGravityModel: (model: string | null) => void
}

export function useGravityAppState({ view, gravityModel, setGravityModel }: UseGravityAppStateArgs) {
  const params = useSyntheticParameters()
  const { getRun, setResults, setCalculationTime, setLastReceivers, resetAll: resetGravityRuns } = useGravityRuns()
  const runStore = useGravityRunStore()
  const forward = useForwardModelControls({ view, gravityModel, params })

  useEffect(() => {
    const model = new URLSearchParams(window.location.search).get('model')
    if (model) {
      setGravityModel(migrateCatalogModelType(model) ?? model)
    }
  }, [setGravityModel])

  useEffect(() => {
    if (!gravityModel) return
    resetGravityRuns()
    forward.resetForwardRunMeta()
  }, [gravityModel, resetGravityRuns, forward.resetForwardRunMeta])

  const content = useMemo(() => getContentKey(view, gravityModel), [view, gravityModel])
  const is3DContent = useMemo(() => {
    const threeDContent = [
      'initial_model',
      'cube3d',
      'cuboid3d',
      'sphere3d',
      'ellipsoid3d',
      'verticalcylinder3d',
      'horizontalcylinder3d',
      'fourcubes3d',
      'faultedblock3d',
      'valleymountain3d',
    ]

    return threeDContent.includes(content)
  }, [content])

  const pageProps = useMemo(
    () => ({
      ...params,
      view,
      gravityModel,
      ...forward.forwardGridProps,
      forwardRunMetaByKey: forward.forwardRunMetaByKey,
      onForwardRunMetaSet: forward.onForwardRunMetaSet,
    }),
    [forward.forwardGridProps, forward.forwardRunMetaByKey, forward.onForwardRunMetaSet, gravityModel, params, view],
  )

  const gravityPageProps = useMemo(
    () => ({
      baseProps: forward.forwardMethodBaseProps,
      getRun,
      setResults,
      setCalculationTime,
      setLastReceivers,
    }),
    [forward.forwardMethodBaseProps, getRun, setResults, setCalculationTime, setLastReceivers],
  )

  return {
    content,
    is3DContent,
    pageProps,
    gravityPageProps,
    runStore,
  }
}

export default useGravityAppState
