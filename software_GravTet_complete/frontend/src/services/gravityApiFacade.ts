import type { GravityAnalysisResponse, GravityResponse } from '../types/gravity'
import { api, normalizeGravityResponse } from './gravityApi'

export type GravityApiEndpoint =
  | 'computeGravity'
  | 'computeGravityQuadrature'
  | 'computeGravityAnalytical'
  | 'computeGravityAMFM'
  | 'computeGravityBarnesHut'

export interface GravityRunResult {
  results: number[]
  computeMs: number | null
  numSources: number | null
  numReceivers: number | null
  statsFromFullGrid: {
    min: number
    max: number
    mean: number
  } | null
  mapNumX: number | null
  mapNumY: number | null
  solverMeta: Record<string, unknown> | null
}

export async function getGravityHealth() {
  return api.health()
}

export async function submitGravityJob(
  endpoint: GravityApiEndpoint,
  payload: Record<string, unknown>,
): Promise<GravityRunResult> {
  let response: GravityResponse | GravityAnalysisResponse

  switch (endpoint) {
    case 'computeGravity':
      response = await api.computeGravity(payload)
      break
    case 'computeGravityQuadrature':
      response = await api.computeGravityQuadrature(payload)
      break
    case 'computeGravityAnalytical':
      response = await api.computeGravityAnalytical(payload)
      break
    case 'computeGravityAMFM':
      response = await api.computeGravityAMFM(payload)
      break
    case 'computeGravityBarnesHut':
      response = await api.computeGravityBarnesHut(payload)
      break
    default:
      throw new Error(`Unsupported gravity endpoint: ${endpoint}`)
  }

  return normalizeGravityResponse(response as GravityResponse)
}
