/**
 * Shared gravity results display for all forward methods: Direct Newton, Barnes–Hut,
 * AMFM, quadrature. Renders stats + gravity map with configurable titles.
 * Optional edge enhancement modes via custom Display dropdown (always opens below).
 */
import { useState, useMemo, useRef, useEffect } from 'react'
import type { GravityStatsFromFullGrid } from '../../../services/api'
import { GravityMapView, type SurfaceBounds } from './GravityMapView'
import { verticalDerivative2D, upwardContinuation2D, downwardContinuation2D } from '../lib/fft2d'
import { safeMin, safeMax, safeMean } from '../lib/gravityArrayStats'
import type { GravityMapExtent } from '../lib/forwardGravityMapExtent'
import './GravityResultsView.css'

/** One-line summary of backend `solver_meta` for Barnes–Hut / AMFM confirmation. */
function formatSolverMetaLine(meta: Record<string, unknown>): string {
  const eng = meta.engine
  if (eng === 'barnes_hut') {
    const tr = meta.theta0_requested
    const te = meta.theta0_effective
    const prism = meta.prism_tuning === true
    return `Barnes–Hut: θ ${String(tr)} → ${String(te)}${prism ? ' (prism cap)' : ''}`
  }
  if (eng === 'amfm') {
    return (
      `AMFM: cd ${String(meta.critical_distance_requested)}→${String(meta.critical_distance_effective)}, ` +
      `depth ${String(meta.max_depth_requested)}→${String(meta.max_depth_effective)}, ` +
      `msn ${String(meta.max_sources_per_node_requested)}→${String(meta.max_sources_per_node_effective)}`
    )
  }
  return ''
}

// --- Display mode (dropdown) + FFT / derivative pipelines ---

export type EdgeEnhancementMode =
  | 'gravity'
  | 'upwardContinuation'
  | 'upwardLaplacian'
  | 'downwardContinuation'
  | 'downwardLaplacian'
  | 'downwardGradient'
  | 'horizontalGradient'
  | 'thdrOfTilt'
  | 'nthd'
  | 'laplacian'
  | 'tilt'
  | 'analyticSignal'
  | 'gradientAngle'
  | 'dgdx'
  | 'dgdy'

const DISPLAY_OPTIONS: { value: EdgeEnhancementMode; label: string }[] = [
  { value: 'gravity', label: 'Gravity (mGal)' },
  { value: 'upwardContinuation', label: 'Upward continuation' },
  { value: 'upwardLaplacian', label: 'Upward + Laplacian' },
  { value: 'downwardContinuation', label: 'Downward continuation' },
  { value: 'downwardLaplacian', label: 'Downward + Laplacian' },
  { value: 'downwardGradient', label: 'Downward + horizontal gradient' },
  { value: 'laplacian', label: 'Laplacian (∇²g)' },
  { value: 'analyticSignal', label: 'Analytic signal (AS)' },
  { value: 'tilt', label: 'Tilt derivative (TDR)' },
  { value: 'thdrOfTilt', label: 'THDR of tilt (edge/depth)' },
  { value: 'nthd', label: 'Normalized THDR (NTHD)' },
  { value: 'horizontalGradient', label: 'Horizontal gradient (THDR)' },
  { value: 'gradientAngle', label: 'Gradient angle' },
  { value: 'dgdx', label: 'dG/dx (∂g/∂x)' },
  { value: 'dgdy', label: 'dG/dy (∂g/∂y)' },
]

// --- 1D-layout grid helpers (derivatives, TDR, THDR, etc.) ---

const get = (data: number[], numY: number, i: number, j: number) => data[i * numY + j]

/** Horizontal gradient magnitude (THDR): sqrt((dg/dx)^2 + (dg/dy)^2). */
function gradientMagnitude1D(data: number[], numX: number, numY: number): number[] {
  if (numX < 2 || numY < 2 || data.length !== numX * numY) return data.slice()
  const out: number[] = new Array(data.length)
  for (let i = 0; i < numX; i++) {
    for (let j = 0; j < numY; j++) {
      const dx = i === 0 ? get(data, numY, 1, j) - get(data, numY, 0, j) : i === numX - 1 ? get(data, numY, numX - 1, j) - get(data, numY, numX - 2, j) : (get(data, numY, i + 1, j) - get(data, numY, i - 1, j)) / 2
      const dy = j === 0 ? get(data, numY, i, 1) - get(data, numY, i, 0) : j === numY - 1 ? get(data, numY, i, numY - 1) - get(data, numY, i, numY - 2) : (get(data, numY, i, j + 1) - get(data, numY, i, j - 1)) / 2
      out[i * numY + j] = Math.sqrt(dx * dx + dy * dy)
    }
  }
  return out
}

/** Laplacian: d2g/dx2 + d2g/dy2 (5-point stencil). */
function laplacian1D(data: number[], numX: number, numY: number): number[] {
  if (numX < 3 || numY < 3 || data.length !== numX * numY) return data.slice()
  const out: number[] = new Array(data.length)
  for (let i = 0; i < numX; i++) {
    for (let j = 0; j < numY; j++) {
      const g = get(data, numY, i, j)
      const d2x = i === 0 ? get(data, numY, 2, j) - 2 * get(data, numY, 1, j) + get(data, numY, 0, j)
        : i === numX - 1 ? get(data, numY, numX - 1, j) - 2 * get(data, numY, numX - 2, j) + get(data, numY, numX - 3, j)
        : get(data, numY, i + 1, j) - 2 * g + get(data, numY, i - 1, j)
      const d2y = j === 0 ? get(data, numY, i, 2) - 2 * get(data, numY, i, 1) + get(data, numY, i, 0)
        : j === numY - 1 ? get(data, numY, i, numY - 1) - 2 * get(data, numY, i, numY - 2) + get(data, numY, i, numY - 3)
        : get(data, numY, i, j + 1) - 2 * g + get(data, numY, i, j - 1)
      out[i * numY + j] = d2x + d2y
    }
  }
  return out
}

/** Horizontal derivative dg/dx (central diff). */
function derivativeX1D(data: number[], numX: number, numY: number): number[] {
  if (numX < 2 || numY < 2 || data.length !== numX * numY) return data.slice()
  const out: number[] = new Array(data.length)
  for (let i = 0; i < numX; i++) {
    for (let j = 0; j < numY; j++) {
      const dx = i === 0 ? get(data, numY, 1, j) - get(data, numY, 0, j) : i === numX - 1 ? get(data, numY, numX - 1, j) - get(data, numY, numX - 2, j) : (get(data, numY, i + 1, j) - get(data, numY, i - 1, j)) / 2
      out[i * numY + j] = dx
    }
  }
  return out
}

/** Horizontal derivative dg/dy (central diff). */
function derivativeY1D(data: number[], numX: number, numY: number): number[] {
  if (numX < 2 || numY < 2 || data.length !== numX * numY) return data.slice()
  const out: number[] = new Array(data.length)
  for (let i = 0; i < numX; i++) {
    for (let j = 0; j < numY; j++) {
      const dy = j === 0 ? get(data, numY, i, 1) - get(data, numY, i, 0) : j === numY - 1 ? get(data, numY, i, numY - 1) - get(data, numY, i, numY - 2) : (get(data, numY, i, j + 1) - get(data, numY, i, j - 1)) / 2
      out[i * numY + j] = dy
    }
  }
  return out
}

/** Tilt derivative: θ = arctan(∂g/∂z / |∇h g|). Uses FFT for ∂g/∂z. */
function tiltDerivative1D(data: number[], numX: number, numY: number): number[] {
  if (numX < 2 || numY < 2 || data.length !== numX * numY) return data.slice()
  const dgdz = verticalDerivative2D(data, numX, numY)
  const thdr = gradientMagnitude1D(data, numX, numY)
  const out: number[] = new Array(data.length)
  const eps = 1e-10
  for (let i = 0; i < data.length; i++) {
    const h = Math.max(thdr[i], eps)
    out[i] = Math.atan2(dgdz[i], h)
  }
  return out
}

/** Analytic signal magnitude: sqrt((dg/dx)² + (dg/dy)² + (dg/dz)²). */
function analyticSignal1D(data: number[], numX: number, numY: number): number[] {
  if (numX < 2 || numY < 2 || data.length !== numX * numY) return data.slice()
  const dgdx = derivativeX1D(data, numX, numY)
  const dgdy = derivativeY1D(data, numX, numY)
  const dgdz = verticalDerivative2D(data, numX, numY)
  const out: number[] = new Array(data.length)
  for (let i = 0; i < data.length; i++) {
    out[i] = Math.sqrt(dgdx[i] * dgdx[i] + dgdy[i] * dgdy[i] + dgdz[i] * dgdz[i])
  }
  return out
}

/**
 * Total horizontal derivative of tilt (THDR of TDR).
 * Tilt θ = arctan(∂g/∂z / |∇h g|); then compute |∇h θ|.
 * Literature: Verduzco et al., Seequent; peaks over contacts, good for shallow and deep sources.
 */
function thdrOfTilt1D(data: number[], numX: number, numY: number): number[] {
  if (numX < 2 || numY < 2 || data.length !== numX * numY) return data.slice()
  const tilt = tiltDerivative1D(data, numX, numY)
  return gradientMagnitude1D(tilt, numX, numY)
}

/**
 * Normalized total horizontal derivative (NTHD): THDR / (|g| + ε).
 * Balances strong and weak amplitude anomalies (Ma & Li 2012 style); helps reveal deep/weak edges.
 */
function nthd1D(data: number[], numX: number, numY: number): number[] {
  if (numX < 2 || numY < 2 || data.length !== numX * numY) return data.slice()
  const thdr = gradientMagnitude1D(data, numX, numY)
  let gMax = 0
  for (let i = 0; i < data.length; i++) {
    const a = Math.abs(data[i])
    if (a > gMax) gMax = a
  }
  const eps = 1e-6 * Math.max(gMax, 1)
  const out: number[] = new Array(data.length)
  for (let i = 0; i < data.length; i++) {
    out[i] = thdr[i] / (Math.abs(data[i]) + eps)
  }
  return out
}

/**
 * Gradient angle (horizontal): φ = arctan2(∂g/∂y, ∂g/∂x).
 * Grid j increases downward (physical y decreases), so ∂g/∂y_physical = -d(g)/d(j); we use -dgdy.
 * Output normalized to [0, 1] for display; then we use actual data min/max so the colormap has contrast.
 */
function gradientAngle1D(data: number[], numX: number, numY: number): number[] {
  if (numX < 2 || numY < 2 || data.length !== numX * numY) return data.slice()
  const dgdx = derivativeX1D(data, numX, numY)
  const dgdy = derivativeY1D(data, numX, numY)
  const out: number[] = new Array(data.length)
  for (let i = 0; i < data.length; i++) {
    const gx = dgdx[i]
    const gy = -dgdy[i]
    const angle = Math.atan2(gy, gx)
    out[i] = (angle + Math.PI) / (2 * Math.PI)
  }
  return out
}

// --- Props: stats column + map + optional backend full-grid stats ---

export interface GravityResultsViewProps {
  gravityResults: number[]
  calculationTime: number | null
  computeMs?: number | null
  numSources?: number | null
  numReceiversX: number
  numReceiversY: number
  surfaceBounds: SurfaceBounds
  error?: string | null
  statsInLeftColumn?: boolean
  resultsTitle?: string
  mapTitle?: string
  emptyMessage?: string
  /** When backend downsampled the map, these are min/max/mean on the full receiver grid. */
  statsFromFullGrid?: GravityStatsFromFullGrid | null
  /** Length of `gravityResults` grid (may be ≤ numReceivers when downsampled). */
  mapGridNumX?: number | null
  mapGridNumY?: number | null
  /** Effective solver parameters returned by the API (Barnes–Hut / AMFM). */
  solverMeta?: Record<string, unknown> | null
  /** Fixed mGal colorbar extent (geometry / closed-form); independent of mesh source count. */
  fixedMapColorExtent?: GravityMapExtent | null
  /** Square map only for Cube (equal X/Y) or Sphere. */
  forceSquareMap?: boolean
}

// --- Layout: display dropdown → derived grid → GravityMapView ---

export default function GravityResultsView({
  gravityResults,
  calculationTime,
  computeMs = null,
  numSources = null,
  numReceiversX,
  numReceiversY,
  surfaceBounds,
  error,
  statsInLeftColumn = false,
  resultsTitle = 'Results',
  mapTitle = 'Gravity Anomaly Map (mGal)',
  emptyMessage = 'Configure parameters and click "Calculate Gravity" to see results.',
  statsFromFullGrid = null,
  mapGridNumX = null,
  mapGridNumY = null,
  solverMeta = null,
  fixedMapColorExtent = null,
  forceSquareMap = false,
}: GravityResultsViewProps) {
  const [displayMode, setDisplayMode] = useState<EdgeEnhancementMode>('gravity')
  const [displayDropdownOpen, setDisplayDropdownOpen] = useState(false)
  const displayDropdownRef = useRef<HTMLDivElement>(null)
  const hasResults = gravityResults.length > 0
  const requestedNx = mapGridNumX != null && mapGridNumX > 0 ? mapGridNumX : numReceiversX
  const requestedNy = mapGridNumY != null && mapGridNumY > 0 ? mapGridNumY : numReceiversY
  let gridNx = requestedNx
  let gridNy = requestedNy
  let dataForGrid = gravityResults
  const expectedByRequested = requestedNx * requestedNy
  const hasGridMismatch = hasResults && expectedByRequested !== gravityResults.length
  if (hasGridMismatch) {
    // When switching methods/models with large downsampled outputs, the metadata update can
    // briefly lag behind the array update. Infer a stable grid from data length to avoid a black map.
    const n = gravityResults.length
    const ratio = numReceiversY > 0 ? numReceiversX / numReceiversY : 1
    let inferredNx = Math.max(1, Math.round(Math.sqrt(n * Math.max(ratio, 1e-6))))
    let inferredNy = Math.max(1, Math.floor(n / inferredNx))
    if (inferredNx * inferredNy !== n) {
      inferredNx = Math.max(1, Math.floor(Math.sqrt(n)))
      inferredNy = Math.max(1, Math.floor(n / inferredNx))
    }
    gridNx = inferredNx
    gridNy = inferredNy
    dataForGrid = gravityResults.slice(0, gridNx * gridNy)
  }
  const isPreview = gridNx !== numReceiversX || gridNy !== numReceiversY

  useEffect(() => {
    if (!displayDropdownOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (displayDropdownRef.current && !displayDropdownRef.current.contains(e.target as Node)) {
        setDisplayDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [displayDropdownOpen])

  const currentDisplayLabel = DISPLAY_OPTIONS.find(o => o.value === displayMode)?.label ?? 'Gravity (mGal)'

  const { displayData, minVal, maxVal, isEdgeMode } = useMemo(() => {
    if (!hasResults) return { displayData: [] as number[], minVal: 0, maxVal: 0, isEdgeMode: false }
    // Cell size must match the actual `gravityResults` grid (full or downsampled preview).
    const cellSizeX = gridNx > 1 ? (surfaceBounds.xMax - surfaceBounds.xMin) / (gridNx - 1) : 1
    const cellSizeY = gridNy > 1 ? (surfaceBounds.yMax - surfaceBounds.yMin) / (gridNy - 1) : 1
    switch (displayMode) {
      case 'upwardContinuation': {
        const d = upwardContinuation2D(dataForGrid, gridNx, gridNy, 20, cellSizeX, cellSizeY)
        return { displayData: d, minVal: safeMin(d), maxVal: safeMax(d), isEdgeMode: true }
      }
      case 'upwardLaplacian': {
        const continued = upwardContinuation2D(dataForGrid, gridNx, gridNy, 20, cellSizeX, cellSizeY)
        const d = laplacian1D(continued, gridNx, gridNy)
        return { displayData: d, minVal: safeMin(d), maxVal: safeMax(d), isEdgeMode: true }
      }
      case 'downwardContinuation': {
        const d = downwardContinuation2D(dataForGrid, gridNx, gridNy, 20, cellSizeX, cellSizeY)
        return { displayData: d, minVal: safeMin(d), maxVal: safeMax(d), isEdgeMode: true }
      }
      case 'downwardLaplacian': {
        const continued = downwardContinuation2D(dataForGrid, gridNx, gridNy, 20, cellSizeX, cellSizeY)
        const d = laplacian1D(continued, gridNx, gridNy)
        return { displayData: d, minVal: safeMin(d), maxVal: safeMax(d), isEdgeMode: true }
      }
      case 'downwardGradient': {
        const continued = downwardContinuation2D(dataForGrid, gridNx, gridNy, 20, cellSizeX, cellSizeY)
        const d = gradientMagnitude1D(continued, gridNx, gridNy)
        return { displayData: d, minVal: safeMin(d), maxVal: safeMax(d), isEdgeMode: true }
      }
      case 'horizontalGradient': {
        const d = gradientMagnitude1D(dataForGrid, gridNx, gridNy)
        return { displayData: d, minVal: safeMin(d), maxVal: safeMax(d), isEdgeMode: true }
      }
      case 'laplacian': {
        const d = laplacian1D(dataForGrid, gridNx, gridNy)
        return { displayData: d, minVal: safeMin(d), maxVal: safeMax(d), isEdgeMode: true }
      }
      case 'dgdx': {
        const d = derivativeX1D(dataForGrid, gridNx, gridNy)
        return { displayData: d, minVal: safeMin(d), maxVal: safeMax(d), isEdgeMode: true }
      }
      case 'dgdy': {
        const d = derivativeY1D(dataForGrid, gridNx, gridNy)
        return { displayData: d, minVal: safeMin(d), maxVal: safeMax(d), isEdgeMode: true }
      }
      case 'tilt': {
        const d = tiltDerivative1D(dataForGrid, gridNx, gridNy)
        return { displayData: d, minVal: safeMin(d), maxVal: safeMax(d), isEdgeMode: true }
      }
      case 'thdrOfTilt': {
        const d = thdrOfTilt1D(dataForGrid, gridNx, gridNy)
        return { displayData: d, minVal: safeMin(d), maxVal: safeMax(d), isEdgeMode: true }
      }
      case 'nthd': {
        const d = nthd1D(dataForGrid, gridNx, gridNy)
        return { displayData: d, minVal: safeMin(d), maxVal: safeMax(d), isEdgeMode: true }
      }
      case 'analyticSignal': {
        const d = analyticSignal1D(dataForGrid, gridNx, gridNy)
        return { displayData: d, minVal: safeMin(d), maxVal: safeMax(d), isEdgeMode: true }
      }
      case 'gradientAngle': {
        const d = gradientAngle1D(dataForGrid, gridNx, gridNy)
        const minA = safeMin(d)
        const maxA = safeMax(d)
        return { displayData: d, minVal: minA, maxVal: maxA === minA ? minA + 1 : maxA, isEdgeMode: true }
      }
      default: {
        const dataMin = safeMin(dataForGrid)
        const dataMax = safeMax(dataForGrid)
        const minG = fixedMapColorExtent ? fixedMapColorExtent.min : dataMin
        const maxG = fixedMapColorExtent ? fixedMapColorExtent.max : dataMax
        return {
          displayData: dataForGrid,
          minVal: minG,
          maxVal: maxG <= minG ? minG + 1e-9 : maxG,
          isEdgeMode: false,
        }
      }
    }
  }, [hasResults, displayMode, gravityResults, dataForGrid, gridNx, gridNy, surfaceBounds, fixedMapColorExtent])

  return (
    <div className="gravity-results">
      {!statsInLeftColumn && (
        <h3 className="gravity-results-title">{resultsTitle}</h3>
      )}
      {hasResults ? (
        <>
          {!statsInLeftColumn && (
            <div className="gravity-results-stats">
              {displayMode === 'gravity' && (
                <>
                  <p><strong>Min:</strong> {minVal.toFixed(2)} mGal</p>
                  <p><strong>Max:</strong> {maxVal.toFixed(2)} mGal</p>
                  <p>
                    <strong>Average:</strong>{' '}
                    {(statsFromFullGrid ? statsFromFullGrid.mean : safeMean(gravityResults)).toFixed(2)} mGal
                  </p>
                </>
              )}
              {isEdgeMode && (displayMode === 'downwardLaplacian' || displayMode === 'downwardGradient') && (
                <p className="help-text">Best for <strong>depth &gt; 30 m</strong>: downward continuation (20 m) then edge detection to separate deep bodies. See edge-enhancement-methods.md.</p>
              )}
              {isEdgeMode && displayMode !== 'downwardLaplacian' && displayMode !== 'downwardGradient' && (
                <p className="help-text">Edge enhancement highlights boundaries between bodies (e.g. 4 cubes). See edge-enhancement-methods.md.</p>
              )}
              {calculationTime != null && (
                <p><strong>Calculation time:</strong> {calculationTime < 1000 ? calculationTime.toFixed(0) + ' ms' : (calculationTime / 1000).toFixed(2) + ' s'}</p>
              )}
              {numSources != null && (
                <p><strong>Sources used:</strong> {numSources.toLocaleString()}</p>
              )}
            </div>
          )}
          <div className="gravity-results-header-row">
            <div className="gravity-results-header-left">
              <span className="gravity-results-method-name">{resultsTitle}</span>
              {calculationTime != null && (
                <span className="gravity-results-calculation-time">
                  {calculationTime < 1000 ? calculationTime.toFixed(0) + ' ms' : (calculationTime / 1000).toFixed(2) + ' s'}
                </span>
              )}
              {isPreview && (
                <div className="help-text" style={{ marginTop: 4 }}>
                  Preview grid: <strong>{gridNx}×{gridNy}</strong> (full {numReceiversX}×{numReceiversY})
                </div>
              )}
              {hasGridMismatch && (
                <div className="help-text" style={{ marginTop: 2 }}>
                  Display grid auto-synced from returned data to keep visualization stable.
                </div>
              )}
              {solverMeta &&
                solverMeta.method !== 'quadrature_second_order' &&
                formatSolverMetaLine(solverMeta) !== '' && (
                <div
                  className="help-text"
                  style={{ marginTop: 4 }}
                  title={
                    typeof solverMeta.native_note === 'string'
                      ? solverMeta.native_note
                      : 'Restart the API after rebuilding native code; ctypes does not reload .dylib/.so.'
                  }
                >
                  {formatSolverMetaLine(solverMeta)}
                </div>
              )}
            </div>
            <div className="gravity-map-display-mode" ref={displayDropdownRef}>
              <span className="gravity-display-label">Display</span>
              <div className="gravity-display-trigger-wrap">
                <button
                  type="button"
                  className="gravity-display-trigger"
                  onClick={() => setDisplayDropdownOpen((open) => !open)}
                  aria-expanded={displayDropdownOpen}
                  aria-haspopup="listbox"
                  aria-label="Select display method"
                >
                  <span className="gravity-display-trigger-text">{currentDisplayLabel}</span>
                  <span className="gravity-display-trigger-icon" aria-hidden>{displayDropdownOpen ? '▲' : '▼'}</span>
                </button>
                {displayDropdownOpen && (
                  <ul
                    className="gravity-display-dropdown"
                    role="listbox"
                    aria-label="Display method"
                  >
                    {DISPLAY_OPTIONS.map((opt) => (
                      <li
                        key={opt.value}
                        role="option"
                        aria-selected={displayMode === opt.value}
                        className={`gravity-display-option ${displayMode === opt.value ? 'gravity-display-option-selected' : ''}`}
                        onClick={() => {
                          setDisplayMode(opt.value)
                          setDisplayDropdownOpen(false)
                        }}
                      >
                        {opt.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
          <GravityMapView
            data={displayData}
            numX={gridNx}
            numY={gridNy}
            min={minVal}
            max={maxVal}
            surfaceBounds={surfaceBounds}
            calculationTime={null}
            title=""
            forceSquareMap={forceSquareMap}
          />
        </>
      ) : (
        <div className="gravity-no-results">
          {!statsInLeftColumn && (
            <p>{emptyMessage}</p>
          )}
          {error && <p className="gravity-results-error">{error}</p>}
        </div>
      )}
    </div>
  )
}
