export type RunStatus = 'idle' | 'running' | 'succeeded' | 'failed'

export interface GravityRunState {
  status: RunStatus
  requestPayload: Record<string, unknown> | null
  result: number[]
  error: string | null
  timingMs: number | null
  startedAt: string | null
  finishedAt: string | null
}

export const createEmptyGravityRunState = (): GravityRunState => ({
  status: 'idle',
  requestPayload: null,
  result: [],
  error: null,
  timingMs: null,
  startedAt: null,
  finishedAt: null,
})

export interface GravityRunStore {
  byKey: Record<string, GravityRunState>
  setRun: (key: string, patch: Partial<GravityRunState>) => void
  resetRun: (key: string) => void
  resetAll: () => void
}
