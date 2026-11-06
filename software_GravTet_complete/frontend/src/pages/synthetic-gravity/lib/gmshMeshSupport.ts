/** Catalog helpers for **Tetrahedral** mesh (server-built Gmsh adaptive tets). */

import type { TetraMeshElement, TetraMeshNode } from '../../../services/api'
import { getProxyMeshSliderDefaults } from '../../../pages/synthetic-gravity/mesh/unstructuredMeshSliderDefaults'

export const TETRAHEDRAL_SUFFIX = 'Tetrahedral'

/** @deprecated Use TETRAHEDRAL_SUFFIX */
export const GMSH_TETRAHEDRAL_SUFFIX = TETRAHEDRAL_SUFFIX

/** Primitive catalog shapes with a server-side Gmsh tetra builder. */
export const GMSH_MESH_BUILD_SUPPORTED_BASE_MODELS = [
  'Sphere',
  'Cube',
  'Rectangular Prism (Cuboid)',
  'Ellipsoid',
  'Vertical Cylinder',
  'Horizontal Cylinder',
  '4 Cubes',
  'Faulted Block Model',
  'Valley-Mountain Model',
] as const

export type GmshMeshBuildStats = {
  numNodes: number
  numElements: number
  buildMs: number
}

export type GmshBuiltMeshPreview = {
  nodes: TetraMeshNode[]
  elements: TetraMeshElement[]
  stats: GmshMeshBuildStats
}

/** Shown when Tetrahedral is selected but the shape builder is not implemented yet. */
export const GMSH_MESH_UNSUPPORTED_SHAPE_MESSAGE =
  'Tetrahedral mesh generation for this shape is not implemented yet. ' +
  `Supported shapes: ${GMSH_MESH_BUILD_SUPPORTED_BASE_MODELS.join(', ')}.`

/** @deprecated Use GMSH_MESH_UNSUPPORTED_SHAPE_MESSAGE or server error text. */
export const GMSH_MESH_NOT_READY_MESSAGE = GMSH_MESH_UNSUPPORTED_SHAPE_MESSAGE

function getBaseModel(modelType: string | null | undefined): string {
  return (modelType || '').split(' - ')[0].trim()
}

export function meshCatalogSuffix(modelType: string | null | undefined): string {
  if (!modelType || !modelType.includes(' - ')) return ''
  return modelType.split(' - ').slice(1).join(' - ').trim()
}

function isLegacyTetrahedralSuffix(suffix: string): boolean {
  return (
    suffix === 'Gmsh Tetrahedral' ||
    suffix === 'Unstructured Tetrahedral' ||
    suffix === 'Unstructured Tetrahedral FEM/FVM'
  )
}

export function isTetrahedralModel(modelType: string | null | undefined): boolean {
  const s = meshCatalogSuffix(modelType)
  return s === TETRAHEDRAL_SUFFIX || isLegacyTetrahedralSuffix(s)
}

/** @deprecated Use isTetrahedralModel */
export const isGmshTetrahedralModel = isTetrahedralModel

export function isGmshMeshBuildSupported(modelType: string | null | undefined): boolean {
  return (
    isTetrahedralModel(modelType) &&
    GMSH_MESH_BUILD_SUPPORTED_BASE_MODELS.includes(
      getBaseModel(modelType) as (typeof GMSH_MESH_BUILD_SUPPORTED_BASE_MODELS)[number],
    )
  )
}

export function getGmshMeshSizing(model: {
  modelType?: string | null
  gmshTargetElementSize?: number
  gmshSurfaceRefinement?: number
  gmshLocalRefinementNearEdges?: number
}): {
  targetElementSize: number
  surfaceRefinement: number
  localRefinementNearEdges: number
} {
  const catalog = model.modelType ? getProxyMeshSliderDefaults(model.modelType) : null
  const surfaceRefinement =
    model.gmshSurfaceRefinement ?? catalog?.surfaceRefinement ?? 0.25
  return {
    targetElementSize: model.gmshTargetElementSize ?? catalog?.targetElementSize ?? 2,
    surfaceRefinement,
    localRefinementNearEdges:
      model.gmshLocalRefinementNearEdges ?? catalog?.localRefinementNearEdges ?? surfaceRefinement,
  }
}

// Polyhedral support removed for this release (tetra only)

/** Server Gmsh tet mesh for catalog Tetrahedral entries. */
export function forwardUsesTetraMeshRequest(modelType: string | null | undefined): boolean {
  return isTetrahedralModel(modelType)
}

/** @deprecated Use forwardUsesTetraMeshRequest */
export const forwardUsesGmshTetraMeshRequest = forwardUsesTetraMeshRequest

/** @deprecated Browser grid tet catalog entries removed */
export function forwardUsesGridTetraMeshRequest(_modelType: string | null | undefined): boolean {
  return false
}

export function forwardUsesTetraMeshPayload(modelType: string | null | undefined): boolean {
  return forwardUsesTetraMeshRequest(modelType)
}

/** Sliders for target element size / refinement (tetrahedral Gmsh). */
export function usesProxyMeshSizeSliders(modelType: string | null | undefined): boolean {
  return isTetrahedralModel(modelType)
}

/** Quadrature second-order tet mesh routes (Gmsh Tetrahedral catalog). */
export function isQuadratureTetraMeshModel(modelType: string | null | undefined): boolean {
  return isTetrahedralModel(modelType)
}
