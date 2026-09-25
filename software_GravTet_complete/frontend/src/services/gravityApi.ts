/**
 * Gravity backend service: the typed catalog of `/api/*` endpoints, plus the
 * request-payload safety guards and response normalization that go with them.
 *
 * Transport lives in `httpClient.ts`; DTO types live in `types/gravity.ts`.
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

// --- Client-side mesh payload safety guards (prevent JSON.stringify crashes) ---

function estimateMeshJsonChars(params: TetraMeshRequest): number {
  const nodes = params.mesh.nodes.length
  const items = params.mesh.elements ?? params.mesh.tets ?? []
  const elements = items.length
  const first = items[0]
  const elementChars = Array.isArray(first) ? 34 : 72
  // Conservative rough estimate (characters) for JSON payload size.
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
        `elements=${elementCount.toLocaleString()}). Reduce mesh resolution/target element size.`
    )
  }
  const estimatedChars = estimateMeshJsonChars(params)
  if (estimatedChars > MAX_CLIENT_MESH_JSON_CHARS) {
    throw new Error(
      `Mesh payload is too large to send safely from browser (~${(estimatedChars / 1e6).toFixed(1)} MB JSON). ` +
        'Reduce mesh resolution/target element size or use fewer receivers.'
    )
  }
  try {
    return JSON.stringify(params)
  } catch (e) {
    if (e instanceof RangeError) {
      throw new Error(
        'Mesh payload is too large to serialize in the browser. ' +
          'Reduce mesh resolution/target element size and try again.'
      )
    }
    throw e
  }
}

// --- Gravity response normalization (array vs rich object) ---

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

// --- Public API surface (used by gravity views) ---

export const api = {
  // Health check
  health: () =>
    apiCall<{
      status: string
      direct_newton_mesh_forward?: boolean
      quadrature_second_order_loaded?: boolean
      quadrature_simd?: { available_lanes: number[]; active_lanes: number | null }
      gmsh_python_available?: boolean
    }>(GRAVITY_API_ENDPOINTS.health),

  buildGmshTetraMesh: (params: Record<string, unknown>) =>
    apiCall<GmshTetraMeshBuildResponse>(GRAVITY_API_ENDPOINTS.buildGmshTetraMesh, {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  // Direct Newton gravity computation
  computeGravity: (params: any) =>
    apiCall<GravityResponse>(GRAVITY_API_ENDPOINTS.computeGravity, {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  // Quadrature second-order gravity computation (unstructured tetrahedral only)
  computeGravityQuadrature: (params: any) =>
    apiCall<GravityResponse>(GRAVITY_API_ENDPOINTS.computeGravityQuadrature, {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  // Analytical closed-form gravity (shape geometry only; mesh type ignored)
  computeGravityAnalytical: (params: any) =>
    apiCall<GravityResponse>(GRAVITY_API_ENDPOINTS.computeGravityAnalytical, {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  // Direct Newton on generic tetra mesh input (nodes + elements)
  computeGravityMeshDirect: (params: TetraMeshRequest | Record<string, unknown>) =>
    apiCall<GravityResponse>(GRAVITY_API_ENDPOINTS.computeGravityMeshDirect, {
      method: 'POST',
      body: meshPayloadBody(params),
    }),

  // Quadrature second-order on generic tetra mesh input (nodes + elements)
  computeGravityMeshQuadrature: (params: TetraMeshRequest | Record<string, unknown>) =>
    apiCall<GravityResponse>(GRAVITY_API_ENDPOINTS.computeGravityMeshQuadrature, {
      method: 'POST',
      body: meshPayloadBody(params),
    }),

  // AMFM gravity computation
  computeGravityAMFM: (params: any) =>
    apiCall<GravityResponse>(GRAVITY_API_ENDPOINTS.computeGravityAMFM, {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  // Barnes–Hut gravity computation (Step 6)
  computeGravityBarnesHut: (params: any) =>
    apiCall<GravityResponse>(GRAVITY_API_ENDPOINTS.computeGravityBarnesHut, {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  // Analysis metrics vs analytical closed-form reference
  computeGravityAnalysis: (params: any) =>
    apiCall<GravityAnalysisResponse>(GRAVITY_API_ENDPOINTS.computeGravityAnalysis, {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  // Analysis metrics on generic tetra mesh input
  computeGravityMeshAnalysis: (params: TetraMeshRequest | Record<string, unknown>) =>
    apiCall<GravityAnalysisResponse>(GRAVITY_API_ENDPOINTS.computeGravityMeshAnalysis, {
      method: 'POST',
      body: meshPayloadBody(params),
    }),
}
