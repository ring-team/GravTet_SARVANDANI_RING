/**
 * Routes that display the gravity header cluster (synthetic + initial + forward solvers).
 */

import type { ViewKey } from '../types/view'

export const gravityViews: ViewKey[] = [
  'synthetic_gravity',
  'initial_model_gravity',
  'quadrature_reference',
  'quadrature_reference_tiled',
  'quadrature_simd_tiled',
  'quadrature_simd_threading_tiled',
  'analytical_closedform',
]
