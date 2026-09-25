/**
 * Global API configuration: resolves the backend base URL from Vite env + dev proxy.
 */

function resolveApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL
  if (typeof raw === 'string' && raw.trim() !== '') {
    return raw.replace(/\/$/, '')
  }
  // Production/static builds: full URL. Dev default is overridden by .env.development (/api → proxy).
  return import.meta.env.DEV ? '/api' : 'http://127.0.0.1:5002/api'
}

export const API_BASE_URL = resolveApiBaseUrl()

/** Exposed so UI can show the configured base URL in connection hints. */
export function getGravityApiBaseUrl(): string {
  return API_BASE_URL
}
