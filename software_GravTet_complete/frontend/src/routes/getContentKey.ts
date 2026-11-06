/**
 * Derives a stable `content` string from `view` and selected catalog models.
 */

import type { ViewKey } from '../types/view'

export default function getContentKey(view: ViewKey, gravityModel: string | null) {
  if (view === 'home') return 'landing'
  if (view === 'initial_model_gravity') return 'initial_model'
  if (view === 'synthetic_gravity') {
    const baseModel = gravityModel?.split(' - ')[0] || ''
    if (baseModel === 'Cube') return 'cube3d'
    if (baseModel === 'Sphere') return 'sphere3d'
    if (baseModel === 'Valley-Mountain Model') return 'valleymountain3d'
    return gravityModel ? `Synthetic Gravity: ${gravityModel}` : 'Gravity Data Modeling'
  }
  if (
    view === 'quadrature_reference' ||
    view === 'quadrature_reference_tiled' ||
    view === 'quadrature_simd_tiled' ||
    view === 'quadrature_simd_threading_tiled'
  ) {
    return 'quadrature'
  }
  if (view === 'analytical_closedform') return 'analytical'
  return 'Select an option'
}
