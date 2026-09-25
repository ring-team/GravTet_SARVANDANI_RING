import './AnalysisResultsView.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GravityMapView, type SurfaceBounds } from '../../shared/GravityMapView'
import {
  formatColorbarInputValue,
  formatScientificColorbarLabel,
  parseColorbarManualValue,
} from '../../lib/colorbarScientificFormat'
import { safeMin, safeMax } from '../../lib/gravityArrayStats'
import { RAINBOW_YELLOW_NORMALIZED } from '../../lib/colorbarRainbow'
import { downloadElementAsFormat } from './analysisMapCapture'
import {
  downloadRunParametersFile,
  type RunParametersExportFormat,
  type RunParametersSnapshot,
} from '../../lib/runParametersSnapshot'

export type GravityAnalysisResult = {
  analysis_method: string
  reference_method: string
  compute_ms: number
  reference_compute_ms: number
  mae_mgal: number
  rmse_mgal: number
  max_abs_error_mgal: number
  relative_l2_percent: number
  correlation_r: number
  num_points_compared: number
  map_num_x?: number
  map_num_y?: number
  analytical_reference_map?: number[]
  candidate_map?: number[]
  candidate_stats_min?: number
  candidate_stats_max?: number
  comparison_maps?: {
    /** 100 * |g_i - g_ref_i| / ||g_ref||_2 (%) — global L2-normalized pointwise map */
    relative_l2_percent_pointwise?: number[]
    correlation_residual?: number[]
  }
}

interface AnalysisResultsViewProps {
  result: GravityAnalysisResult | null
  loading: boolean
  error: string | null
  surfaceBounds: SurfaceBounds
  numReceiversX: number
  numReceiversY: number
  runParametersSnapshot?: RunParametersSnapshot | null
  /** Hide closed-form reference / error maps (composite models). */
  fieldOnly?: boolean
  /** Square map only for Cube (equal X/Y) or Sphere. */
  forceSquareMap?: boolean
}

type MapKey = 'current_method_field' | 'analytical_reference' | 'global_l2_normalized_map'

/** nx×ny = n with aspect nx/ny closest to `ratio` (exact factorization only). */
function factorMapGrid(n: number, ratio: number): { nx: number; ny: number } {
  if (!Number.isFinite(n) || n < 1) return { nx: 1, ny: 1 }
  const r = Number.isFinite(ratio) && ratio > 0 ? ratio : 1
  let bestNx = 1
  let bestNy = n
  let bestScore = Infinity
  const sn = Math.floor(Math.sqrt(n))
  for (let d = 1; d <= sn; d++) {
    if (n % d !== 0) continue
    const ny = d
    const nx = n / d
    const score = Math.abs(Math.log((nx / ny) / r))
    if (score < bestScore) {
      bestScore = score
      bestNx = nx
      bestNy = ny
    }
  }
  return { nx: bestNx, ny: bestNy }
}

export default function AnalysisResultsView({
  result,
  loading,
  error,
  surfaceBounds,
  numReceiversX,
  numReceiversY,
  runParametersSnapshot = null,
  fieldOnly = false,
  forceSquareMap = false,
}: AnalysisResultsViewProps) {
  const isGlobalNormMap = (k: MapKey | null) => k === 'global_l2_normalized_map'

  const formatColorbarManualValue = (value: number, map: MapKey | null, dataPeak = 1) => {
    if (!Number.isFinite(value)) return ''
    const v = Math.max(0, value)
    if (v === 0) return '0'
    if (isGlobalNormMap(map) || (map !== 'current_method_field' && map !== 'analytical_reference')) {
      // Error colorbar: one mantissa digit (e.g. 1.7 × 10⁻¹⁰), not 1.701.
      return formatScientificColorbarLabel(v, 1)
    }
    return v.toFixed(2)
  }

  const [selectedMap, setSelectedMap] = useState<MapKey | null>(null)
  const [manualRangeEnabled, setManualRangeEnabled] = useState(false)
  const [manualMinInput, setManualMinInput] = useState('')
  const [manualMaxInput, setManualMaxInput] = useState('')
  const manualRangeSeededRef = useRef(false)

  useEffect(() => {
    if (fieldOnly) {
      setSelectedMap('current_method_field')
    } else {
      const hasGlobal =
        Array.isArray(result?.comparison_maps?.relative_l2_percent_pointwise) &&
        (result?.comparison_maps?.relative_l2_percent_pointwise?.length ?? 0) > 0
      setSelectedMap(hasGlobal ? 'global_l2_normalized_map' : null)
    }
    setManualRangeEnabled(false)
    setManualMinInput('')
    setManualMaxInput('')
    manualRangeSeededRef.current = false
  }, [result, fieldOnly])

  useEffect(() => {
    manualRangeSeededRef.current = false
  }, [selectedMap])

  const requestedMapNx = result?.map_num_x && result.map_num_x > 0 ? result.map_num_x : numReceiversX
  const requestedMapNy = result?.map_num_y && result.map_num_y > 0 ? result.map_num_y : numReceiversY

  const mapData = useMemo(() => {
    if (!result || !selectedMap) return null
    if (selectedMap === 'current_method_field') {
      return result.candidate_map ?? null
    }
    if (selectedMap === 'analytical_reference') {
      return result.analytical_reference_map ?? null
    }
    return result.comparison_maps?.relative_l2_percent_pointwise ?? null
  }, [result, selectedMap])

  const { mapNx, mapNy, displayData } = useMemo(() => {
    if (!mapData || mapData.length === 0) {
      return { mapNx: requestedMapNx, mapNy: requestedMapNy, displayData: mapData }
    }
    const n = mapData.length
    const apiNx = result?.map_num_x
    const apiNy = result?.map_num_y
    if (typeof apiNx === 'number' && typeof apiNy === 'number' && apiNx > 0 && apiNy > 0 && apiNx * apiNy === n) {
      return { mapNx: apiNx, mapNy: apiNy, displayData: mapData }
    }
    const expected = requestedMapNx * requestedMapNy
    if (expected === n) {
      return { mapNx: requestedMapNx, mapNy: requestedMapNy, displayData: mapData }
    }
    if (numReceiversX > 0 && numReceiversY > 0 && numReceiversX * numReceiversY === n) {
      return { mapNx: numReceiversX, mapNy: numReceiversY, displayData: mapData }
    }
    const ratio = requestedMapNy > 0 ? requestedMapNx / requestedMapNy : 1
    const { nx, ny } = factorMapGrid(n, ratio)
    return { mapNx: nx, mapNy: ny, displayData: mapData }
  }, [mapData, requestedMapNx, requestedMapNy, numReceiversX, numReceiversY, result])

  const { autoMapMin, autoMapMax } = useMemo(() => {
    if (selectedMap === 'current_method_field' || selectedMap === 'analytical_reference') {
      const selectedData =
        selectedMap === 'current_method_field'
          ? (Array.isArray(result?.candidate_map) ? result.candidate_map : [])
          : (Array.isArray(result?.analytical_reference_map) ? result.analytical_reference_map : [])
      const dataMin = selectedData.length > 0 ? safeMin(selectedData) : Number.NaN
      const dataMax = selectedData.length > 0 ? safeMax(selectedData) : Number.NaN
      const lo = Number.isFinite(dataMin)
        ? dataMin
        : (
          selectedMap === 'current_method_field' && typeof result?.candidate_stats_min === 'number'
            ? result.candidate_stats_min
            : 0
        )
      const hi = Number.isFinite(dataMax)
        ? dataMax
        : (
          selectedMap === 'current_method_field' && typeof result?.candidate_stats_max === 'number'
            ? result.candidate_stats_max
            : 1
        )
      if (hi - lo < 1e-9) {
        const pad = Math.max(1e-6, Math.abs(lo) * 0.05)
        return { autoMapMin: lo - pad, autoMapMax: hi + pad }
      }
      return { autoMapMin: lo, autoMapMax: hi }
    }
    if (!displayData || displayData.length === 0) {
      return { autoMapMin: 0, autoMapMax: 1 }
    }
    const mn = safeMin(displayData)
    const mx = safeMax(displayData)
    if (!Number.isFinite(mn) || !Number.isFinite(mx)) {
      return { autoMapMin: 0, autoMapMax: 1 }
    }
    const span = mx - mn
    const pad = Math.max(1e-15, span > 0 ? 0.05 * span : Math.max(1e-9, Math.abs(mx) * 0.05, 1e-12))
    let gridMax = mx + pad
    if (span <= 0) {
      gridMax = Math.max(mx, mn) + pad
    }
    // Stretch scale so the data peak maps to yellow (not red/orange) inside the map.
    if (isGlobalNormMap(selectedMap) && mx > 0) {
      gridMax = Math.max(gridMax, mx / RAINBOW_YELLOW_NORMALIZED)
    }
    return { autoMapMin: 0, autoMapMax: gridMax }
  }, [displayData, selectedMap, result])

  const { mapMin, mapMax } = useMemo(() => {
    if (!manualRangeEnabled) {
      return { mapMin: Math.max(0, autoMapMin), mapMax: Math.max(0, autoMapMax) }
    }
    const parsedMin = parseColorbarManualValue(manualMinInput)
    const parsedMax = parseColorbarManualValue(manualMaxInput)
    const minVal = Number.isFinite(parsedMin) ? parsedMin : autoMapMin
    const maxVal = Number.isFinite(parsedMax) ? parsedMax : autoMapMax
    if (maxVal <= minVal) {
      return { mapMin: Math.max(0, autoMapMin), mapMax: Math.max(0, autoMapMax) }
    }
    return { mapMin: minVal, mapMax: maxVal }
  }, [manualRangeEnabled, manualMinInput, manualMaxInput, autoMapMin, autoMapMax])

  const displayDataMax = displayData && displayData.length > 0 ? safeMax(displayData) : 0
  const useScientificColorbar = isGlobalNormMap(selectedMap)
  const colorbarRangeEps =
    useScientificColorbar
      ? Math.max(1e-15, Math.abs(mapMin) * 1e-14, Math.abs(mapMax) * 1e-14)
      : 1e-9

  useEffect(() => {
    if (!manualRangeEnabled) {
      manualRangeSeededRef.current = false
      return
    }
    if (!manualRangeSeededRef.current) {
      setManualMinInput(formatColorbarInputValue(autoMapMin))
      setManualMaxInput(formatColorbarInputValue(autoMapMax))
      manualRangeSeededRef.current = true
    }
  }, [manualRangeEnabled, autoMapMin, autoMapMax])

  const colorBarUnit =
    selectedMap === 'current_method_field' || selectedMap === 'analytical_reference' ? 'mGal' : '%'

  const mapCaptureRef = useRef<HTMLDivElement>(null)
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg' | 'pdf'>('png')
  const [parameterExportFormat, setParameterExportFormat] = useState<RunParametersExportFormat>('txt')
  const [isExporting, setIsExporting] = useState(false)

  const waitTwoFrames = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })

  const exportStamp = () => {
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`
  }

  const mapSlug = (k: MapKey | null): string => {
    if (k === 'current_method_field') return 'candidate'
    if (k === 'analytical_reference') return 'reference'
    if (k === 'global_l2_normalized_map') return 'relative-error-pct'
    return 'map'
  }

  const handleSaveCurrentMap = useCallback(async () => {
    const el = mapCaptureRef.current
    if (!el || !displayData?.length || isExporting) return
    setIsExporting(true)
    try {
      await waitTwoFrames()
      const base = `analysis-${mapSlug(selectedMap)}-${exportStamp()}`
      await downloadElementAsFormat(el, exportFormat, base)
    } catch (err) {
      console.error(err)
    } finally {
      setIsExporting(false)
    }
  }, [displayData?.length, exportFormat, isExporting, selectedMap])

  const handleSaveParameters = useCallback(() => {
    if (!runParametersSnapshot) return
    downloadRunParametersFile(runParametersSnapshot, parameterExportFormat)
  }, [runParametersSnapshot, parameterExportFormat])

  return (
    <div className="gravity-results analysis-results-panel">
      {loading && <p>Running analysis...</p>}
      {!loading && error && <p className="gravity-results-error">{error}</p>}
      {!loading && !error && !result && <p>No analysis results yet.</p>}
      {!loading && !error && result && (
        <div className="analysis-metrics">
          {!fieldOnly && (
          <div className="analysis-metric-line">
            <label>
              <input
                type="checkbox"
                checked={selectedMap === 'analytical_reference'}
                onChange={() => setSelectedMap(selectedMap === 'analytical_reference' ? null : 'analytical_reference')}
                disabled={!Array.isArray(result.analytical_reference_map) || result.analytical_reference_map.length === 0}
              />{' '}
              Reference
            </label>
            <label>
              <input
                type="checkbox"
                checked={selectedMap === 'current_method_field'}
                onChange={() => setSelectedMap(selectedMap === 'current_method_field' ? null : 'current_method_field')}
                disabled={!Array.isArray(result.candidate_map) || result.candidate_map.length === 0}
              />{' '}
              Method
            </label>
            {Array.isArray(result.comparison_maps?.relative_l2_percent_pointwise) &&
              result.comparison_maps.relative_l2_percent_pointwise.length > 0 && (
              <label>
                <input
                  type="checkbox"
                  checked={selectedMap === 'global_l2_normalized_map'}
                  onChange={() =>
                    setSelectedMap(selectedMap === 'global_l2_normalized_map' ? null : 'global_l2_normalized_map')
                  }
                />{' '}
                Relative error
              </label>
            )}
          </div>
          )}
          <div className="analysis-map-toolbar analysis-main-toolbar">
            {displayData && displayData.length > 0 && (
              <>
                <label className="analysis-export-label" htmlFor="analysis-export-format">Format</label>
                <select
                  id="analysis-export-format"
                  className="analysis-export-select"
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as 'png' | 'jpeg' | 'pdf')}
                  disabled={isExporting}
                >
                  <option value="png">PNG</option>
                  <option value="jpeg">JPEG</option>
                  <option value="pdf">PDF</option>
                </select>
                <button
                  type="button"
                  className="analysis-export-btn"
                  onClick={handleSaveCurrentMap}
                  disabled={isExporting || !displayData?.length}
                >
                  Save map
                </button>
                <span className="analysis-toolbar-sep" aria-hidden />
                <label className="analysis-toolbar-inline">
                  <input
                    type="checkbox"
                    checked={manualRangeEnabled}
                    onChange={() => {
                      setManualRangeEnabled((enabled) => {
                        const next = !enabled
                        if (next) {
                          manualRangeSeededRef.current = false
                        } else {
                          manualRangeSeededRef.current = false
                          setManualMinInput('')
                          setManualMaxInput('')
                        }
                        return next
                      })
                    }}
                  />
                  Colorbar
                </label>
                <label className="analysis-toolbar-inline">
                  Min
                  <input
                    type={useScientificColorbar ? 'text' : 'number'}
                    step={useScientificColorbar ? undefined : 'any'}
                    value={manualMinInput}
                    onChange={(e) => setManualMinInput(e.target.value)}
                    placeholder={formatColorbarManualValue(autoMapMin, selectedMap, displayDataMax)}
                    disabled={!manualRangeEnabled}
                    className="analysis-toolbar-num"
                  />
                </label>
                <label className="analysis-toolbar-inline">
                  Max
                  <input
                    type={useScientificColorbar ? 'text' : 'number'}
                    step={useScientificColorbar ? undefined : 'any'}
                    value={manualMaxInput}
                    onChange={(e) => setManualMaxInput(e.target.value)}
                    placeholder={formatColorbarManualValue(autoMapMax, selectedMap, displayDataMax)}
                    disabled={!manualRangeEnabled}
                    className="analysis-toolbar-num"
                  />
                </label>
              </>
            )}
            <label className="analysis-export-label" htmlFor="analysis-parameter-export-format">Params</label>
            <select
              id="analysis-parameter-export-format"
              className="analysis-export-select"
              value={parameterExportFormat}
              onChange={(e) => setParameterExportFormat(e.target.value as RunParametersExportFormat)}
              disabled={!runParametersSnapshot}
            >
              <option value="json">JSON</option>
              <option value="txt">TXT</option>
            </select>
            <button
              type="button"
              className="analysis-export-btn"
              onClick={handleSaveParameters}
              disabled={!runParametersSnapshot}
              title={
                runParametersSnapshot
                  ? `Download parameters.${parameterExportFormat} for this run`
                  : 'Run Calculate Gravity first to enable parameter export'
              }
            >
              Save parameters
            </button>
          </div>
          {displayData && displayData.length > 0 && (
            <div className="analysis-map-wrap">
              <div
                ref={mapCaptureRef}
                className="analysis-map-capture-root"
                data-export-model-type={runParametersSnapshot?.model_type}
              >
                <GravityMapView
                  data={displayData}
                  numX={mapNx}
                  numY={mapNy}
                  min={mapMin}
                  max={mapMax <= mapMin ? mapMin + colorbarRangeEps : mapMax}
                  surfaceBounds={surfaceBounds}
                  calculationTime={null}
                  title=""
                  colorBarDecimals={useScientificColorbar ? 1 : 2}
                  colorBarExpDigits={useScientificColorbar ? 1 : 3}
                  colorBarScientific={useScientificColorbar}
                  colorBarUnit={colorBarUnit}
                  colorScale="linear"
                  forceSquareMap={forceSquareMap}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
