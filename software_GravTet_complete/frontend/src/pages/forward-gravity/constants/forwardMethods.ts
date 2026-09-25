/**
 * Forward Gravity dropdown: solver labels mapped to their `ViewKey` routes.
 */

import type { ViewKey } from '../../../types/view'
import { EXECUTION_HIDDEN_VIEWS, isExecutionBundle } from '../../../config/appVariant'

// --- Header “Forward Gravity” dropdown: solver ↔ `ViewKey` (GravTet release: analytical closed-form as reference + quadrature only) ---
export const allForwardGravityOptions: Array<{ label: string; value: ViewKey }> = [
  { label: 'Analytical (closed-form)', value: 'analytical_closedform' },
  { label: 'Quadrature second order (reference)', value: 'quadrature_reference' },
  { label: 'Quadrature second order (tiled)', value: 'quadrature_reference_tiled' },
  { label: 'Quadrature second order (SIMDTiled)', value: 'quadrature_simd_tiled' },
  { label: 'Quadrature second order (SIMDTiledThreading)', value: 'quadrature_simd_threading_tiled' },
]

export const forwardGravityOptions: Array<{ label: string; value: ViewKey }> = isExecutionBundle
  ? allForwardGravityOptions.filter((opt) => !EXECUTION_HIDDEN_VIEWS.has(opt.value))
  : allForwardGravityOptions
