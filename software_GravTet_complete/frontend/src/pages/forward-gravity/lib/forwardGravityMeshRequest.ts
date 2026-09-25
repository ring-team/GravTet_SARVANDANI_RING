import type { TetraMeshRequest } from '../../../services/api'
import { api } from '../../../services/api'
import type { ForwardModelParams } from './forwardModelParams'
import type { SurfaceBounds } from '../shared/GravityMapView'
import { getModelCenterForForwardGravity, getModelDepthAndDensityForForwardGravity } from './forwardGravityModelCenter'
import {
  forwardUsesGmshTetraMeshRequest,
  forwardUsesTetraMeshRequest,
  getGmshMeshSizing,
  GMSH_MESH_UNSUPPORTED_SHAPE_MESSAGE,
  isGmshMeshBuildSupported,
  type GmshMeshBuildStats,
} from '../../synthetic-gravity/lib/gmshMeshSupport'
import { getDefaultForwardSourceCounts } from '../../synthetic-gravity/default_data/defaultSources'
import { getProxyMeshSliderDefaults } from '../../synthetic-gravity/mesh/unstructuredMeshSliderDefaults'
import { applyGmshMeshWarmReadiness } from '../../synthetic-gravity/lib/gmshMeshPreviewCache'

export type { GmshMeshBuildStats }

export type ForwardMeshBuildResult = {
  meshRequest?: TetraMeshRequest | null
  /** Gmsh catalog params for server-side mesh build + forward (no mesh in browser). */
  gmshServerComputeBody?: Record<string, unknown>
  gmshBuildStats?: GmshMeshBuildStats
}

export {
  forwardUsesGmshTetraMeshRequest,
  forwardUsesTetraMeshRequest,
  forwardUsesTetraMeshPayload,
} from '../../synthetic-gravity/lib/gmshMeshSupport'

export function gmshStatsFromSolverMeta(
  solverMeta: Record<string, unknown> | null | undefined,
): GmshMeshBuildStats | null {
  const raw = solverMeta?.gmshBuild
  if (!raw || typeof raw !== 'object') return null
  const g = raw as Record<string, unknown>
  if (typeof g.numNodes !== 'number' || typeof g.numElements !== 'number') return null
  return {
    numNodes: g.numNodes,
    numElements: g.numElements,
    buildMs: typeof g.buildMs === 'number' ? g.buildMs : 0,
  }
}

const GMSH_PROXY_CELL_TO_CHARACTERISTIC_LENGTH = 1.5
/** Blend continuous proxy cell into ceiled proxy so nearby slider values do not share identical Gmsh counts. */
const GMSH_PROXY_CONTINUOUS_BLEND = 0.05

function getGmshCalibrationSpans(model: ForwardModelParams): { sx: number; sy: number; sz: number } {
  const base = (model.modelType || '').split(' - ')[0]
  if (base === 'Sphere') {
    const r = Math.max(1e-6, model.sphereRadius || 100)
    return { sx: 2 * r, sy: 2 * r, sz: 2 * r }
  }
  if (base === 'Ellipsoid') {
    return {
      sx: Math.max(1e-6, 2 * (model.ellipsoidA || 200)),
      sy: Math.max(1e-6, 2 * (model.ellipsoidB || 100)),
      sz: Math.max(1e-6, 2 * (model.ellipsoidC || 150)),
    }
  }
  if (base === 'Vertical Cylinder') {
    return {
      sx: Math.max(1e-6, 2 * (model.verticalCylinderRadius || 50)),
      sy: Math.max(1e-6, 2 * (model.verticalCylinderRadius || 50)),
      sz: Math.max(1e-6, model.verticalCylinderHeight || 100),
    }
  }
  if (base === 'Horizontal Cylinder') {
    const r = Math.max(1e-6, model.horizontalCylinderRadius || 50)
    const length = Math.max(1e-6, model.horizontalCylinderLength || 100)
    return { sx: length, sy: 2 * r, sz: 2 * r }
  }
  if (base === '4 Cubes') {
    return {
      sx: Math.max(1e-6, model.spacingX || 80),
      sy: Math.max(1e-6, model.spacingY || 80),
      sz: Math.max(
        1e-6,
        Math.max(model.cube1Z || 20, model.cube2Z || 20, model.cube3Z || 20, model.cube4Z || 20),
      ),
    }
  }
  if (base === 'Faulted Block Model') {
    return {
      sx: Math.max(1e-6, model.faultedBlockX || 100),
      sy: Math.max(1e-6, model.faultedBlockY || 100),
      sz: Math.max(1e-6, model.faultedBlockZ || 100),
    }
  }
  if (base === 'Valley-Mountain Model') {
    const blockX = Math.max(1e-6, model.valleyMountainX ?? model.cubeX ?? 400)
    const blockY = Math.max(1e-6, model.valleyMountainY ?? model.cubeY ?? 140)
    const blockZ = Math.max(1e-6, model.valleyMountainZ ?? model.cubeZ ?? 90)
    return { sx: blockX + 200, sy: blockY + 100, sz: blockZ + 30 }
  }
  return {
    sx: Math.max(1e-6, model.cubeX || 100),
    sy: Math.max(1e-6, model.cubeY || 100),
    sz: Math.max(1e-6, model.cubeZ || 100),
  }
}

function computeContinuousProxyCellSize(
  model: ForwardModelParams,
  sizing: ReturnType<typeof getGmshMeshSizing>,
): number {
  const modelType = model.modelType ?? ''
  const base = modelType.split(' - ')[0]
  const isSphere = base === 'Sphere'
  const isEllipsoid = base === 'Ellipsoid'
  const isUnstructuredPoly = false // polyhedral removed for this release; always tetra
  const baseline = getDefaultForwardSourceCounts(modelType)
  const catalog = getProxyMeshSliderDefaults(modelType)
  const te = Math.max(1e-3, sizing.targetElementSize)
  const sr = sizing.surfaceRefinement
  const lr = sizing.localRefinementNearEdges
  const mq = catalog?.meshQuality ?? 0.75

  const refinementExponent =
    isSphere
      ? isUnstructuredPoly
        ? 0.85
        : 0.82
      : isEllipsoid
        ? 1.0
        : 0.9
  const refinement = Math.pow(1 / Math.max(1e-6, te), refinementExponent)
  const maxRefinement = isSphere ? (isUnstructuredPoly ? 6 : 5) : isEllipsoid ? 9 : 8
  const refinementClamped = Math.max(0.04, Math.min(maxRefinement, refinement))

  const surfaceMultiplier = 1 + sr * (isSphere ? (isUnstructuredPoly ? 0.46 : 0.4) : isEllipsoid ? 0.8 : 0.75)
  const edgeMultiplier = 1 + lr * (isSphere ? (isUnstructuredPoly ? 0.46 : 0.4) : isEllipsoid ? 0.8 : 0.75)
  const q = Math.max(0, Math.min(1, mq))
  const qualityMultiplier =
    isSphere
      ? isUnstructuredPoly
        ? 0.92 + q * 0.14
        : 0.9 + q * 0.1
      : isEllipsoid
        ? 0.85 + q * 0.35
        : 0.9 + q * 0.28

  const rawNx = Math.max(1, (baseline.numSourcesX ?? 1) * refinementClamped * edgeMultiplier * qualityMultiplier)
  const rawNy = Math.max(1, (baseline.numSourcesY ?? 1) * refinementClamped * surfaceMultiplier * qualityMultiplier)
  const rawNz = Math.max(1, (baseline.numSourcesZ ?? 1) * refinementClamped * surfaceMultiplier * qualityMultiplier)

  const { sx, sy, sz } = getGmshCalibrationSpans(model)
  return Math.max(sx / rawNx, sy / rawNy, sz / rawNz)
}

function calibrateGmshTargetElementSize(
  model: ForwardModelParams,
  sizing: ReturnType<typeof getGmshMeshSizing>,
  proxyCounts?: { numSourcesX?: number; numSourcesY?: number; numSourcesZ?: number },
): number {
  if (!proxyCounts) return sizing.targetElementSize
  const { sx, sy, sz } = getGmshCalibrationSpans(model)
  const nx = Math.max(1, Math.floor(proxyCounts.numSourcesX || 1))
  const ny = Math.max(1, Math.floor(proxyCounts.numSourcesY || 1))
  const nz = Math.max(1, Math.floor(proxyCounts.numSourcesZ || 1))
  const ceilProxyCellSize = Math.max(sx / nx, sy / ny, sz / nz)
  const continuousProxyCellSize = computeContinuousProxyCellSize(model, sizing)
  const proxyCellSize =
    ceilProxyCellSize +
    GMSH_PROXY_CONTINUOUS_BLEND * (continuousProxyCellSize - ceilProxyCellSize)
  return Math.max(
    sizing.targetElementSize,
    proxyCellSize * GMSH_PROXY_CELL_TO_CHARACTERISTIC_LENGTH,
  )
}

export function buildForwardTetraMeshRequest(input: {
  model: ForwardModelParams
  numSourcesX: number
  numSourcesY: number
  numSourcesZ: number
  numReceiversX: number
  numReceiversY: number
  surfaceBounds: SurfaceBounds
  executionMode?: TetraMeshRequest['executionMode']
  numThreads?: number
}): TetraMeshRequest | null {
  return null
}

export function buildGmshMeshPreviewBody(input: {
  model: ForwardModelParams
  numSourcesX?: number
  numSourcesY?: number
  numSourcesZ?: number
}): Record<string, unknown> {
  const sizing = getGmshMeshSizing(input.model)
  return gmshBuildRequestBody(input.model, sizing, input)
}

/** Source-count preview also warms the server-side forward Gmsh mesh cache. */
export function buildGmshMeshCountPreviewBody(input: {
  model: ForwardModelParams
  numSourcesX?: number
  numSourcesY?: number
  numSourcesZ?: number
}): Record<string, unknown> {
  const sizing = getGmshMeshSizing(input.model)
  const warmCenter = getModelCenterForForwardGravity(input.model)
  const modelForCount: ForwardModelParams = {
    ...input.model,
    h: 0,
    sphereH: 0,
    ellipsoidH: 0,
    verticalCylinderH: 0,
    horizontalCylinderH: 0,
    faultedBlockH: 0,
  }
  return {
    ...gmshBuildRequestBody(modelForCount, sizing, input),
    warmCacheOnly: true,
    warmCenterZ: warmCenter.centerZ,
  }
}

/** Ensure server-side Gmsh mesh + ctypes geometry are ready before forward calculate. */
export async function ensureGmshMeshGeometryReady(input: {
  model: ForwardModelParams
  numSourcesX: number
  numSourcesY: number
  numSourcesZ: number
}): Promise<{ stats: GmshMeshBuildStats; calculateReady: boolean }> {
  const body = buildGmshMeshCountPreviewBody(input)
  const built = await api.buildGmshTetraMesh(body)
  const stats: GmshMeshBuildStats = {
    numNodes: built.numNodes,
    numElements: built.numElements,
    buildMs: built.buildMs ?? 0,
  }
  const cacheKey = gmshMeshCountPreviewCacheKey(body)
  const calculateReady = applyGmshMeshWarmReadiness(cacheKey, built)
  return { stats, calculateReady }
}

/** Stable cache key for Gmsh source-count preview (burial depth excluded from client refetch). */
export function gmshMeshCountPreviewCacheKey(body: Record<string, unknown>): string {
  const {
    h: _h,
    sphereH: _sh,
    ellipsoidH: _eh,
    verticalCylinderH: _vh,
    horizontalCylinderH: _hh,
    faultedBlockH: _fh,
    centerZ: _cz,
    countOnly: _co,
    warmCacheOnly: _wco,
    warmCenterZ: _wcz,
    cacheHit: _ch,
    buildMs: _bm,
    ...rest
  } = body
  return JSON.stringify(rest)
}

function gmshBuildRequestBody(
  model: ForwardModelParams,
  sizing: ReturnType<typeof getGmshMeshSizing>,
  proxyCounts?: { numSourcesX?: number; numSourcesY?: number; numSourcesZ?: number },
) {
  const center = getModelCenterForForwardGravity(model)
  const { h, density } = getModelDepthAndDensityForForwardGravity(model)
  const base = (model.modelType || '').split(' - ')[0]
  const targetElementSize = calibrateGmshTargetElementSize(model, sizing, proxyCounts)
  const body: Record<string, unknown> = {
    modelType: model.modelType,
    centerX: center.centerX,
    centerY: center.centerY,
    centerZ: center.centerZ,
    h,
    density,
    targetElementSize,
    surfaceRefinement: sizing.surfaceRefinement,
    localRefinementNearEdges: sizing.localRefinementNearEdges,
  }
  if (base === 'Sphere') {
    body.sphereRadius = model.sphereRadius
    body.sphereH = model.sphereH ?? h
    body.sphereDensity = model.sphereDensity ?? density
  }
  if (base === 'Cube' || base === 'Rectangular Prism (Cuboid)') {
    body.cubeX = model.cubeX
    body.cubeY = model.cubeY
    body.cubeZ = model.cubeZ
  }
  if (base === 'Ellipsoid') {
    body.ellipsoidA = model.ellipsoidA
    body.ellipsoidB = model.ellipsoidB
    body.ellipsoidC = model.ellipsoidC
    body.ellipsoidH = model.ellipsoidH ?? h
    body.ellipsoidDensity = model.ellipsoidDensity ?? density
  }
  if (base === 'Vertical Cylinder') {
    body.verticalCylinderRadius = model.verticalCylinderRadius
    body.verticalCylinderHeight = model.verticalCylinderHeight
    body.verticalCylinderH = model.verticalCylinderH ?? h
    body.verticalCylinderDensity = model.verticalCylinderDensity ?? density
  }
  if (base === 'Horizontal Cylinder') {
    body.horizontalCylinderRadius = model.horizontalCylinderRadius
    body.horizontalCylinderLength = model.horizontalCylinderLength
    body.horizontalCylinderH = model.horizontalCylinderH ?? h
    body.horizontalCylinderDensity = model.horizontalCylinderDensity ?? density
  }
  if (base === '4 Cubes') {
    body.spacingX = model.spacingX
    body.spacingY = model.spacingY
    body.cube1X = model.cube1X
    body.cube1Y = model.cube1Y
    body.cube1Z = model.cube1Z
    body.cube1H = model.cube1H
    body.cube1Density = model.cube1Density
    body.cube1OffsetX = model.cube1OffsetX
    body.cube1OffsetY = model.cube1OffsetY
    body.cube2X = model.cube2X
    body.cube2Y = model.cube2Y
    body.cube2Z = model.cube2Z
    body.cube2H = model.cube2H
    body.cube2Density = model.cube2Density
    body.cube2OffsetX = model.cube2OffsetX
    body.cube2OffsetY = model.cube2OffsetY
    body.cube3X = model.cube3X
    body.cube3Y = model.cube3Y
    body.cube3Z = model.cube3Z
    body.cube3H = model.cube3H
    body.cube3Density = model.cube3Density
    body.cube3OffsetX = model.cube3OffsetX
    body.cube3OffsetY = model.cube3OffsetY
    body.cube4X = model.cube4X
    body.cube4Y = model.cube4Y
    body.cube4Z = model.cube4Z
    body.cube4H = model.cube4H
    body.cube4Density = model.cube4Density
    body.cube4OffsetX = model.cube4OffsetX
    body.cube4OffsetY = model.cube4OffsetY
  }
  if (base === 'Faulted Block Model') {
    body.faultedBlockX = model.faultedBlockX
    body.faultedBlockY = model.faultedBlockY
    body.faultedBlockZ = model.faultedBlockZ
    body.faultedBlockFaultOffset = model.faultedBlockFaultOffset
    body.faultedBlockH = model.faultedBlockH ?? h
    body.faultedBlockDensity = model.faultedBlockDensity ?? density
  }
  if (base === 'Valley-Mountain Model') {
    body.valleyMountainX = model.valleyMountainX ?? model.cubeX
    body.valleyMountainY = model.valleyMountainY ?? model.cubeY
    body.valleyMountainZ = model.valleyMountainZ ?? model.cubeZ
    body.valleyMountainHeight = model.valleyMountainHeight ?? model.valleyMountainAmplitude
    body.valleyMountainDepth = model.valleyMountainDepth ?? model.valleyMountainAmplitude
    body.valleyMountainAmplitude = model.valleyMountainAmplitude ?? model.valleyMountainHeight
    body.valleyMountainHalfSpaceDensity =
      model.valleyMountainHalfSpaceDensity ?? model.valleyMountainValleyDensity
    body.valleyMountainMountainDensity = model.valleyMountainMountainDensity ?? density
    body.valleyMountainValleyDensity = model.valleyMountainValleyDensity
  }
  return body
}

/** Params for server-side Gmsh build + mesh forward (mesh never sent through the browser). */
export function buildForwardGmshServerComputeBody(input: {
  model: ForwardModelParams
  numSourcesX?: number
  numSourcesY?: number
  numSourcesZ?: number
  numReceiversX: number
  numReceiversY: number
  surfaceBounds: SurfaceBounds
  executionMode?: TetraMeshRequest['executionMode']
  numThreads?: number
  receiverBlockSize?: number
  sourceBlockSize?: number
  simdLanes?: number
}): Record<string, unknown> {
  const sizing = getGmshMeshSizing(input.model)
  const body: Record<string, unknown> = {
    ...gmshBuildRequestBody(input.model, sizing, input),
    numReceiversX: input.numReceiversX,
    numReceiversY: input.numReceiversY,
    surfaceXMin: input.surfaceBounds.xMin,
    surfaceXMax: input.surfaceBounds.xMax,
    surfaceYMin: input.surfaceBounds.yMin,
    surfaceYMax: input.surfaceBounds.yMax,
    surfaceZ: 0,
  }
  if (input.executionMode) body.executionMode = input.executionMode
  if (typeof input.numThreads === 'number') body.numThreads = input.numThreads
  if (typeof input.receiverBlockSize === 'number') body.receiverBlockSize = input.receiverBlockSize
  if (typeof input.sourceBlockSize === 'number') body.sourceBlockSize = input.sourceBlockSize
  if (typeof input.simdLanes === 'number') body.simdLanes = input.simdLanes
  return body
}

function wrapGmshMeshAsTetraRequest(
  built: Awaited<ReturnType<typeof api.buildGmshTetraMesh>>,
  input: {
    numReceiversX: number
    numReceiversY: number
    surfaceBounds: SurfaceBounds
    executionMode?: TetraMeshRequest['executionMode']
    numThreads?: number
    receiverBlockSize?: number
    sourceBlockSize?: number
    simdLanes?: number
  },
): TetraMeshRequest {
  const meshRequest: TetraMeshRequest = {
    mesh: built.mesh,
    numReceiversX: input.numReceiversX,
    numReceiversY: input.numReceiversY,
    surfaceXMin: input.surfaceBounds.xMin,
    surfaceXMax: input.surfaceBounds.xMax,
    surfaceYMin: input.surfaceBounds.yMin,
    surfaceYMax: input.surfaceBounds.yMax,
    surfaceZ: 0,
    executionMode: input.executionMode,
  }
  if (typeof input.numThreads === 'number') {
    meshRequest.numThreads = input.numThreads
  }
  if (typeof input.receiverBlockSize === 'number') {
    meshRequest.receiverBlockSize = input.receiverBlockSize
  }
  if (typeof input.sourceBlockSize === 'number') {
    meshRequest.sourceBlockSize = input.sourceBlockSize
  }
  if (typeof input.simdLanes === 'number') meshRequest.simdLanes = input.simdLanes
  return meshRequest
}

/** Calls POST /api/build_gmsh_tetra_mesh (tests / tooling only — forward runs use server-side build). */
export async function buildForwardGmshTetraMeshRequest(input: {
  model: ForwardModelParams
  numReceiversX: number
  numReceiversY: number
  surfaceBounds: SurfaceBounds
  targetElementSize?: number
  surfaceRefinement?: number
  localRefinementNearEdges?: number
  numSourcesX?: number
  numSourcesY?: number
  numSourcesZ?: number
  executionMode?: TetraMeshRequest['executionMode']
  numThreads?: number
  receiverBlockSize?: number
  sourceBlockSize?: number
  simdLanes?: number
}): Promise<ForwardMeshBuildResult | null> {
  if (!forwardUsesGmshTetraMeshRequest(input.model.modelType)) return null
  if (!isGmshMeshBuildSupported(input.model.modelType)) {
    throw new Error(GMSH_MESH_UNSUPPORTED_SHAPE_MESSAGE)
  }
  const sizing = {
    targetElementSize: input.targetElementSize ?? getGmshMeshSizing(input.model).targetElementSize,
    surfaceRefinement: input.surfaceRefinement ?? getGmshMeshSizing(input.model).surfaceRefinement,
    localRefinementNearEdges:
      input.localRefinementNearEdges ?? getGmshMeshSizing(input.model).localRefinementNearEdges,
  }
  const built = await api.buildGmshTetraMesh(gmshBuildRequestBody(input.model, sizing, input))
  const elements = built.mesh.elements ?? built.mesh.tets ?? []
  if (elements.length === 0) {
    throw new Error('Gmsh mesh builder returned no tetrahedral elements.')
  }
  return {
    meshRequest: wrapGmshMeshAsTetraRequest(built, input),
    gmshBuildStats: {
      numNodes: built.numNodes,
      numElements: built.numElements,
      buildMs: built.buildMs ?? 0,
    },
  }
}

/** Server Gmsh tet mesh for catalog calculate (no browser grid tet). */
export async function buildForwardMeshRequestAsync(input: {
  model: ForwardModelParams
  numSourcesX: number
  numSourcesY: number
  numSourcesZ: number
  numReceiversX: number
  numReceiversY: number
  surfaceBounds: SurfaceBounds
  executionMode?: TetraMeshRequest['executionMode']
  numThreads?: number
  receiverBlockSize?: number
  sourceBlockSize?: number
  simdLanes?: number
}): Promise<ForwardMeshBuildResult | null> {
  if (!forwardUsesTetraMeshRequest(input.model.modelType)) {
    return null
  }
  if (!isGmshMeshBuildSupported(input.model.modelType)) {
    throw new Error(GMSH_MESH_UNSUPPORTED_SHAPE_MESSAGE)
  }
  return { gmshServerComputeBody: buildForwardGmshServerComputeBody(input) }
}

/** Spread mesh payload onto legacy shape-field API bodies (AMFM, Barnes–Hut, analysis). */
export function attachMeshToGravityBody<T extends Record<string, unknown>>(
  body: T,
  meshRequest: TetraMeshRequest,
): T & TetraMeshRequest {
  return { ...body, ...meshRequest }
}

export function attachGmshServerComputeToGravityBody<T extends Record<string, unknown>>(
  body: T,
  gmshServerComputeBody: Record<string, unknown>,
): T & Record<string, unknown> {
  return { ...body, ...gmshServerComputeBody }
}
