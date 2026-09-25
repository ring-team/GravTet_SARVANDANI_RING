/**
 * Generic HTTP transport for the Flask backend: a JSON `fetch` wrapper plus
 * connection/error handling. Domain-agnostic — any service layer can build on `apiCall`.
 */

import { API_BASE_URL } from '../config/api/api.config'

async function tryDirectBackendFallback<T>(endpoint: string, options: RequestInit): Promise<T | null> {
  // In dev we usually call "/api" via Vite proxy. If proxy is down but backend is up,
  // retry direct backend URLs so calculations still work.
  if (!import.meta.env.DEV || API_BASE_URL !== '/api') return null
  const directBases = ['http://localhost:5002/api', 'http://127.0.0.1:5002/api']
  for (const base of directBases) {
    try {
      const response = await fetch(`${base}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })
      if (!response.ok) {
        throw new Error(await readHttpErrorMessage(response))
      }
      const bodyText = await response.text()
      return JSON.parse(bodyText) as T
    } catch {
      // Keep trying fallback targets.
    }
  }
  return null
}

// --- HTTP error bodies (JSON vs HTML fallback) ---

/** Prefer JSON `error` field; avoid showing only "Internal Server Error" when the body is HTML. */
async function readHttpErrorMessage(response: Response): Promise<string> {
  const text = await response.text()
  const trimmed = text.trim()
  if (trimmed.startsWith('{')) {
    try {
      const j = JSON.parse(trimmed) as { error?: string; traceback?: string }
      if (typeof j.error === 'string' && j.error.length > 0) {
        const hint =
          import.meta.env.DEV && typeof j.traceback === 'string' && j.traceback.length > 0
            ? `\n\n${j.traceback.slice(0, 8000)}`
            : ''
        return j.error + hint
      }
    } catch {
      /* fall through */
    }
  }
  if (trimmed.length > 0 && trimmed.length < 1200 && !trimmed.startsWith('<!')) {
    const compact = trimmed.replace(/\s+/g, ' ')
    if (/ECONNREFUSED|proxy error|socket hang up/i.test(compact)) {
      return (
        `Gravity backend is not running on port 5002 (Vite proxy: ${compact}). ` +
        'From the project root run: ./scripts/dev.sh — then refresh this page.'
      )
    }
    return compact
  }
  if (response.status >= 500) {
    return (
      `Gravity backend error (HTTP ${response.status}). ` +
      'Ensure the API is running: ./scripts/dev.sh — then check http://127.0.0.1:5002/api/health'
    )
  }
  return response.statusText || `HTTP ${response.status}`
}

// --- Shared `fetch` wrapper for JSON POST/GET ---

export async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`

  let response: Response
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
  } catch (e) {
    const fallback = await tryDirectBackendFallback<T>(endpoint, options)
    if (fallback != null) return fallback
    // Browsers throw TypeError for "Failed to fetch" (connection refused, DNS, CORS, wrong host).
    // Do not confuse this with an oversized physics job.
    const connectHint =
      `Cannot connect to the gravity service (${API_BASE_URL}). ` +
      `Please start the backend server on port 5002 and refresh the page. ` +
      `If you run the frontend outside dev mode, set VITE_API_URL to your backend API URL.`
    if (e instanceof TypeError) {
      throw new Error(`${connectHint} (${e.message})`)
    }
    throw e
  }

  if (!response.ok) {
    throw new Error(await readHttpErrorMessage(response))
  }

  const bodyText = await response.text()
  try {
    return JSON.parse(bodyText) as T
  } catch {
    throw new Error(
      `Invalid JSON from gravity API (${response.status}). First bytes: ${bodyText.slice(0, 120)}`
    )
  }
}
