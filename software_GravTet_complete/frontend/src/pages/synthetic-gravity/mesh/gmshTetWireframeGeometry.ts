import * as THREE from 'three'
import type { TetraMeshElement, TetraMeshNode } from '../../../services/api'

/** Max tets scanned when building a lightweight preview wireframe. */
const DEFAULT_MAX_PREVIEW_TETS = 8_000
/** Hard cap on line segments so very large meshes stay interactive. */
const MAX_PREVIEW_SEGMENTS = 48_000

/**
 * Geological (X, Y horizontal, Z depth) → Three.js scene coords.
 * Matches `Cube3DView`: geo Z → Three Y, geo Y → Three Z.
 */
export function geoToThreeCoords([gx, gy, gz]: [number, number, number]): [number, number, number] {
  return [gx, gz, gy]
}

function nodeCoords(node: TetraMeshNode): [number, number, number] {
  if (Array.isArray(node)) return [node[0], node[1], node[2]]
  return [node.x, node.y, node.z]
}

function tetIndices(el: TetraMeshElement): [number, number, number, number] {
  if (Array.isArray(el)) return [el[0], el[1], el[2], el[3]]
  return [el.i0, el.i1, el.i2, el.i3]
}

function faceKey(a: number, b: number, c: number): string {
  const sorted = [a, b, c].sort((x, y) => x - y)
  return `${sorted[0]},${sorted[1]},${sorted[2]}`
}

export type GmshWireframeOptions = {
  /** Draw only exterior/topographic faces (much cleaner than full volume wireframe). */
  boundaryOnly?: boolean
  maxTets?: number
}

/** Wireframe edges for a Gmsh tet mesh (subsampled, boundary-only by default). */
export function buildGmshTetWireframeGeometry(
  nodes: TetraMeshNode[],
  elements: TetraMeshElement[],
  options: GmshWireframeOptions = {},
): THREE.BufferGeometry | null {
  if (!nodes.length || !elements.length) return null

  const boundaryOnly = options.boundaryOnly ?? true
  const maxTets = options.maxTets ?? DEFAULT_MAX_PREVIEW_TETS
  const stride = Math.max(1, Math.ceil(elements.length / maxTets))

  const edgeSet = new Set<string>()
  const points: number[] = []
  let segmentCount = 0

  const addEdge = (a: number, b: number) => {
    if (segmentCount >= MAX_PREVIEW_SEGMENTS) return
    if (a === b) return
    const lo = a < b ? a : b
    const hi = a < b ? b : a
    const key = `${lo},${hi}`
    if (edgeSet.has(key)) return
    if (a < 0 || b < 0 || a >= nodes.length || b >= nodes.length) return
    edgeSet.add(key)
    const pa = geoToThreeCoords(nodeCoords(nodes[a]))
    const pb = geoToThreeCoords(nodeCoords(nodes[b]))
    points.push(pa[0], pa[1], pa[2], pb[0], pb[1], pb[2])
    segmentCount += 1
  }

  if (boundaryOnly) {
    const faceCount = new Map<string, number>()
    const faceVerts = new Map<string, [number, number, number]>()

    for (let i = 0; i < elements.length; i += stride) {
      const [i0, i1, i2, i3] = tetIndices(elements[i])
      const faces: [number, number, number][] = [
        [i0, i1, i2],
        [i0, i1, i3],
        [i0, i2, i3],
        [i1, i2, i3],
      ]
      for (const [a, b, c] of faces) {
        const key = faceKey(a, b, c)
        faceCount.set(key, (faceCount.get(key) ?? 0) + 1)
        faceVerts.set(key, [a, b, c])
      }
    }

    for (const [key, count] of faceCount) {
      if (count !== 1) continue
      const verts = faceVerts.get(key)
      if (!verts) continue
      const [a, b, c] = verts
      addEdge(a, b)
      addEdge(b, c)
      addEdge(c, a)
      if (segmentCount >= MAX_PREVIEW_SEGMENTS) break
    }
  } else {
    for (let i = 0; i < elements.length; i += stride) {
      const [i0, i1, i2, i3] = tetIndices(elements[i])
      addEdge(i0, i1)
      addEdge(i1, i2)
      addEdge(i2, i0)
      addEdge(i0, i3)
      addEdge(i1, i3)
      addEdge(i2, i3)
      if (segmentCount >= MAX_PREVIEW_SEGMENTS) break
    }
  }

  if (points.length === 0) return null
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  return geometry
}
