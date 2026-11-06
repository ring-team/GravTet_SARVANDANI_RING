/**
 * Initial-model gravity helpers: `types.ts`.
 */

export type InitialModelPrimitiveType = 'box'

export type InitialModelPrimitive = {
  id: string
  type: InitialModelPrimitiveType
  density: number
  centerX: number
  centerY: number
  centerZ: number
  sizeX: number
  sizeY: number
  sizeZ: number
}

export type InitialModel = {
  units: { length: 'm' }
  primitives: InitialModelPrimitive[]
}

export type InitialModelMode = 'union' | 'layers'

export type Bounds = {
  target: [number, number, number]
  radius: number
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
}

/** Regular grid imported from spreadsheet (x, y, depth z, anomaly value). */
export type ImportedField = {
  xs: number[]
  ys: number[]
  zGrid: number[][]
  valueGrid: number[][]
}

export type LayerDef = {
  id: string
  topDepth: number
  thickness: number
  density: number
  tiltX: number
  tiltY: number
  extentX: number
  extentY: number
  gridN: number
  curvAmp: number
  curvSigma: number
}
