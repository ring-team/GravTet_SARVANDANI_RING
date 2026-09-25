/**
 * Routes that display the gravity header cluster (synthetic + initial + forward solvers).
 */

import type { ViewKey } from '../types/view'

export const gravityViews: ViewKey[] = [
  'synthetic_gravity',
  'initial_model_gravity',
  'method1_reference',
  'method1_reference_tiled',
  'method1_simd_tiled',
  'method1_simd_threading_tiled',
  'quadrature_reference_tiled',
  'quadrature_reference',
  'quadrature_simd_tiled',
  'quadrature_simd_threading_tiled',
  'analytical_closedform',
  'barnes_hut',
  'amfm',
]
