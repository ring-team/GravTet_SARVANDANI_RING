/**
 * Gravity backend REST path catalog (relative to `API_BASE_URL`).
 */
export const GRAVITY_API_ENDPOINTS = {
  health: '/health',
  buildGmshTetraMesh: '/build_gmsh_tetra_mesh',
  computeGravityQuadrature: '/compute_gravity_quadrature',
  computeGravityAnalytical: '/compute_gravity_analytical',
  computeGravityMeshQuadrature: '/compute_gravity_mesh_quadrature',
  computeGravityAnalysis: '/compute_gravity_analysis',
  computeGravityMeshAnalysis: '/compute_gravity_mesh_analysis',
} as const
