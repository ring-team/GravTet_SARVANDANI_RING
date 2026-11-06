/**
 * Persist compute duration in seconds for ``parameters.json``.
 * UI ``calculationTime`` state is milliseconds (``performance.now()`` or ``compute_ms`` from API).
 */

/** UI calculation time is solver-only (``compute_ms``); mesh build/transfer is excluded. */
export function resolveForwardModelingTimeMs(
  wallMs: number,
  computeMs: number | null | undefined,
  _totalMs?: number | null | undefined,
): number {
  if (typeof computeMs === 'number' && Number.isFinite(computeMs)) return computeMs
  return wallMs
}

export function computeDurationPersistFields(ms: number | null | undefined): {
  calculationTimeSeconds: number
  calculationTimeUnit: 's'
} {
  const sec = typeof ms === 'number' && Number.isFinite(ms) ? ms / 1000 : 0
  return {
    calculationTimeSeconds: Math.round(sec * 1e6) / 1e6,
    calculationTimeUnit: 's',
  }
}
