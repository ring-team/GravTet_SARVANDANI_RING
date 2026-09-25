/**
 * **Irregular hex / rect tiling on parametric surfaces** (used for unstructured poly previews on boxes, cylinders, ellipsoids).
 *
 * Builds wireframe edges on a mapped `(u,v)` grid with jitter, optional `wrapU`, and edge de-duplication.
 */
type Vec2 = [number, number]
type Vec3 = [number, number, number]

type Center2D = {
  u: number
  v: number
}

function pushLine(points: number[], indices: number[], a: Vec3, b: Vec3) {
  points.push(...a, ...b)
  const idx = points.length / 3 - 2
  indices.push(idx, idx + 1)
}

function edgeKey(a: Vec3, b: Vec3) {
  const q = (n: number) => Math.round(n * 1e4)
  const aKey = `${q(a[0])},${q(a[1])},${q(a[2])}`
  const bKey = `${q(b[0])},${q(b[1])},${q(b[2])}`
  return aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`
}

function pushLineUnique(points: number[], indices: number[], a: Vec3, b: Vec3, seenEdges: Set<string>) {
  const key = edgeKey(a, b)
  if (seenEdges.has(key)) return
  seenEdges.add(key)
  pushLine(points, indices, a, b)
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function wrapRange(value: number, min: number, max: number) {
  const span = max - min
  let wrapped = (value - min) % span
  if (wrapped < 0) wrapped += span
  return min + wrapped
}

function hash01(a: number, b: number, seed: number) {
  const n = Math.sin(a * 127.1 + b * 311.7 + seed * 17.13) * 43758.5453123
  return n - Math.floor(n)
}

function dedupePolygon(vertices: Vec2[]) {
  const result: Vec2[] = []
  for (const v of vertices) {
    const last = result[result.length - 1]
    if (!last || Math.hypot(last[0] - v[0], last[1] - v[1]) > 1e-9) {
      result.push(v)
    }
  }
  if (result.length > 1) {
    const first = result[0]
    const last = result[result.length - 1]
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-9) {
      result.pop()
    }
  }
  return result
}

function clipPolygonHalfPlane(
  polygon: Vec2[],
  inside: (p: Vec2) => boolean,
  intersect: (a: Vec2, b: Vec2) => Vec2
) {
  const output: Vec2[] = []
  if (polygon.length === 0) return output

  let prev = polygon[polygon.length - 1]
  let prevInside = inside(prev)

  for (const curr of polygon) {
    const currInside = inside(curr)
    if (currInside) {
      if (!prevInside) output.push(intersect(prev, curr))
      output.push(curr)
    } else if (prevInside) {
      output.push(intersect(prev, curr))
    }
    prev = curr
    prevInside = currInside
  }

  return dedupePolygon(output)
}

function clipPolygonToRect(
  polygon: Vec2[],
  uMin: number,
  uMax: number,
  vMin: number,
  vMax: number,
  clipU: boolean
) {
  let result = polygon
  if (clipU) {
    result = clipPolygonHalfPlane(
      result,
      ([u]) => u >= uMin,
      (a, b) => {
        const t = (uMin - a[0]) / (b[0] - a[0])
        return [uMin, a[1] + (b[1] - a[1]) * t]
      }
    )
    result = clipPolygonHalfPlane(
      result,
      ([u]) => u <= uMax,
      (a, b) => {
        const t = (uMax - a[0]) / (b[0] - a[0])
        return [uMax, a[1] + (b[1] - a[1]) * t]
      }
    )
  }

  result = clipPolygonHalfPlane(
    result,
    ([, v]) => v >= vMin,
    (a, b) => {
      const t = (vMin - a[1]) / (b[1] - a[1])
      return [a[0] + (b[0] - a[0]) * t, vMin]
    }
  )
  result = clipPolygonHalfPlane(
    result,
    ([, v]) => v <= vMax,
    (a, b) => {
      const t = (vMax - a[1]) / (b[1] - a[1])
      return [a[0] + (b[0] - a[0]) * t, vMax]
    }
  )

  return dedupePolygon(result)
}

function buildCirclePolygon(radius: number, segments = 48): Vec2[] {
  const polygon: Vec2[] = []
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * Math.PI * 2
    polygon.push([radius * Math.cos(theta), radius * Math.sin(theta)])
  }
  return polygon
}

function centerJittered(
  u: number,
  v: number,
  jitterU: number,
  jitterV: number,
  seed: number,
  i: number,
  j: number
): Center2D {
  return [
    u + (hash01(i, j, seed) - 0.5) * jitterU,
    v + (hash01(j, i, seed + 37) - 0.5) * jitterV,
  ] as unknown as Center2D
}

function buildVoronoiCell(
  center: Center2D,
  neighbors: Center2D[],
  initialPolygon: Vec2[]
) {
  let polygon = initialPolygon
  for (const neighbor of neighbors) {
    const nx = neighbor.u - center.u
    const ny = neighbor.v - center.v
    if (Math.hypot(nx, ny) < 1e-9) continue
    const mx = (center.u + neighbor.u) / 2
    const my = (center.v + neighbor.v) / 2
    polygon = clipPolygonHalfPlane(
      polygon,
      ([u, v]) => (u - mx) * nx + (v - my) * ny <= 1e-9,
      (a, b) => {
        const dax = b[0] - a[0]
        const day = b[1] - a[1]
        const denom = dax * nx + day * ny
        if (Math.abs(denom) < 1e-12) return a
        const t = -((a[0] - mx) * nx + (a[1] - my) * ny) / denom
        return [a[0] + dax * t, a[1] + day * t]
      }
    )
    if (polygon.length < 3) break
  }
  return dedupePolygon(polygon)
}

function addMappedEdge(
  points: number[],
  indices: number[],
  a: Vec2,
  b: Vec2,
  mapPoint: (u: number, v: number) => Vec3,
  edgeSubdivisions: number,
  wrapU: boolean,
  uMin: number,
  uMax: number,
  seenEdges: Set<string>
) {
  const segments = Math.max(1, edgeSubdivisions)
  const span = uMax - uMin
  let [u1, v1] = a
  let [u2, v2] = b

  if (wrapU) {
    const diff = u2 - u1
    if (diff > span / 2) u2 -= span
    if (diff < -span / 2) u2 += span
  }

  let prev = mapPoint(wrapU ? wrapRange(u1, uMin, uMax) : clamp(u1, uMin, uMax), v1)
  for (let i = 1; i <= segments; i++) {
    const t = i / segments
    const u = u1 + (u2 - u1) * t
    const v = v1 + (v2 - v1) * t
    const curr = mapPoint(wrapU ? wrapRange(u, uMin, uMax) : clamp(u, uMin, uMax), v)
    pushLineUnique(points, indices, prev, curr, seenEdges)
    prev = curr
  }
}

export function addHexTilingOnRectSurface(
  points: number[],
  indices: number[],
  {
    uMin,
    uMax,
    vMin,
    vMax,
    cols,
    rows,
    seed,
    wrapU = false,
    edgeSubdivisions = 1,
    mapPoint,
  }: {
    uMin: number
    uMax: number
    vMin: number
    vMax: number
    cols: number
    rows: number
    seed: number
    wrapU?: boolean
    edgeSubdivisions?: number
    mapPoint: (u: number, v: number) => Vec3
  }
) {
  const spanU = uMax - uMin
  const du = spanU / Math.max(1, cols)
  const dv = (vMax - vMin) / Math.max(1, rows)
  const centers: Center2D[] = []
  const seenEdges = new Set<string>()

  for (let row = 0; row < rows; row++) {
    const baseV = vMin + (row + 0.5) * dv
    for (let col = 0; col < cols; col++) {
      const baseU = uMin + (col + 0.5 + (row % 2) * 0.5) * du
      const jitter = centerJittered(baseU, baseV, du * 0.38, dv * 0.34, seed, col, row)
      centers.push({ u: wrapU ? wrapRange(jitter[0], uMin, uMax) : clamp(jitter[0], uMin, uMax), v: clamp(jitter[1], vMin, vMax) })
    }
  }

  for (const center of centers) {
    const initialPolygon: Vec2[] = wrapU
      ? [
          [center.u - du * 2.5, vMin],
          [center.u + du * 2.5, vMin],
          [center.u + du * 2.5, vMax],
          [center.u - du * 2.5, vMax],
        ]
      : [
          [uMin, vMin],
          [uMax, vMin],
          [uMax, vMax],
          [uMin, vMax],
        ]

    const neighbors = centers
      .filter((candidate) => candidate !== center)
      .map((candidate) => {
        if (!wrapU) return candidate
        let u = candidate.u
        const diff = u - center.u
        if (diff > spanU / 2) u -= spanU
        if (diff < -spanU / 2) u += spanU
        return { u, v: candidate.v }
      })
      .filter((candidate) => Math.hypot(candidate.u - center.u, candidate.v - center.v) < Math.max(du, dv) * 4.5)

    const polygon = buildVoronoiCell(center, neighbors, initialPolygon)
    if (polygon.length < 3) continue

    const clipped = wrapU
      ? clipPolygonToRect(polygon, center.u - du * 2.5, center.u + du * 2.5, vMin, vMax, false)
      : clipPolygonToRect(polygon, uMin, uMax, vMin, vMax, true)

    if (clipped.length < 3) continue

    for (let i = 0; i < clipped.length; i++) {
      addMappedEdge(
        points,
        indices,
        clipped[i],
        clipped[(i + 1) % clipped.length],
        mapPoint,
        edgeSubdivisions,
        wrapU,
        uMin,
        uMax,
        seenEdges
      )
    }
  }
}

function warpSharedVertex2D(
  u: number,
  v: number,
  du: number,
  dv: number,
  seed: number,
  wrapU: boolean,
  uMin: number,
  uMax: number
): Vec2 {
  const cu = wrapU ? wrapRange(u, uMin, uMax) : u
  const n1 = Math.sin(cu * 12.9898 + v * 78.233 + seed * 17.13)
  const n2 = Math.sin(cu * 39.3467 - v * 11.135 + seed * 23.71)
  return [u + n1 * du, v + n2 * dv]
}

export function addWarpedHoneycombOnRectSurface(
  points: number[],
  indices: number[],
  {
    uMin,
    uMax,
    vMin,
    vMax,
    cols,
    rows,
    seed,
    wrapU = false,
    warp = 0.04,
    edgeSubdivisions = 1,
    mapPoint,
  }: {
    uMin: number
    uMax: number
    vMin: number
    vMax: number
    cols: number
    rows: number
    seed: number
    wrapU?: boolean
    warp?: number
    edgeSubdivisions?: number
    mapPoint: (u: number, v: number) => Vec3
  }
) {
  const ru = wrapU ? (uMax - uMin) / (2 * cols) : (uMax - uMin) / (2 * cols + 1)
  const rv = (vMax - vMin) / (1.5 * rows + 0.5)
  const warpUAmt = ru * warp
  const warpVAmt = rv * warp
  const offsets: Vec2[] = [
    [0, -rv],
    [ru, -rv / 2],
    [ru, rv / 2],
    [0, rv],
    [-ru, rv / 2],
    [-ru, -rv / 2],
  ]
  const seenEdges = new Set<string>()

  for (let row = 0; row < rows; row++) {
    const cv = vMin + rv + row * 1.5 * rv
    for (let col = 0; col < cols; col++) {
      const cu = uMin + ru + col * 2 * ru + (row % 2) * ru
      const polygon = offsets.map(([du, dv]) =>
        warpSharedVertex2D(cu + du, cv + dv, warpUAmt, warpVAmt, seed, wrapU, uMin, uMax)
      )
      const clipped = clipPolygonToRect(polygon, uMin, uMax, vMin, vMax, !wrapU)
      if (clipped.length < 3) continue
      for (let i = 0; i < clipped.length; i++) {
        addMappedEdge(
          points,
          indices,
          clipped[i],
          clipped[(i + 1) % clipped.length],
          mapPoint,
          edgeSubdivisions,
          wrapU,
          uMin,
          uMax,
          seenEdges
        )
      }
    }
  }
}

export function addHexTilingOnDiskSurface(
  points: number[],
  indices: number[],
  {
    radius,
    rows,
    seed,
    mapPoint,
  }: {
    radius: number
    rows: number
    seed: number
    mapPoint: (x: number, z: number) => Vec3
  }
) {
  const dv = (2 * radius) / Math.max(1, rows)
  const du = dv * 0.95
  const cols = Math.max(3, Math.ceil((2 * radius) / du) + 2)
  const centers: Center2D[] = []
  const seenEdges = new Set<string>()
  const diskPolygon = buildCirclePolygon(radius, 56)

  for (let row = 0; row < rows; row++) {
    const baseV = -radius + (row + 0.5) * dv
    for (let col = 0; col < cols; col++) {
      const baseU = -radius + (col + 0.5 + (row % 2) * 0.5) * du
      const jitter = centerJittered(baseU, baseV, du * 0.34, dv * 0.3, seed, col, row)
      if (Math.hypot(jitter[0], jitter[1]) <= radius + du) {
        centers.push({ u: jitter[0], v: jitter[1] })
      }
    }
  }

  for (const center of centers) {
    const neighbors = centers
      .filter((candidate) => candidate !== center)
      .filter((candidate) => Math.hypot(candidate.u - center.u, candidate.v - center.v) < Math.max(du, dv) * 4.5)

    const polygon = buildVoronoiCell(center, neighbors, diskPolygon)
    if (polygon.length < 3) continue

    const mapped = polygon.map(([x, z]) => mapPoint(x, z))
    for (let i = 0; i < mapped.length; i++) {
      pushLineUnique(points, indices, mapped[i], mapped[(i + 1) % mapped.length], seenEdges)
    }
  }
}

export function addWarpedHoneycombOnDiskSurface(
  points: number[],
  indices: number[],
  {
    radius,
    rows,
    seed,
    warp = 0.035,
    mapPoint,
  }: {
    radius: number
    rows: number
    seed: number
    warp?: number
    mapPoint: (x: number, z: number) => Vec3
  }
) {
  const rv = (2 * radius) / (1.5 * rows + 0.5)
  const ru = rv * 0.8660254037844386
  const warpX = ru * warp
  const warpZ = rv * warp
  const cols = Math.max(3, Math.ceil((2 * radius) / (2 * ru)) + 2)
  const seenEdges = new Set<string>()
  const offsets: Vec2[] = [
    [0, -rv],
    [ru, -rv / 2],
    [ru, rv / 2],
    [0, rv],
    [-ru, rv / 2],
    [-ru, -rv / 2],
  ]

  for (let row = 0; row < rows; row++) {
    const cz = -radius + rv + row * 1.5 * rv
    for (let col = 0; col < cols; col++) {
      const cx = -radius + ru + col * 2 * ru + (row % 2) * ru
      if (Math.hypot(cx, cz) > radius + 1.5 * ru) continue

      const polygon = offsets.map(([dx, dz]) => {
        let [x, z] = warpSharedVertex2D(cx + dx, cz + dz, warpX, warpZ, seed, false, -radius, radius)
        const r = Math.hypot(x, z)
        if (r > radius) {
          x = (x / r) * radius
          z = (z / r) * radius
        }
        return [x, z] as Vec2
      })

      const deduped = dedupePolygon(polygon)
      if (deduped.length < 3) continue
      const mapped = deduped.map(([x, z]) => mapPoint(x, z))
      for (let i = 0; i < mapped.length; i++) {
        pushLineUnique(points, indices, mapped[i], mapped[(i + 1) % mapped.length], seenEdges)
      }
    }
  }
}
