/**
 * Single source of truth for the URL ↔ `ViewKey` mapping.
 */
import type { ViewKey } from '../types/view'
import { EXECUTION_HIDDEN_VIEWS, isExecutionBundle } from '../config/appVariant'

export const viewToPath: Record<ViewKey, string> = {
  home: '/homepage',
  synthetic_gravity: '/syntheticgravitymodels',
  initial_model_gravity: '/initialmodel',
  analytical_closedform: '/forward/analytical',
  quadrature_reference: '/forward/quadrature-reference',
  quadrature_reference_tiled: '/forward/quadrature-tiled',
  quadrature_simd_tiled: '/forward/quadrature-simd-tiled',
  quadrature_simd_threading_tiled: '/forward/quadrature-simd-threading',
}

const pathToViewMap: Record<string, ViewKey> = Object.fromEntries(
  Object.entries(viewToPath).map(([view, path]) => [path, view as ViewKey]),
) as Record<string, ViewKey>

const LEGACY_PATH_FALLBACKS: Record<string, ViewKey> = {
  '/forward/direct-newton-reference': 'quadrature_reference',
  '/forward/direct-newton-tiled': 'quadrature_reference_tiled',
  '/forward/direct-newton-simd-tiled': 'quadrature_simd_tiled',
  '/forward/direct-newton-simd-threading': 'quadrature_simd_threading_tiled',
  '/forward/barnes-hut': 'quadrature_reference',
  '/forward/amfm': 'quadrature_reference',
}

export function pathToView(pathname: string): ViewKey {
  if (pathname in pathToViewMap) {
    const view = pathToViewMap[pathname]
    if (isExecutionBundle && EXECUTION_HIDDEN_VIEWS.has(view)) return 'home'
    return view
  }
  const legacy = LEGACY_PATH_FALLBACKS[pathname]
  if (legacy) {
    if (isExecutionBundle && EXECUTION_HIDDEN_VIEWS.has(legacy)) return 'home'
    return legacy
  }
  if (pathname === '/' || pathname === '' || pathname === '/homepage') return 'home'
  if (pathname.startsWith('/initialmodel')) return 'initial_model_gravity'
  if (pathname.startsWith('/syntheticgravitymodels') || pathname.startsWith('/gravitymodeling')) return 'synthetic_gravity'
  return 'home'
}
