/**
 * Human-readable solver / execution metadata for ``parameters.json`` (quadrature second order).
 */

export type SolverKindPersist = 'quadrature_second_order'

export type ExecutionModePersist = 'reference' | 'tiled' | 'simd_tiled' | 'simd_tiled_threading'

export function forwardSolverPersistFields(
  solverKind: SolverKindPersist | undefined,
  executionMode: ExecutionModePersist,
  numThreads?: number,
): Record<string, unknown> {
  const sk: SolverKindPersist = solverKind ?? 'quadrature_second_order'

  const labelMap: Record<ExecutionModePersist, string> = {
    reference: 'Quadrature second order (reference)',
    tiled: 'Quadrature second order (tiled)',
    simd_tiled: 'Quadrature second order (SIMDTiled)',
    simd_tiled_threading: 'Quadrature second order (SIMDTiledThreading)',
  }
  let forwardRunLabel = labelMap[executionMode] ?? `Quadrature second order (${executionMode})`
  if (executionMode === 'simd_tiled_threading' && typeof numThreads === 'number' && numThreads > 0) {
    forwardRunLabel += ` — ${numThreads} threads`
  }
  return {
    solverKind: sk,
    executionMode,
    quadratureIntegrationOrder: 'second_order',
    numThreadsUsed:
      executionMode === 'simd_tiled_threading' && typeof numThreads === 'number' && numThreads > 0
        ? numThreads
        : undefined,
    forwardRunLabel,
  }
}
