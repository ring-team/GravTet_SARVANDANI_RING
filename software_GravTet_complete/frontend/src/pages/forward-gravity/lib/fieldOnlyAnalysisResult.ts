import type { GravityAnalysisResponse } from '../../../services/api'
import { safeMin, safeMax } from '../lib/gravityArrayStats'

/** Build analysis payload from an existing forward gravity map (no closed-form reference). */
export function buildFieldOnlyAnalysisResult(input: {
  analysisMethod: string
  candidateResults: number[]
  mapNumX?: number | null
  mapNumY?: number | null
  numReceiversX: number
  numReceiversY: number
  computeMs?: number | null
}): GravityAnalysisResponse {
  const { candidateResults, numReceiversX, numReceiversY } = input
  let mapNx = input.mapNumX != null && input.mapNumX > 0 ? input.mapNumX : numReceiversX
  let mapNy = input.mapNumY != null && input.mapNumY > 0 ? input.mapNumY : numReceiversY
  if (mapNx * mapNy !== candidateResults.length) {
    mapNx = numReceiversX
    mapNy = numReceiversY
  }
  return {
    analysis_method: input.analysisMethod,
    reference_method: 'none',
    compute_ms: input.computeMs ?? 0,
    reference_compute_ms: 0,
    mae_mgal: 0,
    rmse_mgal: 0,
    max_abs_error_mgal: 0,
    relative_l2_percent: 0,
    correlation_r: 0,
    num_points_compared: candidateResults.length,
    map_num_x: mapNx,
    map_num_y: mapNy,
    candidate_map: candidateResults,
    candidate_stats_min: candidateResults.length > 0 ? safeMin(candidateResults) : 0,
    candidate_stats_max: candidateResults.length > 0 ? safeMax(candidateResults) : 0,
  }
}
