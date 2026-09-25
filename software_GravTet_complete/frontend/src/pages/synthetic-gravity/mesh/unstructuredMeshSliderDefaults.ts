/**
 * **Default unstructured slider tuples** per base shape + tetra vs poly (target size, refinements, seed).
 *
 * Single source of truth for `MeshGridSourceControls` defaults and catalog-default proxy sync.
 */

export type UnstructuredSliderDefaults = {
  targetElementSize: number
  minElementSize: number
  surfaceRefinement: number
  localRefinementNearEdges: number
  meshQuality: number
  meshSeed: number
}

const MESH_SEED = 101

function withSeed(
  o: Omit<UnstructuredSliderDefaults, 'meshSeed'>,
): UnstructuredSliderDefaults {
  return { ...o, meshSeed: MESH_SEED }
}

/** Sphere — Unstructured Tetrahedral / Polyhedral */
export const sphereUnstructuredDefaults = {
  tetra: withSeed({
    targetElementSize: 1,
    minElementSize: 0.95,
    surfaceRefinement: 0.18,
    localRefinementNearEdges: 0.18,
    meshQuality: 0.45,
  }),
  poly: withSeed({
    targetElementSize: 1,
    minElementSize: 0.95,
    surfaceRefinement: 0.22,
    localRefinementNearEdges: 0.22,
    meshQuality: 0.55,
  }),
} as const

/** Ellipsoid — Unstructured Tetrahedral / Polyhedral */
export const ellipsoidUnstructuredDefaults = {
  tetra: withSeed({
    targetElementSize: 1,
    minElementSize: 0.95,
    surfaceRefinement: 0.38,
    localRefinementNearEdges: 0.38,
    meshQuality: 0.72,
  }),
  poly: withSeed({
    targetElementSize: 1,
    minElementSize: 1.0,
    surfaceRefinement: 0.7,
    localRefinementNearEdges: 0.32,
    meshQuality: 0.65,
  }),
} as const

/** Cube only (not cuboid) — Unstructured Tetrahedral / Polyhedral */
export const cubeUnstructuredDefaults = {
  tetra: withSeed({
    targetElementSize: 2,
    minElementSize: 0.85,
    surfaceRefinement: 0.4,
    localRefinementNearEdges: 0.4,
    meshQuality: 0.75,
  }),
  poly: withSeed({
    targetElementSize: 2,
    minElementSize: 0.85,
    surfaceRefinement: 0.38,
    localRefinementNearEdges: 0.38,
    meshQuality: 0.66,
  }),
} as const

/** Rectangular Prism (Cuboid) — Unstructured Tetrahedral / Polyhedral */
export const cuboidUnstructuredDefaults = {
  tetra: withSeed({
    targetElementSize: 1.3,
    minElementSize: 0.85,
    surfaceRefinement: 0.4,
    localRefinementNearEdges: 0.4,
    meshQuality: 0.75,
  }),
  poly: withSeed({
    targetElementSize: 1.4,
    minElementSize: 0.85,
    surfaceRefinement: 0.38,
    localRefinementNearEdges: 0.38,
    meshQuality: 0.66,
  }),
} as const

/** Valley–Mountain — same unstructured slider baseline as Cube. */
export const valleyMountainUnstructuredDefaults = cubeUnstructuredDefaults

/** Vertical / Horizontal Cylinder and any other box-style unstructured mesh */
export const cylinderLikeUnstructuredDefaults = {
  tetra: withSeed({
    targetElementSize: 1.35,
    minElementSize: 0.85,
    surfaceRefinement: 0.35,
    localRefinementNearEdges: 0.35,
    meshQuality: 0.66,
  }),
  poly: withSeed({
    targetElementSize: 1.5,
    minElementSize: 0.95,
    surfaceRefinement: 0.3,
    localRefinementNearEdges: 0.3,
    meshQuality: 0.6,
  }),
} as const

/**
 * Default proxy / Gmsh mesh size sliders per base shape + tetra vs poly.
 * (e.g. `Ellipsoid - Tetrahedral`).
 */
export function getProxyMeshSliderDefaults(modelType: string | null | undefined): UnstructuredSliderDefaults | null {
  if (!modelType) return null
  const suffix = modelType.includes(' - ') ? modelType.split(' - ').slice(1).join(' - ') : ''
  const isTetra =
    suffix === 'Tetrahedral' ||
    suffix === 'Gmsh Tetrahedral' ||
    suffix === 'Unstructured Tetrahedral' ||
    suffix === 'Unstructured Tetrahedral FEM/FVM'
  const isUnstructured = suffix.includes('Unstructured')
  if (!isUnstructured && !isTetra) return null

  const baseModel = modelType.split(' - ')[0]

  if (baseModel === 'Sphere') {
    return isTetra ? sphereUnstructuredDefaults.tetra : sphereUnstructuredDefaults.poly
  }
  if (baseModel === 'Ellipsoid') {
    return isTetra ? ellipsoidUnstructuredDefaults.tetra : ellipsoidUnstructuredDefaults.poly
  }
  if (baseModel === 'Cube') {
    return isTetra ? cubeUnstructuredDefaults.tetra : cubeUnstructuredDefaults.poly
  }
  if (baseModel === 'Rectangular Prism (Cuboid)') {
    return isTetra ? cuboidUnstructuredDefaults.tetra : cuboidUnstructuredDefaults.poly
  }
  if (baseModel === 'Valley-Mountain Model') {
    return isTetra ? valleyMountainUnstructuredDefaults.tetra : valleyMountainUnstructuredDefaults.poly
  }
  return isTetra ? cylinderLikeUnstructuredDefaults.tetra : cylinderLikeUnstructuredDefaults.poly
}

/** @deprecated Use getProxyMeshSliderDefaults */
export function getUnstructuredSliderDefaults(modelType: string | null | undefined): UnstructuredSliderDefaults | null {
  return getProxyMeshSliderDefaults(modelType)
}
