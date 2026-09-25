/**
 * Shared DTO types for the gravity backend API (request payloads + response shapes).
 */

/** Backend can return either a plain results array or a rich object (may include downsampled map + full-grid stats). */
export type GravityResponse =
  | number[]
  | {
      results: number[]
      compute_ms?: number
      total_ms?: number
      num_sources?: number
      num_receivers?: number
      num_receivers_x?: number
      num_receivers_y?: number
      map_num_x?: number
      map_num_y?: number
      stats_min?: number
      stats_max?: number
      stats_mean?: number
      /** Backend-applied parameters (e.g. prism tuning); confirms the server used expected settings. */
      solver_meta?: Record<string, unknown>
    }

export type GravityAnalysisResponse = {
  analysis_method: string
  reference_method: string
  compute_ms: number
  reference_compute_ms: number
  mae_mgal: number
  rmse_mgal: number
  max_abs_error_mgal: number
  relative_l2_percent: number
  correlation_r: number
  num_points_compared: number
  map_num_x?: number
  map_num_y?: number
  analytical_reference_map?: number[]
  candidate_map?: number[]
  candidate_stats_min?: number
  candidate_stats_max?: number
  comparison_maps?: {
    /** Pointwise 100 * |g_i - g_ref_i| / ||g_ref||_2 (%) — global L2-normalized map */
    relative_l2_percent_pointwise?: number[]
    correlation_residual?: number[]
  }
}

export type GravityStatsFromFullGrid = { min: number; max: number; mean: number }

export type TetraMeshNode = { x: number; y: number; z: number } | [number, number, number]
export type TetraMeshElement =
  | { i0: number; i1: number; i2: number; i3: number; density: number }
  | [number, number, number, number, number]

export type GmshTetraMeshBuildResponse = {
  mesh?: {
    nodes: TetraMeshNode[]
    elements?: TetraMeshElement[]
    tets?: TetraMeshElement[]
  }
  numNodes: number
  numElements: number
  buildMs?: number
  modelType?: string
  countOnly?: boolean
  warmCacheOnly?: boolean
  cacheHit?: boolean
  geometryReady?: boolean
  depthShiftReady?: boolean
  calculateReady?: boolean
}

export type TetraMeshRequest = {
  mesh: {
    nodes: TetraMeshNode[]
    elements?: TetraMeshElement[]
    tets?: TetraMeshElement[]
  }
  numReceiversX: number
  numReceiversY: number
  surfaceXMin: number
  surfaceXMax: number
  surfaceYMin: number
  surfaceYMax: number
  surfaceZ: number
  executionMode?: 'reference' | 'tiled' | 'simd_tiled' | 'simd_tiled_threading'
  /** Thread count for simd_tiled_threading on mesh routes (0 = backend auto). */
  numThreads?: number
  /** Cache-blocking receiver tile size Br (0 = default 64). */
  receiverBlockSize?: number
  /** Cache-blocking source/cell tile size Bs (0 = default 128). */
  sourceBlockSize?: number
  simdLanes?: number
  analysisMethod?: 'direct_newton' | 'quadrature_second_order'
  /** Optional cached candidate results to avoid recalculating the method. */
  candidateResults?: number[]
}
