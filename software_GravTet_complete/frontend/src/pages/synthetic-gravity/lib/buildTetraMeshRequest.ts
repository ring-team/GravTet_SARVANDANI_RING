import type { TetraMeshRequest } from '../../../services/api'
import type { ForwardModelParams } from '../../forward-gravity/lib/forwardModelParams'
import { getModelCenterForForwardGravity } from '../../forward-gravity/lib/forwardGravityModelCenter'
import { getCubeCuboidSourcePositions, getSphereVolumeSourcePositions } from '../mesh/sourceMarkerPositions'
import type { SurfaceBounds } from '../../forward-gravity/shared/GravityMapView'
import { resolveValleyMountainParams, valleyMountainDisplayReliefX } from '../mesh/valleyMountainTopography'

type MeshBuildInput = {
  model: ForwardModelParams
  numSourcesX: number
  numSourcesY: number
  numSourcesZ: number
  numReceiversX: number
  numReceiversY: number
  surfaceBounds: SurfaceBounds
  executionMode?: 'reference' | 'tiled' | 'simd_tiled' | 'simd_tiled_threading'
}

function getBaseModel(modelType: string | null | undefined): string {
  return (modelType || '').split(' - ')[0] || ''
}

function getMeshFamily(modelType: string | null | undefined): 'structured' | 'unstructured' {
  const t = (modelType || '').toLowerCase()
  if (t.includes('gmsh tetrahedral')) return 'structured'
  return t.includes('unstructured') ? 'unstructured' : 'structured'
}

function getModelSpans(model: ForwardModelParams): { sx: number; sy: number; sz: number } {
  const base = getBaseModel(model.modelType)
  switch (base) {
    case 'Cube':
      return {
        sx: Math.max(1e-6, model.cubeX || 100),
        sy: Math.max(1e-6, model.cubeY || 100),
        sz: Math.max(1e-6, model.cubeZ || 100),
      }
    case 'Sphere': {
      const r = Math.max(1e-6, model.sphereRadius || 100)
      return { sx: 2 * r, sy: 2 * r, sz: 2 * r }
    }
    case 'Valley-Mountain Model':
      return {
        sx: Math.max(1e-6, model.valleyMountainX || 400),
        sy: Math.max(1e-6, model.valleyMountainY || 140),
        sz: Math.max(1e-6, model.valleyMountainZ || 90),
      }
    default:
      return { sx: 100, sy: 100, sz: 100 }
  }
}

function generateSourceCenters(model: ForwardModelParams, nx: number, ny: number, nz: number): Float32Array {
  const base = getBaseModel(model.modelType)
  switch (base) {
    case 'Cube':
      return getCubeCuboidSourcePositions(model.cubeX || 100, model.cubeY || 100, model.cubeZ || 100, nx, ny, nz)
    case 'Sphere':
      return getSphereVolumeSourcePositions(model.sphereRadius || 100, { numSourcesX: nx, numSourcesY: ny, numSourcesZ: nz })
    case 'Valley-Mountain Model':
      return getCubeCuboidSourcePositions(
        model.valleyMountainX ?? model.cubeX ?? 400,
        model.valleyMountainY ?? model.cubeY ?? 140,
        model.valleyMountainZ ?? model.cubeZ ?? 90,
        nx,
        ny,
        nz,
      )
    default:
      return getCubeCuboidSourcePositions(model.cubeX || 100, model.cubeY || 100, model.cubeZ || 100, nx, ny, nz)
  }
}

const PI = Math.PI

type TetCorners = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
  [number, number, number],
]

function tetraVolume(corners: TetCorners): number {
  const [x1, y1, z1] = corners[0]
  const [x2, y2, z2] = corners[1]
  const [x3, y3, z3] = corners[2]
  const [x4, y4, z4] = corners[3]
  const v21x = x2 - x1
  const v21y = y2 - y1
  const v21z = z2 - z1
  const v31x = x3 - x1
  const v31y = y3 - y1
  const v31z = z3 - z1
  const v41x = x4 - x1
  const v41y = y4 - y1
  const v41z = z4 - z1
  const crossX = v21y * v31z - v21z * v31y
  const crossY = v21z * v31x - v21x * v31z
  const crossZ = v21x * v31y - v21y * v31x
  return Math.abs(crossX * v41x + crossY * v41y + crossZ * v41z) / 6.0
}

const SYMMETRIC_DUAL_SPLIT_VOLUME_FACTOR = 2.0

function scaleMeshDensitiesForTargetVolume(
  nodes: Array<[number, number, number]>,
  elements: Array<[number, number, number, number, number]>,
  targetVolume: number,
  dualSplit: boolean,
) {
  if (elements.length === 0 || targetVolume <= 0) return
  let currentVolume = 0
  for (const [i0, i1, i2, i3] of elements) {
    currentVolume += tetraVolume([nodes[i0], nodes[i1], nodes[i2], nodes[i3]])
  }
  if (currentVolume <= 1e-30) return
  const volumeFactor = dualSplit ? SYMMETRIC_DUAL_SPLIT_VOLUME_FACTOR : 1.0
  const scale = (targetVolume / currentVolume) * volumeFactor
  for (let i = 0; i < elements.length; i++) {
    elements[i][4] *= scale
  }
}

function pushVoxelTetsSymmetricDual(
  elements: Array<[number, number, number, number, number]>,
  n0: number,
  n1: number,
  n2: number,
  n3: number,
  n4: number,
  n5: number,
  n6: number,
  n7: number,
  rho: number,
) {
  const half = rho * 0.5
  pushVoxelTets(elements, 'unstructured', n0, n1, n2, n3, n4, n5, n6, n7, half, 0)
  pushVoxelTets(elements, 'unstructured', n0, n1, n2, n3, n4, n5, n6, n7, half, 1)
}

function pushVoxelTets(
  elements: Array<[number, number, number, number, number]>,
  family: 'structured' | 'unstructured',
  n0: number,
  n1: number,
  n2: number,
  n3: number,
  n4: number,
  n5: number,
  n6: number,
  n7: number,
  rho: number,
  parity: number,
) {
  if (family === 'structured') {
    elements.push([n0, n1, n3, n7, rho])
    elements.push([n0, n3, n2, n7, rho])
    elements.push([n0, n2, n6, n7, rho])
    elements.push([n0, n6, n4, n7, rho])
    elements.push([n0, n4, n5, n7, rho])
    elements.push([n0, n5, n1, n7, rho])
    return
  }
  if (parity === 0) {
    elements.push([n0, n1, n2, n6, rho])
    elements.push([n0, n2, n3, n6, rho])
    elements.push([n0, n3, n7, n6, rho])
    elements.push([n0, n7, n4, n6, rho])
    elements.push([n0, n4, n5, n6, rho])
    elements.push([n0, n5, n1, n6, rho])
  } else {
    elements.push([n1, n0, n4, n7, rho])
    elements.push([n1, n4, n5, n7, rho])
    elements.push([n1, n5, n6, n7, rho])
    elements.push([n1, n6, n2, n7, rho])
    elements.push([n1, n2, n3, n7, rho])
    elements.push([n1, n3, n0, n7, rho])
  }
}

function buildClippedGridTetraMesh(
  centerX: number,
  centerY: number,
  centerZ: number,
  sx: number,
  sy: number,
  sz: number,
  nx: number,
  ny: number,
  nz: number,
  density: number,
  inside: (x: number, y: number, z: number) => boolean,
  family: 'structured' | 'unstructured',
  targetVolume?: number,
) {
  const ix = Math.max(1, Math.floor(nx))
  const iy = Math.max(1, Math.floor(ny))
  const iz = Math.max(1, Math.floor(nz))
  const dx = sx / ix
  const dy = sy / iy
  const dz = sz / iz
  const xMin = centerX - sx * 0.5
  const yMin = centerY - sy * 0.5
  const zMin = centerZ - sz * 0.5

  const nodes: Array<[number, number, number]> = []
  const elements: Array<[number, number, number, number, number]> = []
  const idx = (i: number, j: number, k: number) => i * (iy + 1) * (iz + 1) + j * (iz + 1) + k

  for (let i = 0; i <= ix; i++) {
    for (let j = 0; j <= iy; j++) {
      for (let k = 0; k <= iz; k++) {
        nodes[idx(i, j, k)] = [xMin + i * dx, yMin + j * dy, zMin + k * dz]
      }
    }
  }

  const useDualSplit = true
  for (let i = 0; i < ix; i++) {
    for (let j = 0; j < iy; j++) {
      for (let k = 0; k < iz; k++) {
        const xc = xMin + (i + 0.5) * dx
        const yc = yMin + (j + 0.5) * dy
        const zc = zMin + (k + 0.5) * dz
        if (!inside(xc, yc, zc)) continue
        const n0 = idx(i, j, k)
        const n1 = idx(i + 1, j, k)
        const n2 = idx(i, j + 1, k)
        const n3 = idx(i + 1, j + 1, k)
        const n4 = idx(i, j, k + 1)
        const n5 = idx(i + 1, j, k + 1)
        const n6 = idx(i, j + 1, k + 1)
        const n7 = idx(i + 1, j + 1, k + 1)
        pushVoxelTetsSymmetricDual(elements, n0, n1, n2, n3, n4, n5, n6, n7, density)
      }
    }
  }

  if (typeof targetVolume === 'number') {
    scaleMeshDensitiesForTargetVolume(nodes, elements, targetVolume, useDualSplit)
  }
  return { nodes, elements }
}

function buildBoxUnstructuredTetraMesh(model: ForwardModelParams, nx: number, ny: number, nz: number) {
  const { centerX, centerY, centerZ } = getModelCenterForForwardGravity(model)
  const { sx, sy, sz } = getModelSpans(model)
  const family = getMeshFamily(model.modelType)
  return buildClippedGridTetraMesh(
    centerX,
    centerY,
    centerZ,
    sx,
    sy,
    sz,
    nx,
    ny,
    nz,
    model.density || 2500,
    () => true,
    family,
  )
}

function buildSphereTetraMesh(
  model: ForwardModelParams,
  nx: number,
  ny: number,
  nz: number,
  family: 'structured' | 'unstructured',
) {
  const { centerX, centerY, centerZ } = getModelCenterForForwardGravity(model)
  const r = Math.max(1e-6, model.sphereRadius || 100)
  const { sx, sy, sz } = getModelSpans(model)
  const r2 = r * r
  return buildClippedGridTetraMesh(
    centerX,
    centerY,
    centerZ,
    sx,
    sy,
    sz,
    nx,
    ny,
    nz,
    model.density || 2500,
    (x, y, z) => {
      const dx = x - centerX
      const dy = y - centerY
      const dz = z - centerZ
      return dx * dx + dy * dy + dz * dz <= r2
    },
    family,
    (4.0 / 3.0) * PI * r * r * r,
  )
}

function buildSphereUnstructuredTetraMesh(model: ForwardModelParams, nx: number, ny: number, nz: number) {
  return buildSphereTetraMesh(model, nx, ny, nz, 'unstructured')
}

function buildValleyMountainHalfSpaceMesh(
  model: ForwardModelParams,
  nx: number,
  ny: number,
  nz: number,
  family: 'structured' | 'unstructured',
) {
  const vm = resolveValleyMountainParams(model)
  const { centerX, centerY, centerZ } = getModelCenterForForwardGravity(model)
  const hsX = vm.halfSpaceX
  const hsY = vm.halfSpaceY
  const hsZ = vm.halfSpaceZ
  const dx = hsX / Math.max(1, nx)
  const dy = hsY / Math.max(1, ny)
  const dz = hsZ / Math.max(1, nz)
  const xMin = -hsX * 0.5
  const yMin = -hsY * 0.5
  const zMin = centerZ - hsZ * 0.5
  const zRef = centerZ + vm.blockZ * 0.5
  const ax = vm.blockX * 0.5
  const ay = vm.blockY * 0.5

  const nodes: Array<[number, number, number]> = []
  const elements: Array<[number, number, number, number, number]> = []
  const idx = (i: number, j: number, k: number) => i * (ny + 1) * (nz + 1) + j * (nz + 1) + k

  for (let i = 0; i <= nx; i++) {
    const xb = xMin + i * dx
    for (let j = 0; j <= ny; j++) {
      const yb = yMin + j * dy
      for (let k = 0; k <= nz; k++) {
        nodes[idx(i, j, k)] = [centerX + xb, centerY + yb, zMin + k * dz]
      }
    }
  }

  for (let i = 0; i < nx; i++) {
    const xc = xMin + (i + 0.5) * dx
    const xWorld = centerX + xc
    for (let j = 0; j < ny; j++) {
      const yc = yMin + (j + 0.5) * dy
      const yWorld = centerY + yc
      for (let k = 0; k < nz; k++) {
        const zc = zMin + (k + 0.5) * dz
        const inAnomaly = Math.abs(xWorld - centerX) <= ax && Math.abs(yWorld - centerY) <= ay
        const relief = inAnomaly
          ? valleyMountainDisplayReliefX(xc, vm.blockX, vm.mountainHeight, vm.valleyDepth)
          : 0
        const zTop = zRef + relief
        if (zc > zTop + 1e-6) continue

        const rho = inAnomaly ? vm.mountainValleyDensity : vm.halfSpaceDensity
        const n0 = idx(i, j, k)
        const n1 = idx(i + 1, j, k)
        const n2 = idx(i, j + 1, k)
        const n3 = idx(i + 1, j + 1, k)
        const n4 = idx(i, j, k + 1)
        const n5 = idx(i + 1, j, k + 1)
        const n6 = idx(i, j + 1, k + 1)
        const n7 = idx(i + 1, j + 1, k + 1)
        if (family === 'unstructured') {
          pushVoxelTetsSymmetricDual(elements, n0, n1, n2, n3, n4, n5, n6, n7, rho)
        } else {
          pushVoxelTets(elements, family, n0, n1, n2, n3, n4, n5, n6, n7, rho, 0)
        }
      }
    }
  }
  return { nodes, elements }
}

function buildStructuredTetraMeshForModel(model: ForwardModelParams, nx: number, ny: number, nz: number) {
  const base = getBaseModel(model.modelType)
  switch (base) {
    case 'Cube':
      return buildBoxUnstructuredTetraMesh(model, nx, ny, nz)
    case 'Sphere':
      return buildSphereTetraMesh(model, nx, ny, nz, 'structured')
    case 'Valley-Mountain Model':
      return buildValleyMountainHalfSpaceMesh(model, nx, ny, nz, 'structured')
    default:
      return null
  }
}

function buildUnstructuredTetraMeshForModel(model: ForwardModelParams, nx: number, ny: number, nz: number) {
  const base = getBaseModel(model.modelType)
  switch (base) {
    case 'Cube':
      return buildBoxUnstructuredTetraMesh(model, nx, ny, nz)
    case 'Sphere':
      return buildSphereUnstructuredTetraMesh(model, nx, ny, nz)
    case 'Valley-Mountain Model':
      return buildValleyMountainHalfSpaceMesh(model, nx, ny, nz, 'unstructured')
    default:
      return null
  }
}

function densityForIndex(_model: ForwardModelParams, _idx: number, _total: number): number {
  const scaleForSingleTet = 6.0
  return (_model.density || 2500) * scaleForSingleTet
}

function buildVoxelizedTetraMesh(model: ForwardModelParams, nx: number, ny: number, nz: number) {
  const family = getMeshFamily(model.modelType)
  if (family === 'unstructured') {
    const u = buildUnstructuredTetraMeshForModel(model, nx, ny, nz)
    if (u && u.elements.length > 0) return u
  }
  const s = buildStructuredTetraMeshForModel(model, nx, ny, nz)
  if (s && s.elements.length > 0) return s
  return null
}

export function buildTetraMeshRequest(input: MeshBuildInput): TetraMeshRequest {
  const { model, numSourcesX, numSourcesY, numSourcesZ, numReceiversX, numReceiversY, surfaceBounds, executionMode } = input
  const voxelized = buildVoxelizedTetraMesh(model, numSourcesX, numSourcesY, numSourcesZ)
  if (voxelized && voxelized.elements.length > 0) {
    return {
      mesh: { nodes: voxelized.nodes, elements: voxelized.elements },
      numReceiversX,
      numReceiversY,
      surfaceXMin: surfaceBounds.xMin,
      surfaceXMax: surfaceBounds.xMax,
      surfaceYMin: surfaceBounds.yMin,
      surfaceYMax: surfaceBounds.yMax,
      surfaceZ: 0,
      executionMode,
    }
  }

  const centers = generateSourceCenters(model, numSourcesX, numSourcesY, numSourcesZ)
  const { centerX, centerY, centerZ } = getModelCenterForForwardGravity(model)
  const spans = getModelSpans(model)
  const dx = Math.max(1e-6, spans.sx / Math.max(1, numSourcesX))
  const dy = Math.max(1e-6, spans.sy / Math.max(1, numSourcesY))
  const dz = Math.max(1e-6, spans.sz / Math.max(1, numSourcesZ))

  const nodes: Array<[number, number, number]> = []
  const elements: Array<[number, number, number, number, number]> = []
  const nCenters = Math.floor(centers.length / 3)
  for (let i = 0; i < nCenters; i++) {
    const tx = centers[i * 3 + 0]
    const ty = centers[i * 3 + 1]
    const tz = centers[i * 3 + 2]
    const bx = tx + centerX
    const by = tz + centerY
    const bz = ty + centerZ
    const i0 = nodes.length
    nodes.push([bx, by, bz])
    nodes.push([bx + dx, by, bz])
    nodes.push([bx, by + dy, bz])
    nodes.push([bx, by, bz + dz])
    elements.push([i0, i0 + 1, i0 + 2, i0 + 3, densityForIndex(model, i, nCenters)])
  }

  return {
    mesh: { nodes, elements },
    numReceiversX,
    numReceiversY,
    surfaceXMin: surfaceBounds.xMin,
    surfaceXMax: surfaceBounds.xMax,
    surfaceYMin: surfaceBounds.yMin,
    surfaceYMax: surfaceBounds.yMax,
    surfaceZ: 0,
    executionMode,
  }
}
