/**
 * Default mesh counts, density contrasts, and wireframe style helpers for synthetic gravity models.
 *
 * Tetrahedral only (GravTet release: no hexahedral or polyhedral mesh types shown).
 */
export type MeshMode = 'tetra'

/** Visual / discretization style for Cube & Cuboid wireframes (tetra only for this release). */
export type CubeWireStyle =
  | 'tetra'
  | 'unstructuredTetra'
  | 'gmshTetra'

const sep = ' - '

// --- Label suffix → cube/cuboid wireframe style ---

/** Parse full `modelType` (e.g. `Cube - Tetrahedral`) into wireframe style for box meshes. */
export function getCubeWireStyle(modelType: string): CubeWireStyle | null {
  const i = modelType.indexOf(sep)
  if (i < 0) return null
  const base = modelType.slice(0, i)
  if (base !== 'Cube' && base !== 'Rectangular Prism (Cuboid)') return null
  const suffix = modelType.slice(i + sep.length)
  switch (suffix) {
    case 'Tetrahedral':
    case 'Gmsh Tetrahedral':
    case 'Unstructured Tetrahedral':
    case 'Unstructured Tetrahedral FEM/FVM':
      return 'unstructuredTetra'
    default:
      return 'tetra'
  }
}

type BaseModel =
  | 'Cube'
  | 'Rectangular Prism (Cuboid)'
  | 'Sphere'
  | 'Ellipsoid'
  | 'Vertical Cylinder'
  | 'Horizontal Cylinder'
  | '4 Cubes'
  | 'Faulted Block Model'
  | 'Valley-Mountain Model'

export type CountSet = {
  numSourcesX?: number
  numSourcesY?: number
  numSourcesZ?: number
  numSourcesRadial?: number
  numSourcesTheta?: number
  numSourcesPhi?: number
  numSourcesLength?: number
}

/**
 * Per mesh-type defaults (tetrahedral only for this GravTet release).
 */

// --- Per-shape default source counts (tetra) ---

const defaults: Record<BaseModel, { tetra: CountSet }> = {
  'Cube': {
    tetra: { numSourcesX: 40, numSourcesY: 40, numSourcesZ: 20 },
  },
  'Rectangular Prism (Cuboid)': {
    tetra: { numSourcesX: 40, numSourcesY: 40, numSourcesZ: 20 },
  },
  'Sphere': {
    tetra: { numSourcesRadial: 20, numSourcesTheta: 40, numSourcesPhi: 40 },
  },
  'Ellipsoid': {
    // Ellipsoid wireframe uses the same surface parameterization semantics as Sphere.
    tetra: { numSourcesX: 20, numSourcesY: 40, numSourcesZ: 40 },
  },
  'Vertical Cylinder': {
    tetra: { numSourcesRadial: 30, numSourcesTheta: 40, numSourcesZ: 30 },
  },
  'Horizontal Cylinder': {
    tetra: { numSourcesRadial: 30, numSourcesTheta: 50, numSourcesLength: 30 },
  },
  '4 Cubes': {
    tetra: { numSourcesX: 40, numSourcesY: 40, numSourcesZ: 20 },
  },
  'Faulted Block Model': {
    tetra: { numSourcesX: 40, numSourcesY: 40, numSourcesZ: 20 },
  },
  'Valley-Mountain Model': {
    tetra: { numSourcesX: 50, numSourcesY: 40, numSourcesZ: 22 },
  },
}

// --- Resolve mesh family + counts from `modelType` string ---

export function getDefaultCounts(modelType?: string): { mode: MeshMode; counts: CountSet } {
  if (!modelType) return { mode: 'tetra', counts: { numSourcesX: 40, numSourcesY: 40, numSourcesZ: 20 } }
  const [base, suffix] = modelType.split(' - ')
  let mode: MeshMode = 'tetra'
  const baseModel = (base as BaseModel) || 'Cube'
  const entry = defaults[baseModel] || defaults['Cube']
  return { mode, counts: entry.tetra || entry['tetra'] || { numSourcesX: 40, numSourcesY: 40, numSourcesZ: 20 } }
}

// --- Sanitize numeric overrides from the mesh UI ---

/** Ignore cleared inputs (0) and invalid values so they do not replace catalog defaults in `mergeMeshCounts`. */
function sanitizeUiMeshOverride(override: Partial<CountSet>): Partial<CountSet> {
  const keys: (keyof CountSet)[] = [
    'numSourcesX',
    'numSourcesY',
    'numSourcesZ',
    'numSourcesRadial',
    'numSourcesTheta',
    'numSourcesPhi',
    'numSourcesLength',
  ]
  const out: Partial<CountSet> = {}
  for (const k of keys) {
    const v = override[k]
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
      out[k] = Math.floor(v)
    }
  }
  return out
}

// --- Merge catalog defaults with per-shape UI fields ---

/** Maps UI X/Y/Z source counts to the mesh keys each geometry expects (shared with forward API). */
export function mergeMeshCounts(modelType: string | null | undefined, override: Partial<CountSet> | undefined): CountSet {
  const { counts: d } = getDefaultCounts(modelType || undefined)
  if (!override) return d
  const o = sanitizeUiMeshOverride(override)
  if (Object.keys(o).length === 0) return d
  const base = (modelType || '').split(' - ')[0]
  if (base === 'Sphere') {
    return {
      ...d,
      // UI X/Y/Z: radial / theta / phi (backend uses same meaning).
      numSourcesX: o.numSourcesX ?? d.numSourcesRadial,
      numSourcesY: o.numSourcesY ?? d.numSourcesTheta,
      numSourcesZ: o.numSourcesZ ?? d.numSourcesPhi,
    }
  }
  if (base === 'Vertical Cylinder') {
    return {
      ...d,
      numSourcesRadial: o.numSourcesX ?? d.numSourcesRadial,
      numSourcesTheta: o.numSourcesY ?? d.numSourcesTheta,
      numSourcesZ: o.numSourcesZ ?? d.numSourcesZ,
    }
  }
  if (base === 'Horizontal Cylinder') {
    return {
      ...d,
      numSourcesRadial: o.numSourcesX ?? d.numSourcesRadial,
      numSourcesTheta: o.numSourcesY ?? d.numSourcesTheta,
      numSourcesLength: o.numSourcesZ ?? d.numSourcesLength,
    }
  }
  return {
    ...d,
    ...o,
  }
}

// --- Forward solver grid: map UI X/Y/Z to API semantics per base shape ---

/** Default forward-model source triple for App state when the user picks a model (X/Y/Z row). */
export function getDefaultForwardSourceCounts(modelType: string): {
  numSourcesX: number
  numSourcesY: number
  numSourcesZ: number
} {
  const { counts } = getDefaultCounts(modelType)
  const base = modelType.split(' - ')[0]
  if (base === 'Sphere') {
    return {
      // UI X/Y/Z: radial / theta / phi (backend uses same meaning).
      numSourcesX: counts.numSourcesRadial ?? 20,
      numSourcesY: counts.numSourcesTheta ?? 40,
      numSourcesZ: counts.numSourcesPhi ?? 40,
    }
  }
  if (base === 'Ellipsoid') {
    return {
      // UI X/Y/Z for ellipsoid wireframe: radial / theta / phi.
      numSourcesX: counts.numSourcesX ?? 20,
      numSourcesY: counts.numSourcesY ?? 40,
      numSourcesZ: counts.numSourcesZ ?? 40,
    }
  }
  if (base === 'Vertical Cylinder') {
    return {
      numSourcesX: counts.numSourcesRadial ?? 30,
      numSourcesY: counts.numSourcesTheta ?? 30,
      numSourcesZ: counts.numSourcesZ ?? 30,
    }
  }
  if (base === 'Horizontal Cylinder') {
    return {
      numSourcesX: counts.numSourcesRadial ?? 30,
      numSourcesY: counts.numSourcesTheta ?? 30,
      numSourcesZ: counts.numSourcesLength ?? 30,
    }
  }
  return {
    numSourcesX: counts.numSourcesX ?? 40,
    numSourcesY: counts.numSourcesY ?? 40,
    numSourcesZ: counts.numSourcesZ ?? 20,
  }
}

/** Default mesh-grid source triple for a base model name (Tetrahedral for this release). */
export function getDefaultForwardSourceCountsForBase(baseModel: string): {
  numSourcesX: number
  numSourcesY: number
  numSourcesZ: number
} {
  return getDefaultForwardSourceCounts(`${baseModel} - Tetrahedral`)
}
