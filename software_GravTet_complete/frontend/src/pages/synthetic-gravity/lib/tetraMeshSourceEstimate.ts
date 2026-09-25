/** Tets per hexa voxel: symmetric dual split (12) or single 6-tet partition (structured curved). */
export const TETRA_MESH_TETS_PER_VOXEL = 12
export const STRUCTURED_CURVED_TETS_PER_VOXEL = 6

const CURVED_BASE_MODELS = new Set([
  'Sphere',
  'Ellipsoid',
  'Vertical Cylinder',
  'Horizontal Cylinder',
])

function baseModelType(modelType: string | null | undefined): string {
  return (modelType || '').split(' - ')[0].trim()
}

function voxelsInCatalogGrid(
  modelType: string | null | undefined,
  numSourcesX: number,
  numSourcesY: number,
  numSourcesZ: number,
): number {
  const base = numSourcesX * numSourcesY * numSourcesZ
  return baseModelType(modelType) === '4 Cubes' ? base * 4 : base
}

/** Pre-flight element count for tetrahedral mesh forward runs (tetra only release). */
export function estimateMeshElementCount(
  modelType: string | null | undefined,
  numSourcesX: number,
  numSourcesY: number,
  numSourcesZ: number,
): number {
  const mt = modelType || ''
  const voxels = voxelsInCatalogGrid(mt, numSourcesX, numSourcesY, numSourcesZ)
  if (mt.includes('Tetrahedral')) {
    return voxels * TETRA_MESH_TETS_PER_VOXEL
  }
  return numSourcesX * numSourcesY * numSourcesZ
}
