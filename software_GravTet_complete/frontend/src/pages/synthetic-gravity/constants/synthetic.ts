/**
 * Synthetic catalog constants: base shapes × mesh kinds, the full dropdown option list,
 * and legacy-label migration.
 */

/** Tetrahedral only (for GravTet focused release; no hexahedral or polyhedral). */
export const SYNTHETIC_MESH_SUFFIXES = [
  'Tetrahedral',
] as const

export const SYNTHETIC_GRAVITY_BASE_SHAPES = [
  'Cube',
  'Rectangular Prism (Cuboid)',
  'Sphere',
  'Ellipsoid',
  'Vertical Cylinder',
  'Horizontal Cylinder',
  '4 Cubes',
  'Faulted Block Model',
  'Valley-Mountain Model',
] as const

export function buildSyntheticCatalogOptions(baseShapes: readonly string[]): string[] {
  return baseShapes.flatMap((shape) =>
    SYNTHETIC_MESH_SUFFIXES.map((suffix) => `${shape} - ${suffix}`),
  )
}

/** Map legacy mesh labels to current catalog entries. */
export function migrateCatalogModelType(modelType: string | null): string | null {
  if (!modelType || !modelType.includes(' - ')) return modelType
  const base = modelType.split(' - ')[0]
  const suffix = modelType.split(' - ').slice(1).join(' - ').trim()
  if (
    suffix === 'Unstructured Tetrahedral' ||
    suffix === 'Unstructured Tetrahedral FEM/FVM' ||
    suffix === 'Gmsh Tetrahedral' ||
    suffix === 'Hexahedral' ||
    suffix === 'Unstructured Polyhedral' ||
    suffix === 'Unstructured Polyhedral Analytic' ||
    suffix === 'Polyhedral'
  ) {
    return `${base} - Tetrahedral`
  }
  return modelType
}

// --- Synthetic Gravity modal: full catalog strings (shape × mesh kind) ---
export const gravityOptions = buildSyntheticCatalogOptions(SYNTHETIC_GRAVITY_BASE_SHAPES)
