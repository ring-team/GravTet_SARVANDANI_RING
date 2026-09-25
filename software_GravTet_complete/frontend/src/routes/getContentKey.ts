/**
 * Derives a stable `content` string from `view` and selected catalog models.
 */

import type { ViewKey } from '../types/view'

export default function getContentKey(view: ViewKey, gravityModel: string | null) {
  if (view === 'home') return 'landing'
  if (view === 'initial_model_gravity') return 'initial_model'
  // --- Synthetic gravity: map catalog base name → `*3d` content key ---
  if (view === 'synthetic_gravity') {
    const baseModel = gravityModel?.split(' - ')[0] || ''
    if (baseModel === 'Cube') return 'cube3d'
    if (baseModel === 'Rectangular Prism (Cuboid)') return 'cuboid3d'
    if (baseModel === 'Sphere') return 'sphere3d'
    if (baseModel === 'Ellipsoid') return 'ellipsoid3d'
    if (baseModel === 'Vertical Cylinder') return 'verticalcylinder3d'
    if (baseModel === 'Horizontal Cylinder') return 'horizontalcylinder3d'
    if (baseModel === '4 Cubes') return 'fourcubes3d'
    if (baseModel === 'Faulted Block Model') return 'faultedblock3d'
    if (baseModel === 'Valley-Mountain Model') return 'valleymountain3d'
    return gravityModel ? `Synthetic Gravity: ${gravityModel}` : 'Gravity Data Modeling'
  }
  // --- Forward-gravity solver views ---
  if (view === 'method1_reference' || view === 'method1_reference_tiled' || view === 'method1_simd_tiled' || view === 'method1_simd_threading_tiled') return 'directnewton'
  if (view === 'quadrature_reference_tiled' || view === 'quadrature_reference' || view === 'quadrature_simd_tiled' || view === 'quadrature_simd_threading_tiled') return 'quadrature'
  if (view === 'analytical_closedform') return 'analytical'
  if (view === 'amfm') return 'amfm'
  if (view === 'barnes_hut') return 'barnes_hut'
  return 'Select an option'
}
