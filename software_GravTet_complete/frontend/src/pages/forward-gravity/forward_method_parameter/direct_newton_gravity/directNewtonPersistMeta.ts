/**
 * Human-readable solver / execution metadata for ``parameters.json`` (Direct Newton + analytical).
 */

export type SolverKindPersist = 'direct_newton' | 'analytical_closedform'

export type ExecutionModePersist = 'reference' | 'tiled' | 'simd_tiled' | 'simd_tiled_threading'

export function forwardSolverPersistFields(
  solverKind: SolverKindPersist | undefined,
  executionMode: ExecutionModePersist,
  numThreads?: number,
): Record<string, unknown> {
  const sk: SolverKindPersist = solverKind ?? 'direct_newton'

  if (sk === 'analytical_closedform') {
    return {
      solverKind: sk,
      directNewtonExecutionMode: executionMode,
      forwardRunLabel: 'Analytical (closed-form)',
    }
  }

  const labelMap: Record<ExecutionModePersist, string> = {
    reference: 'Direct Newton (reference)',
    tiled: 'Direct Newton (tiled)',
    simd_tiled: 'Direct Newton (SIMDTiled)',
    simd_tiled_threading: 'Direct Newton (SIMDTiledThreading)',
  }
  let forwardRunLabel = labelMap[executionMode] ?? `Direct Newton (${executionMode})`
  if (executionMode === 'simd_tiled_threading' && typeof numThreads === 'number' && numThreads > 0) {
    forwardRunLabel += ` — ${numThreads} threads`
  }
  return {
    solverKind: sk,
    directNewtonExecutionMode: executionMode,
    numThreadsUsed:
      executionMode === 'simd_tiled_threading' && typeof numThreads === 'number' && numThreads > 0
        ? numThreads
        : undefined,
    forwardRunLabel,
  }
}
