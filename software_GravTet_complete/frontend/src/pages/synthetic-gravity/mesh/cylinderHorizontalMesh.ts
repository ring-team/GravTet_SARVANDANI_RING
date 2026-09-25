/**
 * Horizontal cylinder wireframe: mantle and end caps along **X** for synthetic gravity previews.
 *
 * Mirrors the vertical cylinder builder with axis-appropriate UV patches and poly tiling helpers.
 */
import * as THREE from 'three'
import { inflateCylinderWireframeXZ } from './meshUtils'
import { addHexTilingOnDiskSurface, addHexTilingOnRectSurface } from './polySurfaceTiling'

type CylinderWireMode =
  | 'hexa'
  | 'tetra'
  | 'poly'
  | 'unstructuredTetra'
  | 'unstructuredPoly'

function pushLine(points: number[], indices: number[], a: number[], b: number[]) {
  points.push(...a, ...b)
  const idx = points.length / 3 - 2
  indices.push(idx, idx + 1)
}

function addSubdividedLine(points: number[], indices: number[], a: number[], b: number[], segments = 6) {
  let prev = [a[0], a[1], a[2]]
  for (let i = 1; i <= segments; i++) {
    const t = i / segments
    const curr = [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ]
    pushLine(points, indices, prev, curr)
    prev = curr
  }
}

function addTriangleWire(points: number[], indices: number[], p1: number[], p2: number[], p3: number[]) {
  pushLine(points, indices, p1, p2)
  pushLine(points, indices, p2, p3)
  pushLine(points, indices, p3, p1)
}

function addCylinderSurfaceEdge(points: number[], indices: number[], radius: number, a: number[], b: number[], segments = 6) {
  let theta1 = Math.atan2(a[2], a[0])
  let theta2 = Math.atan2(b[2], b[0])
  const y1 = a[1]
  const y2 = b[1]

  let dTheta = theta2 - theta1
  if (dTheta > Math.PI) dTheta -= Math.PI * 2
  if (dTheta < -Math.PI) dTheta += Math.PI * 2

  let prev: number[] = [radius * Math.cos(theta1), y1, radius * Math.sin(theta1)]
  for (let i = 1; i <= segments; i++) {
    const t = i / segments
    const theta = theta1 + dTheta * t
    const y = y1 + (y2 - y1) * t
    const curr: number[] = [radius * Math.cos(theta), y, radius * Math.sin(theta)]
    pushLine(points, indices, prev, curr)
    prev = curr
  }
}

function addTriangleWireOnCylinderSurface(
  points: number[],
  indices: number[],
  radius: number,
  p1: number[],
  p2: number[],
  p3: number[]
) {
  addCylinderSurfaceEdge(points, indices, radius, p1, p2)
  addCylinderSurfaceEdge(points, indices, radius, p2, p3)
  addCylinderSurfaceEdge(points, indices, radius, p3, p1)
}

function addPentagonWire(
  points: number[],
  indices: number[],
  center: number[],
  c1: number[],
  c2: number[],
  c3: number[],
  c4: number[]
) {
  pushLine(points, indices, c1, c2)
  pushLine(points, indices, c2, c3)
  pushLine(points, indices, c3, c4)
  pushLine(points, indices, c4, c1)
  pushLine(points, indices, center, c1)
  pushLine(points, indices, center, c2)
  pushLine(points, indices, center, c3)
  pushLine(points, indices, center, c4)
}

function addQuadCellWire(points: number[], indices: number[], p1: number[], p2: number[], p3: number[], p4: number[]) {
  pushLine(points, indices, p1, p2)
  pushLine(points, indices, p2, p3)
  pushLine(points, indices, p3, p4)
  pushLine(points, indices, p4, p1)
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

function buildJitteredCylinderNodes(radius: number, axisLength: number, nTheta: number, nAxis: number, seed: number) {
  const nodes: number[][][] = []
  const thetaStep = (Math.PI * 2) / nTheta
  const axisStep = axisLength / nAxis
  const rowPhaseOffsets = Array.from({ length: nAxis + 1 }, (_, k) =>
    k > 0 && k < nAxis ? (hash01(k, seed, seed + 7) - 0.5) * 1.2 * thetaStep : 0
  )

  for (let k = 0; k <= nAxis; k++) {
    const row: number[][] = []
    const yBase = -axisLength / 2 + (k / nAxis) * axisLength
    for (let j = 0; j < nTheta; j++) {
      let theta = (j / nTheta) * Math.PI * 2
      let y = yBase
      if (k > 0 && k < nAxis) {
        theta += rowPhaseOffsets[k]
        theta += (hash01(j, k, seed) - 0.5) * 0.42 * thetaStep
        theta += (hash01(j + k, k, seed + 3) - 0.5) * 0.16 * thetaStep
        y += (hash01(k, j, seed + 1) - 0.5) * 0.3 * axisStep
        y += (hash01(j, j + k, seed + 4) - 0.5) * 0.1 * axisStep
      }
      row.push([radius * Math.cos(theta), y, radius * Math.sin(theta)])
    }
    nodes.push(row)
  }

  return nodes
}

function buildJitteredCapRings(radius: number, yCap: number, nRadial: number, nTheta: number, seed: number) {
  const rings: number[][][] = []
  const thetaStep = (Math.PI * 2) / nTheta
  const radialStep = radius / nRadial
  const ringPhaseOffsets = Array.from({ length: nRadial + 1 }, (_, i) =>
    i > 0 ? (hash01(i, seed, seed + 11) - 0.5) * 1.1 * thetaStep : 0
  )

  rings.push(Array.from({ length: nTheta }, () => [0, yCap, 0]))

  for (let i = 1; i <= nRadial; i++) {
    const row: number[][] = []
    const baseRadius = (i / nRadial) * radius
    const edgeDamp = i === nRadial ? 0.2 : 1
    for (let j = 0; j < nTheta; j++) {
      let theta = (j / nTheta) * Math.PI * 2
      let r = baseRadius
      theta += ringPhaseOffsets[i]
      theta += (hash01(j, i, seed + 1) - 0.5) * 0.34 * thetaStep * edgeDamp
      if (i < nRadial) {
        r += (hash01(i, j, seed + 2) - 0.5) * 0.18 * radialStep
      }
      r = Math.max(0, Math.min(radius, r))
      row.push([r * Math.cos(theta), yCap, r * Math.sin(theta)])
    }
    rings.push(row)
  }

  return rings
}

function addUnstructuredPolyCylinderSurface(
  points: number[],
  indices: number[],
  nodes: number[][][],
  nTheta: number,
  nAxis: number,
  seed: number
) {
  for (let k = 0; k < nAxis; k++) {
    for (let j = 0; j < nTheta; j++) {
      const j1 = (j + 1) % nTheta
      addPentagonCellWire(
        points,
        indices,
        nodes[k][j],
        nodes[k][j1],
        nodes[k + 1][j1],
        nodes[k + 1][j],
        Math.floor(hash01(j, k, seed + 9) * 4)
      )
    }
  }
}

function addUnstructuredPolyCylinderCap(
  points: number[],
  indices: number[],
  rings: number[][][],
  nRadial: number,
  nTheta: number,
  seed: number
) {
  for (let j = 0; j < nTheta; j++) {
    const j2 = (j + 1) % nTheta
    pushLine(points, indices, rings[1][j], rings[1][j2])
  }

  for (let i = 1; i < nRadial; i++) {
    for (let j = 0; j < nTheta; j++) {
      const j1 = (j + 1) % nTheta
      addPentagonCellWire(
        points,
        indices,
        rings[i][j],
        rings[i][j1],
        rings[i + 1][j1],
        rings[i + 1][j],
        Math.floor(hash01(i, j, seed + 9) * 4)
      )
    }
  }
}

function addUnstructuredCylinderCap(
  points: number[],
  indices: number[],
  radius: number,
  yCap: number,
  nRadial: number,
  nTheta: number,
  mode: 'unstructuredTetra' | 'unstructuredPoly',
  seed: number
) {
  const rings = buildJitteredCapRings(radius, yCap, nRadial, nTheta, seed)
  const center = [0, yCap, 0]

  for (let j = 0; j < nTheta; j++) {
    const j2 = (j + 1) % nTheta
    const p1 = rings[1][j]
    const p2 = rings[1][j2]
    if (mode === 'unstructuredTetra') {
      addTriangleWire(points, indices, center, p1, p2)
    } else {
      // Poly mode uses quad-dominant annular cells below; only keep the inner boundary circle here.
      pushLine(points, indices, p1, p2)
    }
  }

  if (mode === 'unstructuredPoly') {
    addUnstructuredPolyCylinderCap(points, indices, rings, nRadial, nTheta, seed + 20)
    return
  }

  for (let i = 1; i < nRadial; i++) {
    for (let j = 0; j < nTheta; j++) {
      const j2 = (j + 1) % nTheta
      const p1 = rings[i][j]
      const p2 = rings[i][j2]
      const p3 = rings[i + 1][j]
      const p4 = rings[i + 1][j2]

      if (mode === 'unstructuredTetra') {
        if (hash01(i, j, seed + 3) > 0.5) {
          addTriangleWire(points, indices, p1, p2, p4)
          addTriangleWire(points, indices, p1, p4, p3)
        } else {
          addTriangleWire(points, indices, p1, p2, p3)
          addTriangleWire(points, indices, p2, p4, p3)
        }
      }
    }
  }
}

function addCylinderHorizontalWireframe(
  points: number[],
  indices: number[],
  radius: number,
  axisLength: number,
  nRadial: number,
  nTheta: number,
  nAxis: number,
  mode: CylinderWireMode
) {
  const isUnstructured = mode === 'unstructuredTetra' || mode === 'unstructuredPoly'

  if (isUnstructured) {
    const nodes = buildJitteredCylinderNodes(radius, axisLength, nTheta, nAxis, 551)

    if (mode === 'unstructuredPoly') {
      const circumference = 2 * Math.PI * radius
      const aspect = circumference / axisLength
      const polyRows = Math.max(4, Math.round(nAxis * 1.2))
      const polyCols = Math.max(4, Math.round(polyRows * aspect))
      // Keep cap polygon size close to side-wall polygon size so the
      // end caps do not look much finer/coarser than the cylinder body.
      const sideTargetEdge = Math.max(1e-6, axisLength / polyRows)
      const capRows = Math.max(3, Math.round((2 * radius) / sideTargetEdge))
      addHexTilingOnRectSurface(points, indices, {
        uMin: 0,
        uMax: circumference,
        vMin: -axisLength / 2,
        vMax: axisLength / 2,
        cols: polyCols,
        rows: polyRows,
        seed: 651,
        wrapU: true,
        edgeSubdivisions: 6,
        mapPoint: (arc, y) => {
          const theta = arc / radius
          return [radius * Math.cos(theta), y, radius * Math.sin(theta)]
        },
      })
      addHexTilingOnDiskSurface(points, indices, {
        radius,
        rows: capRows,
        seed: 801,
        mapPoint: (x, z) => [x, axisLength / 2, z],
      })
      addHexTilingOnDiskSurface(points, indices, {
        radius,
        rows: capRows,
        seed: 851,
        mapPoint: (x, z) => [x, -axisLength / 2, z],
      })
      return
    }

    for (let k = 0; k < nAxis; k++) {
      for (let j = 0; j < nTheta; j++) {
        const j2 = (j + 1) % nTheta
        const p1 = nodes[k][j]
        const p2 = nodes[k][j2]
        const p3 = nodes[k + 1][j]
        const p4 = nodes[k + 1][j2]

        if (mode === 'unstructuredTetra') {
          if (hash01(j, k, 553) > 0.5) {
            addTriangleWireOnCylinderSurface(points, indices, radius, p1, p2, p4)
            addTriangleWireOnCylinderSurface(points, indices, radius, p1, p4, p3)
          } else {
            addTriangleWireOnCylinderSurface(points, indices, radius, p1, p2, p3)
            addTriangleWireOnCylinderSurface(points, indices, radius, p2, p4, p3)
          }
        }
      }
    }

    addUnstructuredCylinderCap(points, indices, radius, axisLength / 2, nRadial, nTheta, mode, 801)
    addUnstructuredCylinderCap(points, indices, radius, -axisLength / 2, nRadial, nTheta, mode, 851)

    return
  }

  for (let k = 0; k <= nAxis; k++) {
    const y = -axisLength / 2 + (k / nAxis) * axisLength
    for (let j = 0; j < nTheta; j++) {
      const t1 = (j / nTheta) * Math.PI * 2
      const t2 = ((j + 1) / nTheta) * Math.PI * 2
      const a = [radius * Math.cos(t1), y, radius * Math.sin(t1)]
      const b = [radius * Math.cos(t2), y, radius * Math.sin(t2)]
      addCylinderSurfaceEdge(points, indices, radius, a, b)
    }
  }

  for (let j = 0; j < nTheta; j++) {
    const t = (j / nTheta) * Math.PI * 2
    pushLine(points, indices, [radius * Math.cos(t), -axisLength / 2, radius * Math.sin(t)], [radius * Math.cos(t), axisLength / 2, radius * Math.sin(t)])
  }

  if (mode === 'tetra' || mode === 'poly') {
    const tetraLike = mode === 'tetra'

    for (let j = 0; j < nTheta; j++) {
      const t1 = (j / nTheta) * Math.PI * 2
      const t2 = ((j + 1) / nTheta) * Math.PI * 2
      for (let k = 0; k < nAxis; k++) {
        const y1 = -axisLength / 2 + (k / nAxis) * axisLength
        const y2 = -axisLength / 2 + ((k + 1) / nAxis) * axisLength

        if (tetraLike) {
          const even = (j + k) % 2 === 0
          if (even) {
            addCylinderSurfaceEdge(points, indices, radius, [radius * Math.cos(t1), y1, radius * Math.sin(t1)], [radius * Math.cos(t2), y2, radius * Math.sin(t2)])
          } else {
            addCylinderSurfaceEdge(points, indices, radius, [radius * Math.cos(t2), y1, radius * Math.sin(t2)], [radius * Math.cos(t1), y2, radius * Math.sin(t1)])
          }
        } else {
          const c1 = [radius * Math.cos(t1), y1, radius * Math.sin(t1)]
          const c2 = [radius * Math.cos(t2), y1, radius * Math.sin(t2)]
          const c3 = [radius * Math.cos(t2), y2, radius * Math.sin(t2)]
          const c4 = [radius * Math.cos(t1), y2, radius * Math.sin(t1)]
          const tc = (t1 + t2) * 0.5
          const yc = (y1 + y2) * 0.5
          const center = [radius * Math.cos(tc), yc, radius * Math.sin(tc)]
          addPentagonWire(points, indices, center, c1, c2, c3, c4)
        }
      }
    }
  }

  if (mode !== 'poly') {
    for (const yCap of [axisLength / 2, -axisLength / 2]) {
      for (let i = 1; i <= nRadial; i++) {
        const r = (i / nRadial) * radius
        for (let j = 0; j < nTheta; j++) {
          const t1 = (j / nTheta) * Math.PI * 2
          const t2 = ((j + 1) / nTheta) * Math.PI * 2
          addCylinderSurfaceEdge(points, indices, r, [r * Math.cos(t1), yCap, r * Math.sin(t1)], [r * Math.cos(t2), yCap, r * Math.sin(t2)])
        }
      }
    }
  }

  if (mode === 'tetra') {
    const yCaps = [axisLength / 2, -axisLength / 2]
    for (let capIdx = 0; capIdx < yCaps.length; capIdx++) {
      const yCap = yCaps[capIdx]
      for (let i = 1; i <= nRadial; i++) {
        const r1 = ((i - 1) / nRadial) * radius
        const r2 = (i / nRadial) * radius
        for (let j = 0; j < nTheta; j++) {
          const t1 = (j / nTheta) * Math.PI * 2
          const t2 = ((j + 1) / nTheta) * Math.PI * 2
          const even = (i + j) % 2 === 0
          if (even) {
            addSubdividedLine(points, indices, [r1 * Math.cos(t1), yCap, r1 * Math.sin(t1)], [r2 * Math.cos(t2), yCap, r2 * Math.sin(t2)])
          } else {
            addSubdividedLine(points, indices, [r2 * Math.cos(t1), yCap, r2 * Math.sin(t1)], [r1 * Math.cos(t2), yCap, r1 * Math.sin(t2)])
          }
        }
      }
    }
  }

  if (mode === 'poly') {
    const yCaps = [axisLength / 2, -axisLength / 2]
    for (let capIdx = 0; capIdx < yCaps.length; capIdx++) {
      const yCap = yCaps[capIdx]
      for (let i = 1; i <= nRadial; i++) {
        const r1 = ((i - 1) / nRadial) * radius
        const r2 = (i / nRadial) * radius
        for (let j = 0; j < nTheta; j++) {
          const t1 = (j / nTheta) * Math.PI * 2
          const t2 = ((j + 1) / nTheta) * Math.PI * 2
          const c1 = [r1 * Math.cos(t1), yCap, r1 * Math.sin(t1)]
          const c2 = [r2 * Math.cos(t1), yCap, r2 * Math.sin(t1)]
          const c3 = [r2 * Math.cos(t2), yCap, r2 * Math.sin(t2)]
          const c4 = [r1 * Math.cos(t2), yCap, r1 * Math.sin(t2)]
          const rc = (r1 + r2) * 0.5
          const tc = (t1 + t2) * 0.5
          const center = [rc * Math.cos(tc), yCap, rc * Math.sin(tc)]
          addPentagonWire(points, indices, center, c1, c2, c3, c4)
        }
      }
    }
  }
}

export function createCylinderHorizontalWireframe(
  radius: number,
  length: number,
  counts: any,
  isTetra: boolean,
  isPoly: boolean,
  lineRadiusBoost = 1,
  unstructuredTetra = false,
  unstructuredPoly = false
): THREE.BufferGeometry {
  const nRadial = counts.numSourcesRadial || 8
  const nTheta = counts.numSourcesTheta || 12
  const nLength = counts.numSourcesLength || 12

  const points: number[] = []
  const indices: number[] = []
  const cylMode: CylinderWireMode = isTetra
    ? unstructuredTetra
      ? 'unstructuredTetra'
      : 'tetra'
    : isPoly
      ? unstructuredPoly
        ? 'unstructuredPoly'
        : 'poly'
      : 'hexa'

  addCylinderHorizontalWireframe(points, indices, radius, length, nRadial, nTheta, nLength, cylMode)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  geometry.setIndex(indices)
  inflateCylinderWireframeXZ(geometry, lineRadiusBoost)
  return geometry
}
