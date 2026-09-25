/**
 * Sphere wireframe: structured hexa/tetra/poly discretization of a ball for synthetic gravity previews.
 *
 * Uses shared `meshUtils` face builders and optional radial inflation to separate lines from solid meshes.
 */
import * as THREE from 'three'
import {
  addPentagon,
  addTriangle,
  inflateSphereWireframeRadial,
  sphericalToCartesian,
  surfaceAngularMeshCountsFromXYZ,
} from './meshUtils'
import { addHexTilingOnRectSurface } from './polySurfaceTiling'

function hash01(i: number, j: number, seed: number) {
  const n = Math.sin(i * 127.1 + j * 311.7 + seed * 17.13) * 43758.5453123
  return n - Math.floor(n)
}

function pushLine(points: number[], indices: number[], a: number[], b: number[]) {
  points.push(...a, ...b)
  const idx = points.length / 3 - 2
  indices.push(idx, idx + 1)
}

function addSphereSurfaceEdge(
  points: number[],
  indices: number[],
  radius: number,
  a: number[],
  b: number[],
  segments = 6
) {
  const va = new THREE.Vector3(a[0], a[1], a[2]).normalize()
  const vb = new THREE.Vector3(b[0], b[1], b[2]).normalize()
  let prev = va.clone().multiplyScalar(radius)
  let dot = va.dot(vb)
  dot = Math.max(-1, Math.min(1, dot))
  const omega = Math.acos(dot)
  const sinOmega = Math.sin(omega)

  for (let i = 1; i <= segments; i++) {
    const t = i / segments
    let curr: THREE.Vector3
    if (sinOmega < 1e-6) {
      curr = va.clone().lerp(vb, t).normalize().multiplyScalar(radius)
    } else {
      const w1 = Math.sin((1 - t) * omega) / sinOmega
      const w2 = Math.sin(t * omega) / sinOmega
      curr = va.clone().multiplyScalar(w1).add(vb.clone().multiplyScalar(w2)).normalize().multiplyScalar(radius)
    }
    pushLine(points, indices, [prev.x, prev.y, prev.z], [curr.x, curr.y, curr.z])
    prev = curr
  }
}

function addTriangleWireOnSphereSurface(
  points: number[],
  indices: number[],
  radius: number,
  p1: number[],
  p2: number[],
  p3: number[]
) {
  addSphereSurfaceEdge(points, indices, radius, p1, p2)
  addSphereSurfaceEdge(points, indices, radius, p2, p3)
  addSphereSurfaceEdge(points, indices, radius, p3, p1)
}

function buildJitteredSphereNodes(radius: number, nTheta: number, nPhi: number, seed: number): number[][][] {
  const nodes: number[][][] = []
  const thetaStep = (Math.PI * 2) / nTheta
  const phiStep = Math.PI / nPhi
  const rowPhaseOffsets = Array.from({ length: nPhi + 1 }, (_, k) =>
    k > 0 && k < nPhi ? (hash01(k, seed, seed + 7) - 0.5) * 1.55 * thetaStep : 0
  )

  for (let k = 0; k <= nPhi; k++) {
    const row: number[][] = []
    const basePhi = (k / nPhi) * Math.PI
    for (let j = 0; j < nTheta; j++) {
      let theta = (j / nTheta) * Math.PI * 2
      let phi = basePhi
      if (k > 0 && k < nPhi) {
        theta += rowPhaseOffsets[k]
        theta += (hash01(j, k, seed) - 0.5) * 0.5 * thetaStep
        theta += (hash01(j + k, k, seed + 3) - 0.5) * 0.18 * thetaStep * Math.sin(basePhi)
        phi += (hash01(k, j, seed + 1) - 0.5) * 0.34 * phiStep
        phi += (hash01(j, j + k, seed + 4) - 0.5) * 0.14 * phiStep
        phi = Math.max(1e-4, Math.min(Math.PI - 1e-4, phi))
      }
      row.push(sphericalToCartesian(radius, theta, phi))
    }
    nodes.push(row)
  }

  return nodes
}

export function createSphereWireframe(
  radius: number,
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
    const nTheta = nx * 3
    const nPhi = nz * 3
    const nodes = buildJitteredSphereNodes(radius, nTheta, nPhi, 71)
    for (let j = 0; j < nTheta; j++) {
      const j2 = (j + 1) % nTheta
      for (let k = 0; k < nPhi; k++) {
        const p1 = nodes[k][j]
        const p2 = nodes[k][j2]
        const p3 = nodes[k + 1][j]
        const p4 = nodes[k + 1][j2]
        if (hash01(j, k, 72) > 0.5) {
          addTriangleWireOnSphereSurface(points, indices, radius, p1, p2, p4)
          addTriangleWireOnSphereSurface(points, indices, radius, p1, p4, p3)
        } else {
          addTriangleWireOnSphereSurface(points, indices, radius, p1, p2, p3)
          addTriangleWireOnSphereSurface(points, indices, radius, p2, p4, p3)
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
      cols: Math.max(4, nTheta),
      rows: Math.max(4, Math.floor(nPhi * 1.35)),
      seed: 101,
      wrapU: true,
      edgeSubdivisions: 8,
      mapPoint: (theta, phi) => sphericalToCartesian(radius, theta, phi) as [number, number, number],
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
        const p1 = sphericalToCartesian(radius, theta1, phi1)
        const p2 = sphericalToCartesian(radius, theta2, phi1)
        const p3 = sphericalToCartesian(radius, theta1, phi2)
        const p4 = sphericalToCartesian(radius, theta2, phi2)
        addTriangle(points, indices, p1, p2, p3)
        addTriangle(points, indices, p2, p4, p3)
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
        const center = sphericalToCartesian(radius, thetaCenter, phiCenter)
        const corners = [
          sphericalToCartesian(radius, theta1, phi1),
          sphericalToCartesian(radius, theta2, phi1),
          sphericalToCartesian(radius, theta2, phi2),
          sphericalToCartesian(radius, theta1, phi2),
        ]
        addPentagon(points, indices, center, corners[0], corners[1], corners[2], corners[3])
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
        const p1 = sphericalToCartesian(radius, theta, phi1)
        const p2 = sphericalToCartesian(radius, theta, phi2)
        points.push(...p1, ...p2)
        const idx = points.length / 3 - 2
        indices.push(idx, idx + 1)
      }
    }
    for (let k = 0; k <= nPhi; k++) {
      const phi = (k / nPhi) * Math.PI
      for (let j = 0; j < nTheta; j++) {
        const theta1 = (j / nTheta) * Math.PI * 2
        const theta2 = ((j + 1) / nTheta) * Math.PI * 2
        const p1 = sphericalToCartesian(radius, theta1, phi)
        const p2 = sphericalToCartesian(radius, theta2, phi)
        points.push(...p1, ...p2)
        const idx = points.length / 3 - 2
        indices.push(idx, idx + 1)
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  geometry.setIndex(indices)
  inflateSphereWireframeRadial(geometry, lineRadiusBoost)
  return geometry
}
