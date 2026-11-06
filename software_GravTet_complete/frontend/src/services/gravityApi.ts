/**
 * Gravity backend service: typed `/api/*` endpoints and response normalization.
 */
import { apiCall } from './httpClient'
import { GRAVITY_API_ENDPOINTS } from '../config/api/endpoints'
import {
  MAX_CLIENT_MESH_ELEMENTS,
  MAX_CLIENT_MESH_JSON_CHARS,
  MAX_CLIENT_MESH_NODES,
} from '../config/constants/meshPayloadLimits'
import type {
  GravityResponse,
  GravityAnalysisResponse,
  GravityStatsFromFullGrid,
  GmshTetraMeshBuildResponse,
  TetraMeshRequest,
} from '../types/gravity'

function estimateMeshJsonChars(params: TetraMeshRequest): number {
  const nodes = params.mesh.nodes.length
  const items = params.mesh.elements ?? params.mesh.tets ?? []
  const elements = items.length
  const first = items[0]
  const elementChars = Array.isArray(first) ? 34 : 72
  return 512 + nodes * 40 + elements * elementChars
}

function meshPayloadBody(params: TetraMeshRequest | Record<string, unknown>): string {
  if (
    params &&
    typeof params === 'object' &&
    'mesh' in params &&
    params.mesh != null &&
    typeof params.mesh === 'object'
  ) {
    return stringifyMeshRequestOrThrow(params as TetraMeshRequest)
  }
  return JSON.stringify(params)
}

function stringifyMeshRequestOrThrow(params: TetraMeshRequest): string {
  const nodeCount = params.mesh.nodes.length
  const elementCount = (params.mesh.elements ?? params.mesh.tets ?? []).length
  if (nodeCount > MAX_CLIENT_MESH_NODES || elementCount > MAX_CLIENT_MESH_ELEMENTS) {
    throw new Error(
      `Mesh is too large for browser serialization (nodes=${nodeCount.toLocaleString()}, ` +
        `elements=${elementCount.toLocaleString()}). Reduce mesh resolution/target element size.`,
    )
  }
  const estimatedChars = estimateMeshJsonChars(params)
  if (estimatedChars > MAX_CLIENT_MESH_JSON_CHARS) {
    throw new Error(
      `Mesh payload is too large to send safely from browser (~${(estimatedChars / 1e6).toFixed(1)} MB JSON). ` +
        'Reduce mesh resolution/target element size or use fewer receivers.',
    )
  }
  try {
    return JSON.stringify(params)
  } catch (e) {
    if (e instanceof RangeError) {
      throw new Error(
        'Mesh payload is too large to serialize in the browser. ' +
          'Reduce mesh resolution/target element size and try again.',
      )
    }
    throw e
  }
}

export function normalizeGravityResponse(data: GravityResponse): {
  results: number[]
  computeMs: number | null
  totalMs: number | null
  numSources: number | null
  numReceivers: number | null
  statsFromFullGrid: GravityStatsFromFullGrid | null
  mapNumX: number | null
  mapNumY: number | null
  solverMeta: Record<string, unknown> | null
} {
  if (Array.isArray(data)) {
    return {
      results: data,
      computeMs: null,
      totalMs: null,
      numSources: null,
      numReceivers: null,
      statsFromFullGrid: null,
      mapNumX: null,
      mapNumY: null,
      solverMeta: null,
    }
  }
  const statsFromFullGrid =
    typeof data.stats_min === 'number' &&
    typeof data.stats_max === 'number' &&
    typeof data.stats_mean === 'number'
      ? { min: data.stats_min, max: data.stats_max, mean: data.stats_mean }
      : null
  const solverMeta =
    data.solver_meta != null && typeof data.solver_meta === 'object' && !Array.isArray(data.solver_meta)
      ? (data.solver_meta as Record<string, unknown>)
      : null
  return {
    results: data.results,
    computeMs: typeof data.compute_ms === 'number' ? data.compute_ms : null,
    totalMs: typeof data.total_ms === 'number' ? data.total_ms : null,
    numSources: typeof data.num_sources === 'number' ? data.num_sources : null,
    numReceivers: typeof data.num_receivers === 'number' ? data.num_receivers : null,
    statsFromFullGrid,
    mapNumX: typeof data.map_num_x === 'number' ? data.map_num_x : null,
    mapNumY: typeof data.map_num_y === 'number' ? data.map_num_y : null,
    solverMeta,
  }
}

export const api = {
  health: () =>
    apiCall<{
      status: string
      quadrature_second_order_loaded?: boolean
      quadrature_simd?: { available_lanes: number[]; active_lanes: number | null }
      gmsh_python_available?: boolean
    }>(GRAVITY_API_ENDPOINTS.health),

  buildGmshTetraMesh: (params: Record<string, unknown>) =>
    apiCall<GmshTetraMeshBuildResponse>(GRAVITY_API_ENDPOINTS.buildGmshTetraMesh, {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  computeGravityQuadrature: (params: any) =>
    apiCall<GravityResponse>(GRAVITY_API_ENDPOINTS.computeGravityQuadrature, {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  computeGravityAnalytical: (params: any) =>
    apiCall<GravityResponse>(GRAVITY_API_ENDPOINTS.computeGravityAnalytical, {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  computeGravityMeshQuadrature: (params: TetraMeshRequest | Record<string, unknown>) =>
    apiCall<GravityResponse>(GRAVITY_API_ENDPOINTS.computeGravityMeshQuadrature, {
      method: 'POST',
      body: meshPayloadBody(params),
    }),

  computeGravityAnalysis: (params: any) =>
    apiCall<GravityAnalysisResponse>(GRAVITY_API_ENDPOINTS.computeGravityAnalysis, {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  computeGravityMeshAnalysis: (params: TetraMeshRequest | Record<string, unknown>) =>
    apiCall<GravityAnalysisResponse>(GRAVITY_API_ENDPOINTS.computeGravityMeshAnalysis, {
      method: 'POST',
      body: meshPayloadBody(params),
    }),
}
