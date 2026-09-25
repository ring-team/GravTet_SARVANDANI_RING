/**
 * Single source of truth for the URL ↔ `ViewKey` mapping.
 *
 * `App` reads the initial view from the path, keeps the address bar in sync when the
 * view changes, and restores the view on browser back/forward — so every screen has a
 * distinct, shareable URL.
 */
import type { ViewKey } from '../types/view'
import { EXECUTION_HIDDEN_VIEWS, isExecutionBundle } from '../config/appVariant'

/** Each top-level view → its browser path. */
export const viewToPath: Record<ViewKey, string> = {
  home: '/homepage',
  synthetic_gravity: '/syntheticgravitymodels',
  initial_model_gravity: '/initialmodel',
  analytical_closedform: '/forward/analytical',
  method1_reference: '/forward/direct-newton-reference',
  method1_reference_tiled: '/forward/direct-newton-tiled',
  method1_simd_tiled: '/forward/direct-newton-simd-tiled',
  method1_simd_threading_tiled: '/forward/direct-newton-simd-threading',
  quadrature_reference: '/forward/quadrature-reference',
  quadrature_reference_tiled: '/forward/quadrature-tiled',
  quadrature_simd_tiled: '/forward/quadrature-simd-tiled',
  quadrature_simd_threading_tiled: '/forward/quadrature-simd-threading',
  barnes_hut: '/forward/barnes-hut',
  amfm: '/forward/amfm',
}

const pathToViewMap: Record<string, ViewKey> = Object.fromEntries(
  Object.entries(viewToPath).map(([view, path]) => [path, view as ViewKey]),
) as Record<string, ViewKey>

/** Resolve a browser pathname back to a `ViewKey` (defaults to home). */
export function pathToView(pathname: string): ViewKey {
  if (pathname in pathToViewMap) {
    const view = pathToViewMap[pathname]
    if (isExecutionBundle && EXECUTION_HIDDEN_VIEWS.has(view)) return 'home'
    return view
  }
  if (pathname === '/' || pathname === '' || pathname === '/homepage') return 'home'
  // Legacy / prefixed fallbacks.
  if (pathname.startsWith('/initialmodel')) return 'initial_model_gravity'
  if (pathname.startsWith('/syntheticgravitymodels') || pathname.startsWith('/gravitymodeling')) return 'synthetic_gravity'
  return 'home'
}
