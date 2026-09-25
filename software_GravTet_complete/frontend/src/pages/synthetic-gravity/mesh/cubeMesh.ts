/**
 * Cube wireframe: axis-aligned box (x, y, z). Same implementation underpins cuboid — see `cuboidMesh.ts`.
 */
import * as THREE from 'three'
import type { CubeWireStyle } from '../default_data/defaultSources'
import { addTriangle } from './meshUtils'
import { addHexTilingOnRectSurface } from './polySurfaceTiling'

function pushLine(points: number[], indices: number[], a: number[], b: number[]) {
  const i = points.length / 3
  points.push(...a, ...b)
  indices.push(i, i + 1)
}

/**
 * Two triangles per quad, cyclic corners p1→p2→p3→p4.
 * flip=false: same diagonal pattern as legacy structured tetra.
 * flip=true: alternate diagonal (checkerboard when flip toggles per cell).
 */
function addQuadTriWire(
  points: number[],
  indices: number[],
  p1: number[],
  p2: number[],
  p3: number[],
  p4: number[],
  flip: boolean
) {
  if (!flip) {
    addTriangle(points, indices, p1, p2, p4)
    addTriangle(points, indices, p2, p3, p4)
  } else {
    addTriangle(points, indices, p1, p2, p3)
    addTriangle(points, indices, p1, p3, p4)
  }
}

/** Quad split into 4 triangles from face center (distinct from pentagon/star poly mode). */
function addQuadCenterFanWire(
  points: number[],
  indices: number[],
  v0: number[],
  v1: number[],
  v2: number[],
  v3: number[]
) {
  const cx = (v0[0] + v1[0] + v2[0] + v3[0]) / 4
  const cy = (v0[1] + v1[1] + v2[1] + v3[1]) / 4
  const cz = (v0[2] + v1[2] + v2[2] + v3[2]) / 4
  const c = [cx, cy, cz]
  addTriangle(points, indices, c, v0, v1)
  addTriangle(points, indices, c, v1, v2)
  addTriangle(points, indices, c, v2, v3)
  addTriangle(points, indices, c, v3, v0)
}

function addPolygonWire(points: number[], indices: number[], vertices: number[][]) {
  for (let i = 0; i < vertices.length; i++) {
    pushLine(points, indices, vertices[i], vertices[(i + 1) % vertices.length])
  }
}

function addPentagonCellWire(
  points: number[],
  indices: number[],
  p1: number[],
  p2: number[],
  p3: number[],
  p4: number[],
  splitIndex: number
) {
  const corners = [p1, p2, p3, p4]
  const center = [
    (p1[0] + p2[0] + p3[0] + p4[0]) / 4,
    (p1[1] + p2[1] + p3[1] + p4[1]) / 4,
    (p1[2] + p2[2] + p3[2] + p4[2]) / 4,
  ]
  const a = corners[splitIndex]
  const b = corners[(splitIndex + 1) % 4]
  const mid = [
    (a[0] + b[0]) / 2 * 0.82 + center[0] * 0.18,
    (a[1] + b[1]) / 2 * 0.82 + center[1] * 0.18,
    (a[2] + b[2]) / 2 * 0.82 + center[2] * 0.18,
  ]
  const vertices = [...corners]
  vertices.splice(splitIndex + 1, 0, mid)
  addPolygonWire(points, indices, vertices)
}

function hash01(i: number, j: number, seed: number) {
  const n = Math.sin(i * 127.1 + j * 311.7 + seed * 17.13) * 43758.5453123
  return n - Math.floor(n)
}

/**
 * Irregular polygonal face: jitter a quad grid in-plane and draw cell boundaries.
 * This gives a clear "unstructured poly" visual different from structured poly spokes.
 */
function addJitteredFaceQuadGrid(
  points: number[],
  indices: number[],
  origin: [number, number, number],
  uVec: [number, number, number],
  vVec: [number, number, number],
  nu: number,
  nv: number,
  jitter: number,
  seed: number
) {
  const nodes: number[][] = []
  const du = 1 / nu
  const dv = 1 / nv
  const juAmp = du * jitter
  const jvAmp = dv * jitter

  for (let i = 0; i <= nu; i++) {
    for (let j = 0; j <= nv; j++) {
      let u = i * du
      let v = j * dv
      if (i > 0 && i < nu && j > 0 && j < nv) {
        const ru = hash01(i, j, seed) - 0.5
        const rv = hash01(i, j, seed + 97) - 0.5
        u += ru * juAmp
        v += rv * jvAmp
      }
      nodes.push([
        origin[0] + uVec[0] * u + vVec[0] * v,
        origin[1] + uVec[1] * u + vVec[1] * v,
        origin[2] + uVec[2] * u + vVec[2] * v,
      ])
    }
  }

  const idx = (i: number, j: number) => i * (nv + 1) + j
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const p00 = nodes[idx(i, j)]
      const p10 = nodes[idx(i + 1, j)]
      const p11 = nodes[idx(i + 1, j + 1)]
      const p01 = nodes[idx(i, j + 1)]
      addPentagonCellWire(points, indices, p00, p10, p11, p01, Math.floor(hash01(i, j, seed + 301) * 4))
    }
  }
}

/** Irregular triangular face mesh: jittered nodes + per-cell diagonal choice. */
function addJitteredFaceTriGrid(
  points: number[],
  indices: number[],
  origin: [number, number, number],
  uVec: [number, number, number],
  vVec: [number, number, number],
  nu: number,
  nv: number,
  jitter: number,
  seed: number
) {
  const nodes: number[][] = []
  const du = 1 / nu
  const dv = 1 / nv
  const juAmp = du * jitter
  const jvAmp = dv * jitter

  for (let i = 0; i <= nu; i++) {
    for (let j = 0; j <= nv; j++) {
      let u = i * du
      let v = j * dv
      if (i > 0 && i < nu && j > 0 && j < nv) {
        const ru = hash01(i, j, seed) - 0.5
        const rv = hash01(i, j, seed + 53) - 0.5
        u += ru * juAmp
        v += rv * jvAmp
      }
      nodes.push([
        origin[0] + uVec[0] * u + vVec[0] * v,
        origin[1] + uVec[1] * u + vVec[1] * v,
        origin[2] + uVec[2] * u + vVec[2] * v,
      ])
    }
  }

  const idx = (i: number, j: number) => i * (nv + 1) + j
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const p00 = nodes[idx(i, j)]
      const p10 = nodes[idx(i + 1, j)]
      const p11 = nodes[idx(i + 1, j + 1)]
      const p01 = nodes[idx(i, j + 1)]
      const flip = hash01(i, j, seed + 101) > 0.5
      addQuadTriWire(points, indices, p00, p10, p11, p01, flip)
    }
  }
}

/**
 * All edges of the nx×ny×nz Cartesian cell grid inside the box (interior faces + hull).
 * Coords: [x, depth, horizontal] = [x, -z/2..z/2, -y/2..y/2] matching existing cube mesh.
 */
function buildFullVolumeCartesianGrid(
  x: number,
  y: number,
  z: number,
  nx: number,
  ny: number,
  nz: number,
  points: number[],
  indices: number[]
) {
  const dx = x / nx
  const dy = y / ny
  const dz = z / nz
  const push = (a: number[], b: number[]) => {
    points.push(...a, ...b)
    const idx = points.length / 3 - 2
    indices.push(idx, idx + 1)
  }

  // Planes of constant x (vertical slices): full (depth × horizontal) grid on each slice.
  for (let i = 0; i <= nx; i++) {
    const xi = -x / 2 + i * dx
    for (let jj = 0; jj <= nz; jj++) {
      const yd = -z / 2 + jj * dz
      for (let kk = 0; kk < ny; kk++) {
        push([xi, yd, -y / 2 + kk * dy], [xi, yd, -y / 2 + (kk + 1) * dy])
      }
    }
    for (let kk = 0; kk <= ny; kk++) {
      const zh = -y / 2 + kk * dy
      for (let jj = 0; jj < nz; jj++) {
        push([xi, -z / 2 + jj * dz, zh], [xi, -z / 2 + (jj + 1) * dz, zh])
      }
    }
  }

  // Planes of constant depth (middle coord): full (x × horizontal) grid.
  for (let j = 0; j <= nz; j++) {
    const yd = -z / 2 + j * dz
    for (let kk = 0; kk <= ny; kk++) {
      const zh = -y / 2 + kk * dy
      for (let ii = 0; ii < nx; ii++) {
        push([-x / 2 + ii * dx, yd, zh], [-x / 2 + (ii + 1) * dx, yd, zh])
      }
    }
    for (let ii = 0; ii <= nx; ii++) {
      const xv = -x / 2 + ii * dx
      for (let kk = 0; kk < ny; kk++) {
        push([xv, yd, -y / 2 + kk * dy], [xv, yd, -y / 2 + (kk + 1) * dy])
      }
    }
  }

  // Planes of constant horizontal (third coord): full (x × depth) grid.
  for (let k = 0; k <= ny; k++) {
    const zk = -y / 2 + k * dy
    for (let jj = 0; jj <= nz; jj++) {
      const yd = -z / 2 + jj * dz
      for (let ii = 0; ii < nx; ii++) {
        push([-x / 2 + ii * dx, yd, zk], [-x / 2 + (ii + 1) * dx, yd, zk])
      }
    }
    for (let ii = 0; ii <= nx; ii++) {
      const xv = -x / 2 + ii * dx
      for (let jj = 0; jj < nz; jj++) {
        push([xv, -z / 2 + jj * dz, zk], [xv, -z / 2 + (jj + 1) * dz, zk])
      }
    }
  }
}

function buildStructuredHexaWireframe(
  x: number,
  y: number,
  z: number,
  nx: number,
  ny: number,
  nz: number,
  points: number[],
  indices: number[]
) {
  buildFullVolumeCartesianGrid(x, y, z, nx, ny, nz, points, indices)
}

/**
 * Kuhn 6-tet decomposition of each Cartesian cell (body diagonal 000–111 in local corner indices).
 * Wireframe = unique edges only (no full brick grid inside each cell).
 */
/** Distinct edge colors for the 6 Kuhn tets (readable on blue solid in ts mode). RGB 0–1. */
export const KUHN_TET_EDGE_COLORS: [number, number, number][] = [
  [1, 0.88, 0.2],
  [1, 0.38, 0.38],
  [0.35, 0.95, 0.55],
  [0.72, 0.48, 1],
  [1, 0.62, 0.12],
  [0.35, 0.78, 1],
]

const KUHN_TETRA_LOCAL: [number, number, number][][] = [
  [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
    [1, 1, 1],
  ],
  [
    [0, 0, 0],
    [1, 0, 0],
    [1, 0, 1],
    [1, 1, 1],
  ],
  [
    [0, 0, 0],
    [0, 1, 0],
    [1, 1, 0],
    [1, 1, 1],
  ],
  [
    [0, 0, 0],
    [0, 1, 0],
    [0, 1, 1],
    [1, 1, 1],
  ],
  [
    [0, 0, 0],
    [0, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
  ],
  [
    [0, 0, 0],
    [0, 0, 1],
    [0, 1, 1],
    [1, 1, 1],
  ],
]

function buildStructuredTetraWireframe(
  x: number,
  y: number,
  z: number,
  nx: number,
  ny: number,
  nz: number,
  points: number[],
  indices: number[],
  /** When set, each new edge is colored by the first Kuhn tet (0…5) that owns it. */
  colorsOut: number[] | null
) {
  const dx = x / nx
  const dy = y / ny
  const dz = z / nz
  const edgeSeen = new Set<string>()
  const pushSeg = (a: number[], b: number[], tetIdx: number) => {
    points.push(...a, ...b)
    const idx = points.length / 3 - 2
    indices.push(idx, idx + 1)
    if (colorsOut) {
      const c = KUHN_TET_EDGE_COLORS[tetIdx]
      colorsOut.push(c[0], c[1], c[2], c[0], c[1], c[2])
    }
  }
  const gridVertex = (ix: number, iy: number, iz: number): number[] => [
    -x / 2 + ix * dx,
    -z / 2 + iy * dz,
    -y / 2 + iz * dy,
  ]
  const edgeKey = (ix1: number, iy1: number, iz1: number, ix2: number, iy2: number, iz2: number) => {
    const t1 = `${ix1},${iy1},${iz1}`
    const t2 = `${ix2},${iy2},${iz2}`
    return t1 < t2 ? `${t1}|${t2}` : `${t2}|${t1}`
  }
  const tryEdge = (
    ix1: number,
    iy1: number,
    iz1: number,
    ix2: number,
    iy2: number,
    iz2: number,
    tetIdx: number
  ) => {
    const k = edgeKey(ix1, iy1, iz1, ix2, iy2, iz2)
    if (edgeSeen.has(k)) return
    edgeSeen.add(k)
    pushSeg(gridVertex(ix1, iy1, iz1), gridVertex(ix2, iy2, iz2), tetIdx)
  }

  for (let ci = 0; ci < nx; ci++) {
    for (let cj = 0; cj < nz; cj++) {
      for (let ck = 0; ck < ny; ck++) {
        for (let ti = 0; ti < KUHN_TETRA_LOCAL.length; ti++) {
          const tet = KUHN_TETRA_LOCAL[ti]
          for (let a = 0; a < 4; a++) {
            for (let b = a + 1; b < 4; b++) {
              const [lx1, ly1, lz1] = tet[a]
              const [lx2, ly2, lz2] = tet[b]
              tryEdge(ci + lx1, cj + ly1, ck + lz1, ci + lx2, cj + ly2, ck + lz2, ti)
            }
          }
        }
      }
    }
  }
}

/** Unstructured-style tetra: alternating diagonals (checkerboard) on each face. */
function buildUnstructuredTetraWireframe(
  x: number,
  y: number,
  z: number,
  nx: number,
  ny: number,
  nz: number,
  points: number[],
  indices: number[]
) {
  const jitter = 0.65
  // Left / right faces (YZ planes)
  addJitteredFaceTriGrid(points, indices, [-x / 2, -z / 2, -y / 2], [0, z, 0], [0, 0, y], nz, ny, jitter, 31)
  addJitteredFaceTriGrid(points, indices, [x / 2, -z / 2, -y / 2], [0, z, 0], [0, 0, y], nz, ny, jitter, 37)
  // Front / back faces
  addJitteredFaceTriGrid(points, indices, [-x / 2, -z / 2, -y / 2], [x, 0, 0], [0, z, 0], nx, nz, jitter, 41)
  addJitteredFaceTriGrid(points, indices, [-x / 2, -z / 2, y / 2], [x, 0, 0], [0, z, 0], nx, nz, jitter, 43)
  // Top / bottom faces
  addJitteredFaceTriGrid(points, indices, [-x / 2, z / 2, -y / 2], [x, 0, 0], [0, 0, y], nx, ny, jitter, 47)
  addJitteredFaceTriGrid(points, indices, [-x / 2, -z / 2, -y / 2], [x, 0, 0], [0, 0, y], nx, ny, jitter, 53)
}

/** Unstructured poly: center fan per face cell (4 triangles), not pentagon/star. */
function buildUnstructuredPolyWireframe(
  x: number,
  y: number,
  z: number,
  nx: number,
  ny: number,
  nz: number,
  points: number[],
  indices: number[]
) {
  const avgDim = (x + y + z) / 3
  const avgDensity = Math.max(8, Math.round((nx + ny + nz) / 3))
  const faceGrid = (lenU: number, lenV: number) => ({
    cols: Math.max(8, Math.round(avgDensity * (lenU / avgDim))),
    rows: Math.max(8, Math.round(avgDensity * (lenV / avgDim))),
  })
  const yzGrid = faceGrid(z, y)
  const xzGrid = faceGrid(x, z)
  const xyGrid = faceGrid(x, y)

  // Left / right faces (YZ planes)
  addHexTilingOnRectSurface(points, indices, {
    uMin: -z / 2,
    uMax: z / 2,
    vMin: -y / 2,
    vMax: y / 2,
    cols: yzGrid.cols,
    rows: yzGrid.rows,
    seed: 101,
    mapPoint: (u, v) => [-x / 2, u, v],
  })
  addHexTilingOnRectSurface(points, indices, {
    uMin: -z / 2,
    uMax: z / 2,
    vMin: -y / 2,
    vMax: y / 2,
    cols: yzGrid.cols,
    rows: yzGrid.rows,
    seed: 101,
    mapPoint: (u, v) => [x / 2, u, v],
  })
  // Front / back faces (XY planes in model coords -> X vs Z in view coords)
  addHexTilingOnRectSurface(points, indices, {
    uMin: -x / 2,
    uMax: x / 2,
    vMin: -z / 2,
    vMax: z / 2,
    cols: xzGrid.cols,
    rows: xzGrid.rows,
    seed: 101,
    mapPoint: (u, v) => [u, v, -y / 2],
  })
  addHexTilingOnRectSurface(points, indices, {
    uMin: -x / 2,
    uMax: x / 2,
    vMin: -z / 2,
    vMax: z / 2,
    cols: xzGrid.cols,
    rows: xzGrid.rows,
    seed: 101,
    mapPoint: (u, v) => [u, v, y / 2],
  })
  // Top / bottom faces (XZ planes in model coords -> X vs Y-depth map)
  addHexTilingOnRectSurface(points, indices, {
    uMin: -x / 2,
    uMax: x / 2,
    vMin: -y / 2,
    vMax: y / 2,
    cols: xyGrid.cols,
    rows: xyGrid.rows,
    seed: 101,
    mapPoint: (u, v) => [u, z / 2, v],
  })
  addHexTilingOnRectSurface(points, indices, {
    uMin: -x / 2,
    uMax: x / 2,
    vMin: -y / 2,
    vMax: y / 2,
    cols: xyGrid.cols,
    rows: xyGrid.rows,
    seed: 101,
    mapPoint: (u, v) => [u, -z / 2, v],
  })
}

export function createCubeWireframe(
  x: number,
  y: number,
  z: number,
  counts: any,
  wireStyle: CubeWireStyle,
  /** Blue (ts) only: color Kuhn tet edges; gray/python/dark stay uniform. */
  colorTsWireframe = false
): THREE.BufferGeometry {
  const nx = counts.numSourcesX || 8
  const ny = counts.numSourcesY || 8
  const nz = counts.numSourcesZ || 8
  const points: number[] = []
  const indices: number[] = []
  const lineColors: number[] | null =
    colorTsWireframe && wireStyle === 'tetra' ? [] : null

  switch (wireStyle) {
    case 'hexa':
      buildStructuredHexaWireframe(x, y, z, nx, ny, nz, points, indices)
      break
    case 'tetra':
      buildStructuredTetraWireframe(x, y, z, nx, ny, nz, points, indices, lineColors)
      break
    case 'unstructuredTetra':
    case 'gmshTetra':
      buildUnstructuredTetraWireframe(x, y, z, nx, ny, nz, points, indices)
      break
    case 'unstructuredPoly':
      buildUnstructuredPolyWireframe(x, y, z, nx, ny, nz, points, indices)
      break
    default:
      buildStructuredHexaWireframe(x, y, z, nx, ny, nz, points, indices)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  if (lineColors && lineColors.length > 0) {
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3))
  }
  geometry.setIndex(indices)
  return geometry
}
