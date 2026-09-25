/**
 * Safety caps for direct Newton gravity: max receivers and max source–receiver interaction budget.
 *
 * Used for validation messages and slider limits in the direct summation view.
 */

// --- Client-side caps (receivers vs source×receiver work) ---

/** Must match `MAX_DIRECT_NEWTON_RECEIVERS` in `backend/api/gravity/constants.py`. */
export const DIRECT_NEWTON_MAX_RECEIVERS = 50000000
export const DIRECT_NEWTON_MAX_INTERACTIONS = 1000000000000
