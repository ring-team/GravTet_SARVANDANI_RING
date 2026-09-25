/**
 * AMFM UI defaults: observation grid size, critical distance factor, octree depth, and max sources per node.
 *
 * Single place to tune labels and initial slider values for the adaptive fast-multipole gravity view.
 */

// --- Default octree / multipole tuning ---

/** Default near/far boundary for most shapes. */
export const AMFM_DEFAULT_CRITICAL_DISTANCE_FACTOR = 2.5

/** Cuboid/prism only: larger near-field direct region reduces multipole smoothing along elongated bodies. */
export const AMFM_DEFAULT_CRITICAL_DISTANCE_FACTOR_RECTANGULAR_PRISM = 3.5
export const AMFM_DEFAULT_MAX_DEPTH = 10
export const AMFM_DEFAULT_MAX_SOURCES_PER_NODE = 256

/** Prism/cuboid: deeper tree + smaller node cap (matches server-side AMFM floors for elongated bodies). */
export const AMFM_DEFAULT_MAX_DEPTH_RECTANGULAR_PRISM = 12
export const AMFM_DEFAULT_MAX_SOURCES_PER_NODE_RECTANGULAR_PRISM = 128

// --- Safety caps (client-side guardrails before API) ---

export const AMFM_MAX_RECEIVERS = 50000000
/** Re-export: AMFM / Barnes–Hut use log-scaled (N·M)/log₂N cap, not a raw source count. */
export { MAX_APPROXIMATE_LOG_SCALED_INTERACTIONS as AMFM_MAX_LOG_SCALED_INTERACTIONS } from '../../lib/forwardApproximateLimits'
