/**
 * Tree gravity (AMFM, Barnes–Hut) workload proxy: floor((N·M) / log2(max(N,2))).
 * Must match `log_scaled_interaction_measure` in `backend/api/gravity/helpers.py`
 * and `MAX_APPROXIMATE_METHOD_LOG_SCALED_INTERACTIONS` in `backend/api/gravity/constants.py`.
 */
export const MAX_APPROXIMATE_LOG_SCALED_INTERACTIONS = 1_000_000_000_000

function floorLog2Big(n: bigint): number {
  if (n <= 1n) {
    return 1
  }
  let x = n
  let k = 0
  while (x > 1n) {
    x >>= 1n
    k += 1
  }
  return k
}

export function logScaledInteractionMeasure(nSrc: number, nRec: number): number {
  if (nSrc <= 0 || nRec <= 0) {
    return 0
  }
  const ns = BigInt(Math.trunc(Math.max(nSrc, 0)))
  const nr = BigInt(Math.trunc(Math.max(nRec, 0)))
  const logN = floorLog2Big(ns < 2n ? 2n : ns)
  const denom = BigInt(Math.max(logN, 1))
  const eff = (ns * nr) / denom
  const cap = BigInt(Number.MAX_SAFE_INTEGER)
  return Number(eff > cap ? cap : eff)
}
