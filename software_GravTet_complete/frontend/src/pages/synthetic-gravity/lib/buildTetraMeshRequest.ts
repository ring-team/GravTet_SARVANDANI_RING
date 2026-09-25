import type { TetraMeshRequest } from '../../../services/api'
import type { ForwardModelParams } from '../../forward-gravity/lib/forwardModelParams'
import { getModelCenterForForwardGravity } from '../../forward-gravity/lib/forwardGravityModelCenter'
import {
  getCubeCuboidSourcePositions,
  getEllipsoidVolumeSourcePositions,
  getFourCubesSourcePositions,
  getFaultedBlockVolumeSourcePositions,
  getHorizontalCylinderVolumeSourcePositions,
  getSphereVolumeSourcePositions,
  getVerticalCylinderVolumeSourcePositions,
} from '../../../pages/synthetic-gravity/mesh/sourceMarkerPositions'
import type { SurfaceBounds } from '../../forward-gravity/shared/GravityMapView'
import { resolveValleyMountainParams, valleyMountainDisplayReliefX } from '../../../pages/synthetic-gravity/mesh/valleyMountainTopography'

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
    case 'Rectangular Prism (Cuboid)':
      return {
        sx: Math.max(1e-6, model.cubeX || 100),
        sy: Math.max(1e-6, model.cubeY || 100),
        sz: Math.max(1e-6, model.cubeZ || 100),
      }
    case 'Sphere': {
      const r = Math.max(1e-6, model.sphereRadius || 100)
      return { sx: 2 * r, sy: 2 * r, sz: 2 * r }
    }
    case 'Ellipsoid':
      return {
        sx: Math.max(1e-6, 2 * (model.ellipsoidA || 200)),
        sy: Math.max(1e-6, 2 * (model.ellipsoidB || 100)),
        sz: Math.max(1e-6, 2 * (model.ellipsoidC || 150)),
      }
    case 'Vertical Cylinder':
      return {
        sx: Math.max(1e-6, 2 * (model.verticalCylinderRadius || 50)),
        sy: Math.max(1e-6, 2 * (model.verticalCylinderRadius || 50)),
        sz: Math.max(1e-6, model.verticalCylinderHeight || 100),
      }
    case 'Horizontal Cylinder':
      return {
        sx: Math.max(1e-6, 2 * (model.horizontalCylinderRadius || 50)),
        sy: Math.max(1e-6, model.horizontalCylinderLength || 100),
        sz: Math.max(1e-6, 2 * (model.horizontalCylinderRadius || 50)),
      }
    case 'Faulted Block Model':
      return {
        sx: Math.max(1e-6, model.faultedBlockX || 100),
        sy: Math.max(1e-6, model.faultedBlockY || 100),
        sz: Math.max(1e-6, model.faultedBlockZ || 100),
      }
    case 'Valley-Mountain Model':
      return {
        sx: Math.max(1e-6, model.valleyMountainX || 400),
        sy: Math.max(1e-6, model.valleyMountainY || 140),
        sz: Math.max(1e-6, model.valleyMountainZ || 90),
      }
    case '4 Cubes':
      return {
        sx: Math.max(1e-6, model.spacingX || 80),
        sy: Math.max(1e-6, model.spacingY || 80),
        sz: Math.max(1e-6, Math.max(model.cube1Z || 20, model.cube2Z || 20, model.cube3Z || 20, model.cube4Z || 20)),
      }
    default:
      return { sx: 100, sy: 100, sz: 100 }
  }
}

function generateSourceCenters(model: ForwardModelParams, nx: number, ny: number, nz: number): Float32Array {
  const base = getBaseModel(model.modelType)
  switch (base) {
    case 'Cube':
    case 'Rectangular Prism (Cuboid)':
      return getCubeCuboidSourcePositions(model.cubeX || 100, model.cubeY || 100, model.cubeZ || 100, nx, ny, nz)
    case 'Sphere':
      return getSphereVolumeSourcePositions(model.sphereRadius || 100, { numSourcesX: nx, numSourcesY: ny, numSourcesZ: nz })
    case 'Ellipsoid':
      return getEllipsoidVolumeSourcePositions(model.ellipsoidA || 200, model.ellipsoidB || 100, model.ellipsoidC || 150, {
        numSourcesX: nx,
        numSourcesY: ny,
        numSourcesZ: nz,
      })
    case 'Vertical Cylinder':
      return getVerticalCylinderVolumeSourcePositions(model.verticalCylinderRadius || 50, model.verticalCylinderHeight || 100, nx, ny, nz)
    case 'Horizontal Cylinder':
      return getHorizontalCylinderVolumeSourcePositions(model.horizontalCylinderRadius || 50, model.horizontalCylinderLength || 100, nx, ny, nz)
    case '4 Cubes':
      return getFourCubesSourcePositions(
        model.cube1X || 20,
        model.cube1Y || 20,
        model.cube1Z || 20,
        model.cube1H || 2,
        model.cube2X || 20,
        model.cube2Y || 20,
        model.cube2Z || 20,
        model.cube2H || 2,
        model.cube3X || 20,
        model.cube3Y || 20,
        model.cube3Z || 20,
        model.cube3H || 2,
        model.cube4X || 20,
        model.cube4Y || 20,
        model.cube4Z || 20,
        model.cube4H || 2,
        model.spacingX || 80,
        model.spacingY || 80,
        model.cube1OffsetX || 0,
        model.cube1OffsetY || 0,
        model.cube2OffsetX || 0,
        model.cube2OffsetY || 0,
        model.cube3OffsetX || 0,
        model.cube3OffsetY || 0,
        model.cube4OffsetX || 0,
        model.cube4OffsetY || 0,
        nx,
        ny,
        nz
      )
    case 'Faulted Block Model':
      return getFaultedBlockVolumeSourcePositions(
        model.faultedBlockX || 100,
        model.faultedBlockY || 100,
        model.faultedBlockZ || 100,
        model.faultedBlockFaultOffset ?? 20,
        nx,
        ny,
        nz,
      )
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

function densityForIndex(model: ForwardModelParams, idx: number, total: number): number {
  const scaleForSingleTet = 6.0
  if (getBaseModel(model.modelType) !== '4 Cubes') return model.density || 2500
  const perCube = Math.max(1, Math.floor(total / 4))
  const block = Math.min(3, Math.floor(idx / perCube))
  if (block === 0) return (model.cube1Density ?? model.density ?? 2500) * scaleForSingleTet
  if (block === 1) return (model.cube2Density ?? model.density ?? 2500) * scaleForSingleTet
  if (block === 2) return (model.cube3Density ?? model.density ?? 2500) * scaleForSingleTet
  return (model.cube4Density ?? model.density ?? 2500) * scaleForSingleTet
}

function isInsideShape(
  base: string,
  model: ForwardModelParams,
  x: number,
  y: number,
  z: number,
  centerX: number,
  centerY: number,
  centerZ: number,
): boolean {
  if (base === 'Sphere') {
    const r = Math.max(1e-9, model.sphereRadius || 100)
    const dx = x - centerX
    const dy = y - centerY
    const dz = z - centerZ
    return dx * dx + dy * dy + dz * dz <= r * r
  }
  if (base === 'Ellipsoid') {
    const a = Math.max(1e-9, model.ellipsoidA || 200)
    const b = Math.max(1e-9, model.ellipsoidB || 100)
    const c = Math.max(1e-9, model.ellipsoidC || 150)
    return ((x - centerX) / a) ** 2 + ((y - centerY) / b) ** 2 + ((z - centerZ) / c) ** 2 <= 1.0
  }
  if (base === 'Vertical Cylinder') {
    const r = Math.max(1e-9, model.verticalCylinderRadius || 50)
    const h = Math.max(1e-9, model.verticalCylinderHeight || 100)
    const rx = x - centerX
    const ry = y - centerY
    const rz = z - centerZ
    return rx * rx + ry * ry <= r * r && Math.abs(rz) <= h * 0.5
  }
  if (base === 'Horizontal Cylinder') {
    const r = Math.max(1e-9, model.horizontalCylinderRadius || 50)
    const halfL = Math.max(1e-9, model.horizontalCylinderLength || 100) * 0.5
    const rx = x - centerX
    const ry = y - centerY
    const rz = z - centerZ
    return ry * ry + rz * rz <= r * r && Math.abs(rx) <= halfL
  }
  return true
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

/** Symmetric dual split (12 tets/cell at ρ/2) sums to 2× the physical hexa volume. */
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

/**
 * Box unstructured meshes: full bounding box on a conforming hexa-grid with symmetric dual split.
 */
function buildBoxUnstructuredTetraMesh(
  model: ForwardModelParams,
  nx: number,
  ny: number,
  nz: number,
) {
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

/** Conforming hexa-grid tet fill; optional clip and mass-preserving volume renormalization. */
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

function buildClippedGridUnstructuredTetraMesh(
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
  targetVolume?: number,
) {
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
    density,
    inside,
    'unstructured',
    targetVolume,
  )
}

function mergeTetraMeshAppend(
  nodes: Array<[number, number, number]>,
  elements: Array<[number, number, number, number, number]>,
  part: { nodes: Array<[number, number, number]>; elements: Array<[number, number, number, number, number]> },
) {
  const offset = nodes.length
  for (const n of part.nodes) nodes.push(n)
  for (const [i0, i1, i2, i3, rho] of part.elements) {
    elements.push([i0 + offset, i1 + offset, i2 + offset, i3 + offset, rho])
  }
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

function buildEllipsoidTetraMesh(
  model: ForwardModelParams,
  nx: number,
  ny: number,
  nz: number,
  family: 'structured' | 'unstructured',
) {
  const { centerX, centerY, centerZ } = getModelCenterForForwardGravity(model)
  const a = Math.max(1e-6, model.ellipsoidA || 200)
  const b = Math.max(1e-6, model.ellipsoidB || 100)
  const c = Math.max(1e-6, model.ellipsoidC || 150)
  const { sx, sy, sz } = getModelSpans(model)
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
      const nxv = (x - centerX) / a
      const nyv = (y - centerY) / b
      const nzv = (z - centerZ) / c
      return nxv * nxv + nyv * nyv + nzv * nzv <= 1.0
    },
    family,
    (4.0 / 3.0) * PI * a * b * c,
  )
}

function buildSphereUnstructuredTetraMesh(model: ForwardModelParams, nx: number, ny: number, nz: number) {
  return buildSphereTetraMesh(model, nx, ny, nz, 'unstructured')
}

function buildEllipsoidUnstructuredTetraMesh(model: ForwardModelParams, nx: number, ny: number, nz: number) {
  return buildEllipsoidTetraMesh(model, nx, ny, nz, 'unstructured')
}

function buildVerticalCylinderTetraMesh(
  model: ForwardModelParams,
  nx: number,
  ny: number,
  nz: number,
  family: 'structured' | 'unstructured',
) {
  const { centerX, centerY, centerZ } = getModelCenterForForwardGravity(model)
  const r = Math.max(1e-6, model.verticalCylinderRadius || 50)
  const halfH = Math.max(1e-6, model.verticalCylinderHeight || 100) * 0.5
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
      const rx = x - centerX
      const ry = y - centerY
      const rz = z - centerZ
      return rx * rx + ry * ry <= r2 && Math.abs(rz) <= halfH
    },
    family,
    PI * r * r * (2.0 * halfH),
  )
}

function buildHorizontalCylinderTetraMesh(
  model: ForwardModelParams,
  nx: number,
  ny: number,
  nz: number,
  family: 'structured' | 'unstructured',
) {
  const { centerX, centerY, centerZ } = getModelCenterForForwardGravity(model)
  const r = Math.max(1e-6, model.horizontalCylinderRadius || 50)
  const halfL = Math.max(1e-6, model.horizontalCylinderLength || 100) * 0.5
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
      const rx = x - centerX
      const ry = y - centerY
      const rz = z - centerZ
      return ry * ry + rz * rz <= r2 && Math.abs(rx) <= halfL
    },
    family,
    PI * r * r * (2.0 * halfL),
  )
}

function buildVerticalCylinderUnstructuredTetraMesh(model: ForwardModelParams, nx: number, ny: number, nz: number) {
  return buildVerticalCylinderTetraMesh(model, nx, ny, nz, 'unstructured')
}

function buildHorizontalCylinderUnstructuredTetraMesh(model: ForwardModelParams, nx: number, ny: number, nz: number) {
  return buildHorizontalCylinderTetraMesh(model, nx, ny, nz, 'unstructured')
}

function buildFourCubesTetraMesh(
  model: ForwardModelParams,
  nx: number,
  ny: number,
  nz: number,
  family: 'structured' | 'unstructured',
) {
  const { centerX, centerY, centerZ } = getModelCenterForForwardGravity(model)
  const positions = [
    [-(model.spacingX || 80) * 0.5 + (model.cube1OffsetX || 0), -(model.spacingY || 80) * 0.5 + (model.cube1OffsetY || 0)],
    [(model.spacingX || 80) * 0.5 + (model.cube2OffsetX || 0), -(model.spacingY || 80) * 0.5 + (model.cube2OffsetY || 0)],
    [-(model.spacingX || 80) * 0.5 + (model.cube3OffsetX || 0), (model.spacingY || 80) * 0.5 + (model.cube3OffsetY || 0)],
    [(model.spacingX || 80) * 0.5 + (model.cube4OffsetX || 0), (model.spacingY || 80) * 0.5 + (model.cube4OffsetY || 0)],
  ] as const
  const dims = [
    [model.cube1X || 20, model.cube1Y || 20, model.cube1Z || 20],
    [model.cube2X || 20, model.cube2Y || 20, model.cube2Z || 20],
    [model.cube3X || 20, model.cube3Y || 20, model.cube3Z || 20],
    [model.cube4X || 20, model.cube4Y || 20, model.cube4Z || 20],
  ] as const
  const hs = [model.cube1H || 2, model.cube2H || 2, model.cube3H || 2, model.cube4H || 2] as const
  const ds = [
    model.cube1Density ?? model.density ?? 2500,
    model.cube2Density ?? model.density ?? 2500,
    model.cube3Density ?? model.density ?? 2500,
    model.cube4Density ?? model.density ?? 2500,
  ] as const

  const nodes: Array<[number, number, number]> = []
  const elements: Array<[number, number, number, number, number]> = []

  for (let q = 0; q < 4; q++) {
    const sx = Math.max(1e-6, dims[q][0])
    const sy = Math.max(1e-6, dims[q][1])
    const sz = Math.max(1e-6, dims[q][2])
    const cx = centerX + positions[q][0]
    const cy = centerY + positions[q][1]
    const cz = centerZ - hs[q] - sz * 0.5
    const rho = Math.abs(ds[q]) > 0 ? ds[q] : model.density || 2500
    mergeTetraMeshAppend(
      nodes,
      elements,
      buildClippedGridTetraMesh(cx, cy, cz, sx, sy, sz, nx, ny, nz, rho, () => true, family),
    )
  }
  return { nodes, elements }
}

function buildFourCubesUnstructuredTetraMesh(model: ForwardModelParams, nx: number, ny: number, nz: number) {
  return buildFourCubesTetraMesh(model, nx, ny, nz, 'unstructured')
}

function buildFaultedBlockUnstructuredTetraMesh(model: ForwardModelParams, nx: number, ny: number, nz: number) {
  return buildFaultedBlockMesh(model, nx, ny, nz, 'unstructured')
}

function buildValleyMountainUnstructuredTetraMesh(model: ForwardModelParams, nx: number, ny: number, nz: number) {
  return buildValleyMountainHalfSpaceMesh(model, nx, ny, nz, 'unstructured')
}

function buildCurvedTetraMeshForModel(
  model: ForwardModelParams,
  nx: number,
  ny: number,
  nz: number,
  family: 'structured' | 'unstructured',
) {
  const base = getBaseModel(model.modelType)
  switch (base) {
    case 'Sphere':
      return buildSphereTetraMesh(model, nx, ny, nz, family)
    case 'Ellipsoid':
      return buildEllipsoidTetraMesh(model, nx, ny, nz, family)
    case 'Vertical Cylinder':
      return buildVerticalCylinderTetraMesh(model, nx, ny, nz, family)
    case 'Horizontal Cylinder':
      return buildHorizontalCylinderTetraMesh(model, nx, ny, nz, family)
    default:
      return null
  }
}

function buildStructuredTetraMeshForModel(model: ForwardModelParams, nx: number, ny: number, nz: number) {
  const base = getBaseModel(model.modelType)
  switch (base) {
    case 'Cube':
    case 'Rectangular Prism (Cuboid)':
      return buildBoxUnstructuredTetraMesh(model, nx, ny, nz)
    case '4 Cubes':
      return buildFourCubesTetraMesh(model, nx, ny, nz, 'structured')
    case 'Faulted Block Model':
      return buildFaultedBlockMesh(model, nx, ny, nz, 'structured')
    case 'Valley-Mountain Model':
      return buildValleyMountainHalfSpaceMesh(model, nx, ny, nz, 'structured')
    default:
      return buildCurvedTetraMeshForModel(model, nx, ny, nz, 'structured')
  }
}

function buildUnstructuredTetraMeshForModel(model: ForwardModelParams, nx: number, ny: number, nz: number) {
  const base = getBaseModel(model.modelType)
  switch (base) {
    case 'Cube':
    case 'Rectangular Prism (Cuboid)':
      return buildBoxUnstructuredTetraMesh(model, nx, ny, nz)
    case 'Sphere':
      return buildSphereUnstructuredTetraMesh(model, nx, ny, nz)
    case 'Ellipsoid':
      return buildEllipsoidUnstructuredTetraMesh(model, nx, ny, nz)
    case 'Vertical Cylinder':
      return buildVerticalCylinderUnstructuredTetraMesh(model, nx, ny, nz)
    case 'Horizontal Cylinder':
      return buildHorizontalCylinderUnstructuredTetraMesh(model, nx, ny, nz)
    case '4 Cubes':
      return buildFourCubesUnstructuredTetraMesh(model, nx, ny, nz)
    case 'Faulted Block Model':
      return buildFaultedBlockUnstructuredTetraMesh(model, nx, ny, nz)
    case 'Valley-Mountain Model':
      return buildValleyMountainUnstructuredTetraMesh(model, nx, ny, nz)
    default:
      return null
  }
}

/** Both parity diagonals at half density — per-voxel symmetric, uniform across the grid. */
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

/** Grey half-space + embedded topography block (two densities). */
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

/** Two half-blocks split at center_x; right block shifted in depth by fault_offset (matches C++). */
function buildFaultedBlockMesh(
  model: ForwardModelParams,
  nx: number,
  ny: number,
  nz: number,
  family: 'structured' | 'unstructured',
) {
  const sx = Math.max(1e-6, model.faultedBlockX || 100)
  const sy = Math.max(1e-6, model.faultedBlockY || 100)
  const sz = Math.max(1e-6, model.faultedBlockZ || 100)
  const fault = model.faultedBlockFaultOffset ?? 20
  const rho = model.faultedBlockDensity ?? model.density ?? 2500
  const { centerX, centerY, centerZ } = getModelCenterForForwardGravity(model)

  const dx = sx / Math.max(1, nx)
  const dy = sy / Math.max(1, ny)
  const dz = sz / Math.max(1, nz)

  const nodes: Array<[number, number, number]> = []
  const elements: Array<[number, number, number, number, number]> = []

  for (let i = 0; i < nx; i++) {
    const xCellCenter = centerX - sx / 2 + dx / 2 + i * dx
    const leftBlock = xCellCenter < centerX
    const x0 = centerX - sx / 2 + i * dx
    const x1 = x0 + dx
    for (let j = 0; j < ny; j++) {
      const y0 = centerY - sy / 2 + j * dy
      const y1 = y0 + dy
      for (let k = 0; k < nz; k++) {
        const z0 = centerZ - sz / 2 + k * dz
        const z1 = z0 + dz
        const zLo = leftBlock ? z0 : z0 - fault
        const zHi = leftBlock ? z1 : z1 - fault
        const dens = leftBlock ? rho : 0.7 * rho

        const base = nodes.length
        nodes.push([x0, y0, zLo])
        nodes.push([x1, y0, zLo])
        nodes.push([x0, y1, zLo])
        nodes.push([x1, y1, zLo])
        nodes.push([x0, y0, zHi])
        nodes.push([x1, y0, zHi])
        nodes.push([x0, y1, zHi])
        nodes.push([x1, y1, zHi])

        if (family === 'unstructured') {
          pushVoxelTetsSymmetricDual(
            elements,
            base,
            base + 1,
            base + 2,
            base + 3,
            base + 4,
            base + 5,
            base + 6,
            base + 7,
            dens,
          )
        } else {
          pushVoxelTets(
            elements,
            family,
            base,
            base + 1,
            base + 2,
            base + 3,
            base + 4,
            base + 5,
            base + 6,
            base + 7,
            dens,
            0,
          )
        }
      }
    }
  }
  return { nodes, elements }
}

function buildVoxelizedTetraMesh(model: ForwardModelParams, nx: number, ny: number, nz: number) {
  const base = getBaseModel(model.modelType)
  const family = getMeshFamily(model.modelType)

  if (family === 'unstructured') {
    const unstructured = buildUnstructuredTetraMeshForModel(model, nx, ny, nz)
    if (unstructured && unstructured.elements.length > 0) return unstructured
  } else {
    const structured = buildStructuredTetraMeshForModel(model, nx, ny, nz)
    if (structured && structured.elements.length > 0) return structured
  }

  if (base === '4 Cubes') return null

  if (base === 'Valley-Mountain Model') {
    return buildValleyMountainHalfSpaceMesh(model, nx, ny, nz, family)
  }
  if (base === 'Faulted Block Model') {
    return buildFaultedBlockMesh(model, nx, ny, nz, family)
  }
  const { centerX, centerY, centerZ } = getModelCenterForForwardGravity(model)
  const { sx, sy, sz } = getModelSpans(model)
  const dx = sx / Math.max(1, nx)
  const dy = sy / Math.max(1, ny)
  const dz = sz / Math.max(1, nz)
  const xMin = -sx * 0.5
  const yMin = -sy * 0.5
  const zMin = -sz * 0.5
  const nodes: Array<[number, number, number]> = []
  const elements: Array<[number, number, number, number, number]> = []
  const idx = (i: number, j: number, k: number) => i * (ny + 1) * (nz + 1) + j * (nz + 1) + k

  for (let i = 0; i <= nx; i++) {
    const xb = xMin + i * dx
    for (let j = 0; j <= ny; j++) {
      const yb = yMin + j * dy
      for (let k = 0; k <= nz; k++) {
        const zb = zMin + k * dz
        nodes[idx(i, j, k)] = [centerX + xb, centerY + yb, centerZ + zb]
      }
    }
  }
  for (let i = 0; i < nx; i++) {
    const xc = xMin + (i + 0.5) * dx
    for (let j = 0; j < ny; j++) {
      const yc = yMin + (j + 0.5) * dy
      for (let k = 0; k < nz; k++) {
        const zc = zMin + (k + 0.5) * dz
        if (!isInsideShape(base, model, centerX + xc, centerY + yc, centerZ + zc, centerX, centerY, centerZ)) continue
        const n0 = idx(i, j, k)
        const n1 = idx(i + 1, j, k)
        const n2 = idx(i, j + 1, k)
        const n3 = idx(i + 1, j + 1, k)
        const n4 = idx(i, j, k + 1)
        const n5 = idx(i + 1, j, k + 1)
        const n6 = idx(i, j + 1, k + 1)
        const n7 = idx(i + 1, j + 1, k + 1)
        const rho = model.density || 2500
        pushVoxelTetsSymmetricDual(elements, n0, n1, n2, n3, n4, n5, n6, n7, rho)
      }
    }
  }
  return { nodes, elements }
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
  // Use full cell-scale edge lengths. For a single right tetra, V = a*b*c/6, so
  // density is scaled by x6 (see densityForIndex) to preserve body mass.
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
    // Three.js local uses (x, depth, y). Backend mesh uses (x, y, z).
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
