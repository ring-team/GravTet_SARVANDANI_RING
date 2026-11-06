/**
 * Global API configuration: resolves the backend base URL from Vite env + same-origin `/api`.
 */

function resolveApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL
  if (typeof raw === 'string' && raw.trim() !== '') {
    return raw.replace(/\/$/, '')
  }
  // Vite dev uses the `/api` proxy. Execution/static builds are served by Flask
  // on the same origin (port 8765), so `/api` must stay relative.
  return '/api'
}

export const API_BASE_URL = resolveApiBaseUrl()

/** Exposed so UI can show the configured base URL in connection hints. */
export function getGravityApiBaseUrl(): string {
  return API_BASE_URL
}

/** Browser-facing health URL (same origin when the API base is `/api`). */
export function getGravityHealthUrl(): string {
  const base = API_BASE_URL
  if (base.startsWith('http://') || base.startsWith('https://')) {
    return `${base}/health`
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}${base}/health`
}
