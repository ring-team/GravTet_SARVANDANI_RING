/**
 * Ellipsoid wireframe: axis-aligned ellipsoid surface mesh (hexa/tetra/poly) for gravity model previews.
 *
 * Builds edges on the implicit surface with optional inflation so lines align with solid rendering for structured meshes.
 */
import * as THREE from 'three'
import { ellipsoidSurfacePoint, inflateSphereWireframeRadial, surfaceAngularMeshCountsFromXYZ } from './meshUtils'
import { addHexTilingOnRectSurface } from './polySurfaceTiling'

/**
 * Geodesic-like edge on the ellipsoid: slerp in normalized (x/a, y/c, z/b) space, then map back.
 * Straight chords between samples sit inside the surface and disappear when cells are large; this matches sphere `addSphereSurfaceEdge`.
 */
function addEllipsoidSurfaceEdge(
  points: number[],
  indices: number[],
  a: number,
  b: number,
  c: number,
  p1: number[],
  p2: number[],
  segmentsOverride?: number
) {
  const va = new THREE.Vector3(p1[0] / a, p1[1] / c, p1[2] / b).normalize()
  const vb = new THREE.Vector3(p2[0] / a, p2[1] / c, p2[2] / b).normalize()
  let dot = va.dot(vb)
  dot = Math.max(-1, Math.min(1, dot))
  const omega = Math.acos(dot)
  const sinOmega = Math.sin(omega)
  const nSeg =
    segmentsOverride ??
    Math.max(6, Math.min(48, Math.ceil((omega / Math.PI) * 24)))

  let prev = new THREE.Vector3(p1[0], p1[1], p1[2])
  for (let i = 1; i <= nSeg; i++) {
    const t = i / nSeg
    let u: THREE.Vector3
    if (sinOmega < 1e-6) {
      u = va.clone().lerp(vb, t).normalize()
    } else {
      const w1 = Math.sin((1 - t) * omega) / sinOmega
      const w2 = Math.sin(t * omega) / sinOmega
      u = va.clone().multiplyScalar(w1).add(vb.clone().multiplyScalar(w2)).normalize()
    }
    const curr = new THREE.Vector3(a * u.x, c * u.y, b * u.z)
    pushLine(points, indices, [prev.x, prev.y, prev.z], [curr.x, curr.y, curr.z])
    prev = curr
  }
}

function addTriangleWireOnEllipsoidSurface(
  points: number[],
  indices: number[],
  a: number,
  b: number,
  c: number,
  p1: number[],
  p2: number[],
  p3: number[]
) {
  addEllipsoidSurfaceEdge(points, indices, a, b, c, p1, p2)
  addEllipsoidSurfaceEdge(points, indices, a, b, c, p2, p3)
  addEllipsoidSurfaceEdge(points, indices, a, b, c, p3, p1)
}

function addPentagonWireOnEllipsoidSurface(
  points: number[],
  indices: number[],
  a: number,
  b: number,
  c: number,
  center: number[],
  corner1: number[],
  corner2: number[],
  corner3: number[],
  corner4: number[]
) {
  addEllipsoidSurfaceEdge(points, indices, a, b, c, corner1, corner2)
  addEllipsoidSurfaceEdge(points, indices, a, b, c, corner2, corner3)
  addEllipsoidSurfaceEdge(points, indices, a, b, c, corner3, corner4)
  addEllipsoidSurfaceEdge(points, indices, a, b, c, corner4, corner1)
  addEllipsoidSurfaceEdge(points, indices, a, b, c, center, corner1)
  addEllipsoidSurfaceEdge(points, indices, a, b, c, center, corner2)
  addEllipsoidSurfaceEdge(points, indices, a, b, c, center, corner3)
  addEllipsoidSurfaceEdge(points, indices, a, b, c, center, corner4)
}

function hash01(i: number, j: number, seed: number) {
  const n = Math.sin(i * 127.1 + j * 311.7 + seed * 17.13) * 43758.5453123
  return n - Math.floor(n)
}

function pushLine(points: number[], indices: number[], a: number[], b: number[]) {
  points.push(...a, ...b)
  const idx = points.length / 3 - 2
  indices.push(idx, idx + 1)
}

function buildJitteredEllipsoidNodes(a: number, b: number, c: number, nTheta: number, nPhi: number, seed: number): number[][][] {
  const nodes: number[][][] = []
  const thetaStep = (Math.PI * 2) / nTheta
  const phiStep = Math.PI / nPhi
  const rowPhaseOffsets = Array.from({ length: nPhi + 1 }, (_, k) =>
    k > 0 && k < nPhi ? (hash01(k, seed, seed + 7) - 0.5) * 1.35 * thetaStep : 0
  )
  for (let k = 0; k <= nPhi; k++) {
    const row: number[][] = []
    const basePhi = (k / nPhi) * Math.PI
    for (let j = 0; j < nTheta; j++) {
      let theta = (j / nTheta) * Math.PI * 2
      let phi = basePhi
      if (k > 0 && k < nPhi) {
        theta += rowPhaseOffsets[k]
        theta += (hash01(j, k, seed) - 0.5) * 0.42 * thetaStep
        theta += (hash01(j + k, k, seed + 3) - 0.5) * 0.14 * thetaStep * Math.sin(basePhi)
        phi += (hash01(k, j, seed + 1) - 0.5) * 0.28 * phiStep
        phi += (hash01(j, j + k, seed + 4) - 0.5) * 0.1 * phiStep
        phi = Math.max(1e-4, Math.min(Math.PI - 1e-4, phi))
      }
      row.push(ellipsoidSurfacePoint(a, b, c, theta, phi))
    }
    nodes.push(row)
  }
  return nodes
}

export function createEllipsoidWireframe(
  a: number,
  b: number,
  c: number,
  counts: any,
  isTetra: boolean,
  isPoly: boolean,
  lineRadiusBoost = 1,
  unstructuredTetra = false,
  unstructuredPoly = false
): THREE.BufferGeometry {
  const { nx, nz } = surfaceAngularMeshCountsFromXYZ(counts)
  const points: number[] = []
  const indices: number[] = []

  if (isTetra && unstructuredTetra) {
    const nTheta = nx * 2
    const nPhi = nz * 2
    const nodes = buildJitteredEllipsoidNodes(a, b, c, nTheta, nPhi, 91)
    for (let j = 0; j < nTheta; j++) {
      const j2 = (j + 1) % nTheta
      for (let k = 0; k < nPhi; k++) {
        const p1 = nodes[k][j]
        const p2 = nodes[k][j2]
        const p3 = nodes[k + 1][j]
        const p4 = nodes[k + 1][j2]
        if (hash01(j, k, 92) > 0.5) {
          addTriangleWireOnEllipsoidSurface(points, indices, a, b, c, p1, p2, p4)
          addTriangleWireOnEllipsoidSurface(points, indices, a, b, c, p1, p4, p3)
        } else {
          addTriangleWireOnEllipsoidSurface(points, indices, a, b, c, p1, p2, p3)
          addTriangleWireOnEllipsoidSurface(points, indices, a, b, c, p2, p4, p3)
        }
      }
    }
  } else if (isPoly && unstructuredPoly) {
    const nTheta = nx * 2
    const nPhi = nz * 2
    addHexTilingOnRectSurface(points, indices, {
      uMin: 0,
      uMax: Math.PI * 2,
      vMin: 0,
      vMax: Math.PI,
      cols: Math.max(3, Math.floor(nTheta / 2)),
      rows: Math.max(3, Math.floor(nPhi / 1.5)),
      seed: 101,
      wrapU: true,
      edgeSubdivisions: 8,
      mapPoint: (theta, phi) => ellipsoidSurfacePoint(a, b, c, theta, phi) as [number, number, number],
    })
  } else if (isTetra) {
    const nTheta = nx * 2
    const nPhi = nz * 2
    for (let j = 0; j < nTheta; j++) {
      const theta1 = (j / nTheta) * Math.PI * 2
      const theta2 = ((j + 1) / nTheta) * Math.PI * 2
      for (let k = 0; k < nPhi; k++) {
        const phi1 = (k / nPhi) * Math.PI
        const phi2 = ((k + 1) / nPhi) * Math.PI

        const p1 = ellipsoidSurfacePoint(a, b, c, theta1, phi1)
        const p2 = ellipsoidSurfacePoint(a, b, c, theta2, phi1)
        const p3 = ellipsoidSurfacePoint(a, b, c, theta1, phi2)
        const p4 = ellipsoidSurfacePoint(a, b, c, theta2, phi2)
        addTriangleWireOnEllipsoidSurface(points, indices, a, b, c, p1, p2, p3)
        addTriangleWireOnEllipsoidSurface(points, indices, a, b, c, p2, p4, p3)
      }
    }
  } else if (isPoly) {
    const nTheta = nx * 2
    const nPhi = nz * 2
    for (let j = 0; j < nTheta; j++) {
      const theta1 = (j / nTheta) * Math.PI * 2
      const theta2 = ((j + 1) / nTheta) * Math.PI * 2
      const thetaCenter = (theta1 + theta2) / 2
      for (let k = 0; k < nPhi; k++) {
        const phi1 = (k / nPhi) * Math.PI
        const phi2 = ((k + 1) / nPhi) * Math.PI
        const phiCenter = (phi1 + phi2) / 2
        const center = ellipsoidSurfacePoint(a, b, c, thetaCenter, phiCenter)
        const corners = [
          ellipsoidSurfacePoint(a, b, c, theta1, phi1),
          ellipsoidSurfacePoint(a, b, c, theta2, phi1),
          ellipsoidSurfacePoint(a, b, c, theta2, phi2),
          ellipsoidSurfacePoint(a, b, c, theta1, phi2),
        ]
        addPentagonWireOnEllipsoidSurface(points, indices, a, b, c, center, corners[0], corners[1], corners[2], corners[3])
      }
    }
  } else {
    const nTheta = nx * 2
    const nPhi = nz * 2
    for (let j = 0; j <= nTheta; j++) {
      const theta = (j / nTheta) * Math.PI * 2
      for (let k = 0; k < nPhi; k++) {
        const phi1 = (k / nPhi) * Math.PI
        const phi2 = ((k + 1) / nPhi) * Math.PI
        const p1 = ellipsoidSurfacePoint(a, b, c, theta, phi1)
        const p2 = ellipsoidSurfacePoint(a, b, c, theta, phi2)
        addEllipsoidSurfaceEdge(points, indices, a, b, c, p1, p2)
      }
    }
    for (let k = 0; k <= nPhi; k++) {
      const phi = (k / nPhi) * Math.PI
      for (let j = 0; j < nTheta; j++) {
        const theta1 = (j / nTheta) * Math.PI * 2
        const theta2 = ((j + 1) / nTheta) * Math.PI * 2
        const p1 = ellipsoidSurfacePoint(a, b, c, theta1, phi)
        const p2 = ellipsoidSurfacePoint(a, b, c, theta2, phi)
        addEllipsoidSurfaceEdge(points, indices, a, b, c, p1, p2)
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  geometry.setIndex(indices)
  inflateSphereWireframeRadial(geometry, lineRadiusBoost)
  return geometry
}
