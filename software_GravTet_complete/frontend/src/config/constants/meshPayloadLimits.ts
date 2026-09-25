/**
 * Client-side mesh JSON payload limits (browser serialization safety).
 * Used by `services/gravityApi.ts` before POSTing large tetra meshes.
 */

/** Maximum node count allowed in a mesh request body built in the browser. */
export const MAX_CLIENT_MESH_NODES = 3_000_000

/** Maximum element count allowed in a mesh request body built in the browser. */
export const MAX_CLIENT_MESH_ELEMENTS = 10_000_000

/** Conservative upper bound on JSON string length (~characters) for mesh POST bodies. */
export const MAX_CLIENT_MESH_JSON_CHARS = 350_000_000
