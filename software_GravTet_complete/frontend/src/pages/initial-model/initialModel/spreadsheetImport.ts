/**
 * Initial-model gravity helpers: `spreadsheetImport.ts`.
 */

import * as XLSX from 'xlsx'
import type { ImportedField, InitialModel, InitialModelPrimitive } from './types'
import { uid } from './math'

function uniqSorted(arr: number[]) {
  const r = arr.map((v) => Math.round(v * 1e6) / 1e6)
  return Array.from(new Set(r)).sort((a, b) => a - b)
}

function median(arr: number[]) {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function stepFrom(arr: number[]) {
  const uniq = uniqSorted(arr)
  if (uniq.length < 2) return 1
  const diffs: number[] = []
  for (let i = 1; i < uniq.length; i++) {
    const d = uniq[i] - uniq[i - 1]
    if (d > 0 && Number.isFinite(d)) diffs.push(d)
  }
  if (diffs.length === 0) return 1
  const s = median(diffs)
  if (!Number.isFinite(s) || s <= 0) return 1
  return s
}

function buildRegularGrid(pts: Array<{ x: number; y: number; z: number; value: number }>): ImportedField | null {
  const roundKey = (n: number) => Math.round(n * 1e6) / 1e6
  const xs = Array.from(new Set(pts.map((p) => roundKey(p.x)))).sort((a, b) => a - b)
  const ys = Array.from(new Set(pts.map((p) => roundKey(p.y)))).sort((a, b) => a - b)
  if (xs.length < 2 || ys.length < 2) return null

  const nx = xs.length
  const ny = ys.length
  const indexOfX = new Map<number, number>(xs.map((v, i) => [v, i]))
  const indexOfY = new Map<number, number>(ys.map((v, i) => [v, i]))

  const zGrid: number[][] = Array.from({ length: ny }, () => Array.from({ length: nx }, () => NaN))
  const valueGrid: number[][] = Array.from({ length: ny }, () => Array.from({ length: nx }, () => NaN))

  for (const p of pts) {
    const ix = indexOfX.get(roundKey(p.x))
    const iy = indexOfY.get(roundKey(p.y))
    if (ix === undefined || iy === undefined) continue
    zGrid[iy][ix] = p.z
    valueGrid[iy][ix] = p.value
  }

  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      if (!Number.isFinite(zGrid[iy][ix]) || !Number.isFinite(valueGrid[iy][ix])) return null
    }
  }

  return { xs, ys, zGrid, valueGrid }
}

export type SpreadsheetImportResult = {
  inferredGrid: ImportedField | null
  model: InitialModel
  stats: { count: number; min: number; max: number }
}

export async function importInitialModelFromSpreadsheet(file: File): Promise<SpreadsheetImportResult> {
  const ext = file.name.toLowerCase().split('.').pop()
  const workbook =
    ext === 'csv' || ext === 'txt'
      ? XLSX.read(await file.text(), { type: 'string' })
      : XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const firstSheet = workbook.SheetNames[0]
  if (!firstSheet) throw new Error('No sheets found in the file.')
  const sheet = workbook.Sheets[firstSheet]

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]
  if (!rows || rows.length < 2) throw new Error('Spreadsheet is empty or missing data rows.')

  const canon = (s: unknown) =>
    String(s ?? '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '')

  const headerRow = rows[0] ?? []
  const normHeaders = headerRow.map(canon)

  const findIndexByCandidates = (candidates: string[]) => {
    for (const cand of candidates) {
      const c = canon(cand)
      const idx = normHeaders.findIndex((h) => h === c || h.includes(c))
      if (idx !== -1) return idx
    }
    return -1
  }

  let xIdx = findIndexByCandidates(['x', 'x(m)', 'xcoord', 'xcoordinate'])
  let yIdx = findIndexByCandidates(['y', 'y(m)', 'ycoord', 'ycoordinate'])
  let zIdx = findIndexByCandidates(['z', 'z(m)', 'zcoord', 'zcoordinate', 'depth', 'depthz'])
  let vIdx = findIndexByCandidates(['value', 'gravity', 'g', 'rho', 'density', 'val'])
  let startRow = 1

  const hasHeaderMapping = xIdx !== -1 && yIdx !== -1 && zIdx !== -1 && vIdx !== -1
  if (!hasHeaderMapping) {
    xIdx = 0
    yIdx = 1
    zIdx = 2
    vIdx = 3
    startRow = 0
  }

  const points: Array<{ x: number; y: number; z: number; value: number }> = []
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length === 0) continue

    const rawX = row[xIdx]
    const rawY = row[yIdx]
    const rawZ = row[zIdx]
    const rawV = row[vIdx]

    const x = typeof rawX === 'number' ? rawX : parseFloat(String(rawX))
    const y = typeof rawY === 'number' ? rawY : parseFloat(String(rawY))
    const z = typeof rawZ === 'number' ? rawZ : parseFloat(String(rawZ))
    const value = typeof rawV === 'number' ? rawV : parseFloat(String(rawV))

    if (![x, y, z, value].every((n) => Number.isFinite(n))) continue
    points.push({ x, y, z, value })
  }

  if (points.length === 0) throw new Error('Could not find any valid numeric rows (x,y,z,value).')

  const inferredGrid = buildRegularGrid(points)

  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const zs = points.map((p) => p.z)

  const stepX = stepFrom(xs)
  const stepY = stepFrom(ys)
  const stepZ = stepFrom(zs)

  const sizeX = Math.max(1, stepX * 0.9)
  const sizeY = Math.max(1, stepY * 0.9)

  const zRange = Math.max(...zs) - Math.min(...zs)
  const base = Math.max(sizeX, sizeY)
  const thicknessMin = Math.max(2, base * 0.15)
  const thicknessFromZ = zRange > 0 ? Math.min(120, zRange * 0.9) : base * 0.6
  const thicknessMax = Math.max(thicknessMin + 5, thicknessMin + thicknessFromZ)

  const maxPoints = 20000
  const sampled =
    points.length > maxPoints ? points.filter((_, idx) => idx % Math.ceil(points.length / maxPoints) === 0) : points

  const minV = Math.min(...sampled.map((p) => p.value))
  const maxV = Math.max(...sampled.map((p) => p.value))

  const primitives: InitialModelPrimitive[] = sampled.map((p, idx) => {
    const norm = maxV === minV ? 0.5 : (p.value - minV) / (maxV - minV)
    const n = Math.max(0, Math.min(1, norm))
    const thickness = thicknessMin + n * (thicknessMax - thicknessMin)
    const centerZ = -(p.z + thickness / 2)
    const density = 500 + n * 2500

    return {
      id: `xl-${idx}`,
      type: 'box' as const,
      density,
      centerX: p.x,
      centerY: p.y,
      centerZ,
      sizeX,
      sizeY,
      sizeZ: thickness,
    }
  })

  const model: InitialModel = { units: { length: 'm' }, primitives }

  return {
    inferredGrid,
    model,
    stats: { count: primitives.length, min: minV, max: maxV },
  }
}
