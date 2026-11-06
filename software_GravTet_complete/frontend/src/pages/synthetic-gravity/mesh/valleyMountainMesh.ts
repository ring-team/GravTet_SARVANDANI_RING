import * as THREE from 'three'
import type { CubeWireStyle } from '../default_data/defaultSources'
import { addHexTilingOnRectSurface } from './polySurfaceTiling'
import { valleyMountainDisplayReliefX } from './valleyMountainTopography'

function hash01(i: number, j: number, seed: number) {
  const n = Math.sin(i * 127.1 + j * 311.7 + seed * 17.13) * 43758.5453123
  return n - Math.floor(n)
}

function pushLine(points: number[], indices: number[], a: number[], b: number[]) {
  points.push(...a, ...b)
  const idx = points.length / 3 - 2
  indices.push(idx, idx + 1)
}

function addQuadEdges(points: number[], indices: number[], p1: number[], p2: number[], p3: number[], p4: number[]) {
  pushLine(points, indices, p1, p2)
  pushLine(points, indices, p2, p3)
  pushLine(points, indices, p3, p4)
  pushLine(points, indices, p4, p1)
}

function addQuadForStyle(
  points: number[],
  indices: number[],
  p1: [number, number, number],
  p2: [number, number, number],
  p3: [number, number, number],
  p4: [number, number, number],
  wireStyle: CubeWireStyle,
  i: number,
  j: number
) {
  addQuadEdges(points, indices, p1, p2, p3, p4)
  if (wireStyle === 'tetra' || wireStyle === 'unstructuredTetra') {
    if (wireStyle === 'unstructuredTetra') {
      // Unstructured tetra should avoid checkerboard regularity on side faces.
      // Use deterministic hash-based split choice per cell to mimic irregular triangulation.
      const flip = hash01(i + 13, j + 29, 211) > 0.5
      if (flip) pushLine(points, indices, p1, p3)
      else pushLine(points, indices, p2, p4)
    } else if ((i + j) % 2 === 0) {
      pushLine(points, indices, p1, p3)
    } else {
      pushLine(points, indices, p2, p4)
    }
    return
  }
  if (wireStyle === 'unstructuredPoly') {
    const corners: [number[], number[], number[], number[]] = [p1, p2, p3, p4]
    const split = Math.floor(hash01(i + 17, j + 31, 97) * 4) % 4
    const center: [number, number, number] = [
      (p1[0] + p2[0] + p3[0] + p4[0]) / 4,
      (p1[1] + p2[1] + p3[1] + p4[1]) / 4,
      (p1[2] + p2[2] + p3[2] + p4[2]) / 4,
    ]
    const a = corners[split]
    const b = corners[(split + 1) % 4]
    const mid: [number, number, number] = [
      ((a[0] + b[0]) * 0.5) * 0.82 + center[0] * 0.18,
      ((a[1] + b[1]) * 0.5) * 0.82 + center[1] * 0.18,
      ((a[2] + b[2]) * 0.5) * 0.82 + center[2] * 0.18,
    ]
    const poly = [corners[0], corners[1], corners[2], corners[3]]
    poly.splice(split + 1, 0, mid)
    for (let v = 0; v < poly.length; v++) {
      pushLine(points, indices, poly[v], poly[(v + 1) % poly.length])
    }
  }
}

function addJitteredTriParamSurface(
  points: number[],
  indices: number[],
  nu: number,
  nv: number,
  jitter: number,
  seed: number,
  mapPoint: (u: number, v: number) => [number, number, number]
) {
  const nodes: [number, number, number][][] = Array.from({ length: nu + 1 }, () => Array(nv + 1))
  const du = 1 / nu
  const dv = 1 / nv
  const juAmp = du * jitter
  const jvAmp = dv * jitter

  for (let i = 0; i <= nu; i++) {
    for (let j = 0; j <= nv; j++) {
      let u = i * du
      let v = j * dv
      if (i > 0 && i < nu && j > 0 && j < nv) {
        u += (hash01(i, j, seed) - 0.5) * juAmp
        v += (hash01(i, j, seed + 53) - 0.5) * jvAmp
      }
      nodes[i][j] = mapPoint(u, v)
    }
  }

  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const p00 = nodes[i][j]
      const p10 = nodes[i + 1][j]
      const p11 = nodes[i + 1][j + 1]
      const p01 = nodes[i][j + 1]
      const flip = hash01(i, j, seed + 101) > 0.5
      if (flip) {
        addQuadEdges(points, indices, p00, p10, p11, p01)
        pushLine(points, indices, p00, p11)
      } else {
        addQuadEdges(points, indices, p00, p10, p11, p01)
        pushLine(points, indices, p10, p01)
      }
    }
  }
}

function topRelief(x: number, sizeX: number, mountainHeight: number, valleyDepth: number) {
  return valleyMountainDisplayReliefX(x, sizeX, mountainHeight, valleyDepth)
}

function vertex(
  i: number,
  j: number,
  nx: number,
  ny: number,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  mountainHeight: number,
  valleyDepth: number,
  top: boolean,
  unstructured: boolean,
  seed: number
): [number, number, number] {
  const tx = i / nx
  const ty = j / ny
  let x = -sizeX / 2 + tx * sizeX
  let z = -sizeY / 2 + ty * sizeY
  if (unstructured && i > 0 && i < nx && j > 0 && j < ny) {
    x += (hash01(i, j, seed) - 0.5) * (sizeX / nx) * 0.42
    z += (hash01(j, i, seed + 11) - 0.5) * (sizeY / ny) * 0.42
  }
  const baseTop = sizeZ / 2
  const yTop = baseTop + topRelief(x, sizeX, mountainHeight, valleyDepth)
  const yBottom = -sizeZ / 2
  return [x, top ? yTop : yBottom, z]
}

export function createValleyMountainWireframe(
  x: number,
  y: number,
  z: number,
  mountainHeight: number,
  valleyDepth: number,
  counts: any,
  wireStyle: CubeWireStyle
): THREE.BufferGeometry {
  const nx = Math.max(4, counts.numSourcesX || 24)
  const ny = Math.max(4, counts.numSourcesY || 20)
  const nz = Math.max(3, counts.numSourcesZ || 12)
  const points: number[] = []
  const indices: number[] = []
  const isUnstructured = wireStyle === 'unstructuredTetra' || wireStyle === 'unstructuredPoly'

  if (wireStyle === 'unstructuredPoly') {
    const xMin = -x / 2
    const xMax = x / 2
    const yMin = -z / 2
    const yMax = z / 2
    const zMin = -y / 2
    const zMax = y / 2
    const sideRows = Math.max(6, nz * 2)
    const topRows = Math.max(6, ny)
    const maxRelief = Math.max(mountainHeight, valleyDepth)
    const sideHeight = (yMax + maxRelief) - yMin

    // Top relief surface (x, z) -> y
    addHexTilingOnRectSurface(points, indices, {
      uMin: xMin,
      uMax: xMax,
      vMin: zMin,
      vMax: zMax,
      cols: Math.max(8, nx),
      rows: Math.max(8, topRows),
      seed: 1201,
      mapPoint: (u, v) => [u, yMax + topRelief(u, x, mountainHeight, valleyDepth), v],
    })

    // Bottom face
    addHexTilingOnRectSurface(points, indices, {
      uMin: xMin,
      uMax: xMax,
      vMin: zMin,
      vMax: zMax,
      cols: Math.max(8, nx),
      rows: Math.max(8, topRows),
      seed: 1211,
      mapPoint: (u, v) => [u, yMin, v],
    })

    // Front side (z=zMin)
    addHexTilingOnRectSurface(points, indices, {
      uMin: xMin,
      uMax: xMax,
      vMin: 0,
      vMax: sideHeight,
      cols: Math.max(8, nx),
      rows: Math.max(8, sideRows),
      seed: 1221,
      mapPoint: (u, v) => {
        const t = Math.max(0, Math.min(1, v / Math.max(1e-6, sideHeight)))
        return [u, (yMax + topRelief(u, x, mountainHeight, valleyDepth)) * (1 - t) + yMin * t, zMin]
      },
    })

    // Back side (z=zMax)
    addHexTilingOnRectSurface(points, indices, {
      uMin: xMin,
      uMax: xMax,
      vMin: 0,
      vMax: sideHeight,
      cols: Math.max(8, nx),
      rows: Math.max(8, sideRows),
      seed: 1231,
      mapPoint: (u, v) => {
        const t = Math.max(0, Math.min(1, v / Math.max(1e-6, sideHeight)))
        return [u, (yMax + topRelief(u, x, mountainHeight, valleyDepth)) * (1 - t) + yMin * t, zMax]
      },
    })

    // Left side (x=xMin)
    addHexTilingOnRectSurface(points, indices, {
      uMin: zMin,
      uMax: zMax,
      vMin: 0,
      vMax: sideHeight,
      cols: Math.max(8, ny),
      rows: Math.max(8, sideRows),
      seed: 1241,
      mapPoint: (u, v) => {
        const t = Math.max(0, Math.min(1, v / Math.max(1e-6, sideHeight)))
        return [xMin, (yMax + topRelief(xMin, x, mountainHeight, valleyDepth)) * (1 - t) + yMin * t, u]
      },
    })

    // Right side (x=xMax)
    addHexTilingOnRectSurface(points, indices, {
      uMin: zMin,
      uMax: zMax,
      vMin: 0,
      vMax: sideHeight,
      cols: Math.max(8, ny),
      rows: Math.max(8, sideRows),
      seed: 1251,
      mapPoint: (u, v) => {
        const t = Math.max(0, Math.min(1, v / Math.max(1e-6, sideHeight)))
        return [xMax, (yMax + topRelief(xMax, x, mountainHeight, valleyDepth)) * (1 - t) + yMin * t, u]
      },
    })

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    geometry.setIndex(indices)
    return geometry
  }
  const topGrid: [number, number, number][][] = Array.from({ length: nx + 1 }, () => Array(ny + 1))
  const botGrid: [number, number, number][][] = Array.from({ length: nx + 1 }, () => Array(ny + 1))

  for (let i = 0; i <= nx; i++) {
    for (let j = 0; j <= ny; j++) {
      topGrid[i][j] = vertex(i, j, nx, ny, x, y, z, mountainHeight, valleyDepth, true, isUnstructured, 71)
      botGrid[i][j] = vertex(
        i,
        j,
        nx,
        ny,
        x,
        y,
        z,
        mountainHeight,
        valleyDepth,
        false,
        wireStyle === 'unstructuredTetra',
        173
      )
    }
  }

  // Top face (mountain + valley relief) and bottom face.
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      addQuadForStyle(points, indices, topGrid[i][j], topGrid[i + 1][j], topGrid[i + 1][j + 1], topGrid[i][j + 1], wireStyle, i, j)
      addQuadForStyle(points, indices, botGrid[i][j], botGrid[i + 1][j], botGrid[i + 1][j + 1], botGrid[i][j + 1], wireStyle, i, j)
    }
  }

  if (wireStyle === 'unstructuredTetra') {
    const jitter = 0.65
    addJitteredTriParamSurface(points, indices, nx, nz, jitter, 1401, (u, v) => {
      const px = -x / 2 + u * x
      const zFront = -y / 2
      const yTop = z / 2 + topRelief(px, x, mountainHeight, valleyDepth)
      const yBottom = -z / 2
      return [px, yTop * (1 - v) + yBottom * v, zFront]
    })
    addJitteredTriParamSurface(points, indices, nx, nz, jitter, 1411, (u, v) => {
      const px = -x / 2 + u * x
      const zBack = y / 2
      const yTop = z / 2 + topRelief(px, x, mountainHeight, valleyDepth)
      const yBottom = -z / 2
      return [px, yTop * (1 - v) + yBottom * v, zBack]
    })
    addJitteredTriParamSurface(points, indices, ny, nz, jitter, 1421, (u, v) => {
      const pz = -y / 2 + u * y
      const px = -x / 2
      const yTop = z / 2 + topRelief(px, x, mountainHeight, valleyDepth)
      const yBottom = -z / 2
      return [px, yTop * (1 - v) + yBottom * v, pz]
    })
    addJitteredTriParamSurface(points, indices, ny, nz, jitter, 1431, (u, v) => {
      const pz = -y / 2 + u * y
      const px = x / 2
      const yTop = z / 2 + topRelief(px, x, mountainHeight, valleyDepth)
      const yBottom = -z / 2
      return [px, yTop * (1 - v) + yBottom * v, pz]
    })
  } else {
    // Side faces along y-constant boundaries (front/back in preview).
    for (let i = 0; i < nx; i++) {
      const jA = 0
      const jB = ny
      for (let k = 0; k < nz; k++) {
        const t0 = k / nz
        const t1 = (k + 1) / nz

        const fa = topGrid[i][jA]
        const fb = topGrid[i + 1][jA]
        const fc = botGrid[i + 1][jA]
        const fd = botGrid[i][jA]
        const f00: [number, number, number] = [fa[0], fa[1] * (1 - t0) + fd[1] * t0, fa[2]]
        const f10: [number, number, number] = [fb[0], fb[1] * (1 - t0) + fc[1] * t0, fb[2]]
        const f11: [number, number, number] = [fb[0], fb[1] * (1 - t1) + fc[1] * t1, fb[2]]
        const f01: [number, number, number] = [fa[0], fa[1] * (1 - t1) + fd[1] * t1, fa[2]]
        addQuadForStyle(points, indices, f00, f10, f11, f01, wireStyle, i, k)

        const ba = topGrid[i][jB]
        const bb = topGrid[i + 1][jB]
        const bc = botGrid[i + 1][jB]
        const bd = botGrid[i][jB]
        const b00: [number, number, number] = [ba[0], ba[1] * (1 - t0) + bd[1] * t0, ba[2]]
        const b10: [number, number, number] = [bb[0], bb[1] * (1 - t0) + bc[1] * t0, bb[2]]
        const b11: [number, number, number] = [bb[0], bb[1] * (1 - t1) + bc[1] * t1, bb[2]]
        const b01: [number, number, number] = [ba[0], ba[1] * (1 - t1) + bd[1] * t1, ba[2]]
        addQuadForStyle(points, indices, b00, b10, b11, b01, wireStyle, i + 1000, k)
      }
    }

    // Side faces along x-constant boundaries.
    for (let j = 0; j < ny; j++) {
      const iL = 0
      const iR = nx
      for (let k = 0; k < nz; k++) {
        const t0 = k / nz
        const t1 = (k + 1) / nz

        const la = topGrid[iL][j]
        const lb = topGrid[iL][j + 1]
        const lc = botGrid[iL][j + 1]
        const ld = botGrid[iL][j]
        const l00: [number, number, number] = [la[0], la[1] * (1 - t0) + ld[1] * t0, la[2]]
        const l10: [number, number, number] = [lb[0], lb[1] * (1 - t0) + lc[1] * t0, lb[2]]
        const l11: [number, number, number] = [lb[0], lb[1] * (1 - t1) + lc[1] * t1, lb[2]]
        const l01: [number, number, number] = [la[0], la[1] * (1 - t1) + ld[1] * t1, la[2]]
        addQuadForStyle(points, indices, l00, l10, l11, l01, wireStyle, j, k + 2000)

        const ra = topGrid[iR][j]
        const rb = topGrid[iR][j + 1]
        const rc = botGrid[iR][j + 1]
        const rd = botGrid[iR][j]
        const r00: [number, number, number] = [ra[0], ra[1] * (1 - t0) + rd[1] * t0, ra[2]]
        const r10: [number, number, number] = [rb[0], rb[1] * (1 - t0) + rc[1] * t0, rb[2]]
        const r11: [number, number, number] = [rb[0], rb[1] * (1 - t1) + rc[1] * t1, rb[2]]
        const r01: [number, number, number] = [ra[0], ra[1] * (1 - t1) + rd[1] * t1, ra[2]]
        addQuadForStyle(points, indices, r00, r10, r11, r01, wireStyle, j, k + 3000)
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  geometry.setIndex(indices)
  return geometry
}
