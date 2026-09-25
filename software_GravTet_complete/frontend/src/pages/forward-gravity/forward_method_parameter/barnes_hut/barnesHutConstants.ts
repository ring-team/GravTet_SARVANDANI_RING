/**
 * Barnes–Hut UI constants: default opening angle θ, slider bounds, and observation grid limits.
 *
 * Opening angle trades accuracy for speed; min grid size aligns with other forward-gravity views.
 */

// --- Default opening angle ---

/** Default Barnes–Hut opening angle θ₀ for most shapes (matches sphere/cube-style behavior). */
/** Must match `MAX_BARNES_HUT_RECEIVERS` in `backend/api/gravity/constants.py`. */
export const BARNES_HUT_MAX_RECEIVERS = 50000000

export const BARNES_HUT_DEFAULT_THETA0 = 0.5

/**
 * Cuboid/prism only: monopole opening loses elongation; tighter θ₀ brings footprint closer to direct Newton.
 * Other synthetics keep `BARNES_HUT_DEFAULT_THETA0`.
 */
export const BARNES_HUT_DEFAULT_THETA0_RECTANGULAR_PRISM = 0.25

// --- θ slider range ---

export const BARNES_HUT_THETA_MIN = 0.1
export const BARNES_HUT_THETA_MAX = 1.5
export const BARNES_HUT_THETA_STEP = 0.1

// --- Observation grid ---

/** Minimum observation grid size (matches other forward-gravity views). */
export const BARNES_HUT_MIN_OBSERVATION_POINTS = 5
