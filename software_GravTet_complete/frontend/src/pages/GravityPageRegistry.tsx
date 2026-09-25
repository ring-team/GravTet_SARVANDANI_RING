import type { ReactNode } from 'react'
import HomePage from './home/HomePage'
import SyntheticGravityPage from './synthetic-gravity/SyntheticGravityPage'
import ForwardGravityPage from './forward-gravity/ForwardGravityPage'
import InitialModelPage from './initial-model/InitialModelPage'
import type { MethodKey, RunState } from './forward-gravity/state/gravityRuns'
import type { GravityRunStore } from './forward-gravity/state/runState'
import type { InitialModel } from '../pages/initial-model/initialModel/types'

export interface GravityPageRegistryProps {
  content: string
  pageProps: Record<string, unknown>
  gravityPageProps: {
    baseProps: unknown
    getRun: (key: MethodKey) => RunState
    setResults: (key: MethodKey, results: number[]) => void
    setCalculationTime: (key: MethodKey, time: number | null) => void
    setLastReceivers: (key: MethodKey, x: number, y: number) => void
  }
  initialModel: InitialModel | null
  setInitialModel: (model: InitialModel | null) => void
  runStore: GravityRunStore
}

export function GravityPageRegistry({
  content,
  pageProps,
  gravityPageProps,
  initialModel,
  setInitialModel,
  runStore,
}: GravityPageRegistryProps): ReactNode {
  return (
    <>
      <HomePage content={content} />
      <SyntheticGravityPage content={content} p={pageProps} />
      <InitialModelPage content={content} initialModel={initialModel} setInitialModel={setInitialModel} />
      <ForwardGravityPage content={content} p={pageProps} gravity={gravityPageProps} runStore={runStore} />
    </>
  )
}

export default GravityPageRegistry
