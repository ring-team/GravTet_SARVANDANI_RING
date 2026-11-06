/**
 * Public API surface for the gravity backend (barrel).
 *
 * Split by concern:
 *  - `httpClient.ts`  — generic JSON `fetch` transport + error handling
 *  - `gravityApi.ts`  — the `api` endpoint catalog + payload guards + response normalization
 *  - `types/gravity`  — request/response DTO types
 *
 * Importers should keep importing from `services/api` so the underlying split can evolve freely.
 */

export * from '../types/gravity'
export { api, normalizeGravityResponse } from './gravityApi'
export { getGravityApiBaseUrl } from '../config/api/api.config'
