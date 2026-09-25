/**
 * Shared TypeScript unions for top-level UI routing (`ViewKey`).
 */

// --- Top-level routes (see src/routes) ---

export type ViewKey =
  | 'home'
  | 'synthetic_gravity'
  | 'initial_model_gravity'
  | 'method1_reference'
  | 'method1_reference_tiled'
  | 'method1_simd_tiled'
  | 'method1_simd_threading_tiled'
  | 'quadrature_reference_tiled'
  | 'quadrature_reference'
  | 'quadrature_simd_tiled'
  | 'quadrature_simd_threading_tiled'
  | 'analytical_closedform'
  | 'amfm'
  | 'barnes_hut'

