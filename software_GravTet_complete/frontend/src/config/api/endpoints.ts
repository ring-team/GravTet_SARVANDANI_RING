/**
 * Gravity backend REST path catalog (relative to `API_BASE_URL`).
 * Keep paths here so `services/gravityApi.ts` stays logic-only.
 */

export const GRAVITY_API_ENDPOINTS = {
  health: '/health',
  buildGmshTetraMesh: '/build_gmsh_tetra_mesh',
  computeGravity: '/compute_gravity',
  computeGravityQuadrature: '/compute_gravity_quadrature',
  computeGravityAnalytical: '/compute_gravity_analytical',
  computeGravityMeshDirect: '/compute_gravity_mesh_direct',
  computeGravityMeshQuadrature: '/compute_gravity_mesh_quadrature',
  computeGravityAMFM: '/compute_gravity_amfm',
  computeGravityBarnesHut: '/compute_gravity_barnes_hut',
  computeGravityAnalysis: '/compute_gravity_analysis',
  computeGravityMeshAnalysis: '/compute_gravity_mesh_analysis',
} as const
