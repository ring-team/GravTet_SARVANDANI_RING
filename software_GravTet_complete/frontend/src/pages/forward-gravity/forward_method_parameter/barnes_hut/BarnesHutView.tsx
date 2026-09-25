/**
 * Barnes–Hut tree-code forward-modeling page: opening angle θ, shared model controls, run, and anomaly map.
 *
 * Same synthetic model and observation grid as AMFM/Direct Newton; backend uses `POST /api/compute_gravity_barnes_hut`.
 */
import { useEffect, useState } from 'react'
import '../../shared/ForwardGravityView.css'
import { api, type GravityAnalysisResponse } from '../../../../services/api'
import AnalysisResultsView from '../analysis_gravity/AnalysisResultsView'
import GravityResultsView from '../../shared/GravityResultsView'
import { shouldForceSquareGravityMap, type SurfaceBounds } from '../../shared/GravityMapView'
import { barnesHutBuildRequest, type BarnesHutModelParams } from './barnesHutBuildRequest'
import { isRectangularPrismGravityModel } from '../../lib/gravityModelKinds'
import {
  BARNES_HUT_DEFAULT_THETA0,
  BARNES_HUT_DEFAULT_THETA0_RECTANGULAR_PRISM,
  BARNES_HUT_MIN_OBSERVATION_POINTS,
  BARNES_HUT_THETA_MAX,
  BARNES_HUT_THETA_MIN,
  BARNES_HUT_THETA_STEP,
} from './barnesHutConstants'
import { isForwardAnalysisSupported, isFieldOnlyAnalysisSupported } from '../../lib/forwardAnalysisSupport'
import { buildFieldOnlyAnalysisResult } from '../../lib/fieldOnlyAnalysisResult'
import { isGmshTetrahedralModel } from '../../../synthetic-gravity/lib/gmshMeshSupport'
import { useBarnesHutCalculation } from './barnesHutCalculation'
import { buildForwardGravityAnalysisBodyAsync } from '../../lib/forwardAnalysisRequest'
import { forwardRunGeometryKey } from '../../lib/forwardRunGeometryKey'
import type { ForwardRunMeta } from '../../lib/forwardRunMeta'

// --- Props: synthetic model + observation grid from app shell ---

interface BarnesHutViewProps extends BarnesHutModelParams {
  gravityResults: number[]
  setGravityResults: (results: number[]) => void
  calculationTime: number | null
  setCalculationTime: (time: number | null) => void
  numSourcesX: number
  numSourcesY: number
  numSourcesZ: number
  numReceiversX: number
  numReceiversY: number
  onNumSourcesXChange: (v: number) => void
  onNumSourcesYChange: (v: number) => void
  onNumSourcesZChange: (v: number) => void
  onNumReceiversXChange: (v: number) => void
  onNumReceiversYChange: (v: number) => void
  forwardSurfaceBounds: SurfaceBounds
  lastRunNumReceiversX: number | null
  lastRunNumReceiversY: number | null
  onLastRunNumReceiversSet: (x: number, y: number) => void
  lastRunMeta?: ForwardRunMeta | null
  onLastRunMetaSet?: (meta: ForwardRunMeta) => void
  gmshPreviewLoading?: boolean
  gmshMeshCalculateReady?: boolean
}

// --- Page: θ control + shared results/map ---

export default function BarnesHutView(props: BarnesHutViewProps) {
  const {
    numSourcesX,
    numSourcesY,
    numSourcesZ,
    numReceiversX,
    numReceiversY,
    onNumReceiversXChange: setNumReceiversX,
    onNumReceiversYChange: setNumReceiversY,
  } = props
  const [theta0, setTheta0] = useState(() =>
    isRectangularPrismGravityModel(props.modelType)
      ? BARNES_HUT_DEFAULT_THETA0_RECTANGULAR_PRISM
      : BARNES_HUT_DEFAULT_THETA0
  )

  useEffect(() => {
    setTheta0(
      isRectangularPrismGravityModel(props.modelType)
        ? BARNES_HUT_DEFAULT_THETA0_RECTANGULAR_PRISM
        : BARNES_HUT_DEFAULT_THETA0
    )
  }, [props.modelType])
  useEffect(() => {
    setShowAnalysis(false)
    setAnalysisResult(null)
    setAnalysisError(null)
  }, [props.gravityResults, props.modelType])

  const thetaFallback = isRectangularPrismGravityModel(props.modelType)
    ? BARNES_HUT_DEFAULT_THETA0_RECTANGULAR_PRISM
    : BARNES_HUT_DEFAULT_THETA0

  const {
    isCalculating,
    error,
    computeMs,
    gravityResponseMeta,
    fixedMapColorExtent,
    lastRunGeometryKey,
    lastRunParametersSnapshot,
    calculateGravity,
  } = useBarnesHutCalculation({
    ...props,
    theta0,
  })

  const currentGeometryKey = forwardRunGeometryKey(
    props,
    numSourcesX,
    numSourcesY,
    numSourcesZ,
    props.forwardSurfaceBounds,
  )
  const persistedGeometryKey = props.lastRunMeta?.geometryKey ?? lastRunGeometryKey
  const analysisGeometryStale =
    props.gravityResults.length > 0 &&
    persistedGeometryKey != null &&
    persistedGeometryKey !== currentGeometryKey
  const analysisNeedsFreshCalculate =
    props.gravityResults.length > 0 && persistedGeometryKey == null

  const [showAnalysis, setShowAnalysis] = useState(false)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [analysisResult, setAnalysisResult] = useState<GravityAnalysisResponse | null>(null)

  const isForwardAnalysisModelSupported = isForwardAnalysisSupported(props.modelType)
  const isFieldOnlyAnalysis = isFieldOnlyAnalysisSupported(props.modelType)
  const meshWarmupPending = Boolean(
    isGmshTetrahedralModel(props.modelType) &&
      (props.gmshPreviewLoading || props.gmshMeshCalculateReady === false),
  )

  const runAnalysis = async () => {
    if (showAnalysis) {
      setShowAnalysis(false)
      return
    }
    if (props.gravityResults.length === 0) return
    if (!isForwardAnalysisModelSupported) return
    if (analysisNeedsFreshCalculate) {
      setAnalysisError(
        'Click Calculate Gravity before Analysis (required after refresh or switching solver tabs).',
      )
      setShowAnalysis(true)
      return
    }
    if (analysisGeometryStale) {
      setAnalysisError(
        'Model depth or size changed since the last Calculate Gravity run. Recalculate, then run analysis again.',
      )
      setShowAnalysis(true)
      return
    }
    setAnalysisLoading(true)
    setAnalysisError(null)
    try {
      const analysisNumReceiversX =
        props.gravityResults.length > 0 && props.lastRunNumReceiversX != null
          ? props.lastRunNumReceiversX
          : props.numReceiversX
      const analysisNumReceiversY =
        props.gravityResults.length > 0 && props.lastRunNumReceiversY != null
          ? props.lastRunNumReceiversY
          : props.numReceiversY
      if (isFieldOnlyAnalysis) {
        setAnalysisResult(
          buildFieldOnlyAnalysisResult({
            analysisMethod: 'barnes_hut',
            candidateResults: props.gravityResults,
            mapNumX: props.lastRunMeta?.mapNx ?? gravityResponseMeta?.mapNx ?? null,
            mapNumY: props.lastRunMeta?.mapNy ?? gravityResponseMeta?.mapNy ?? null,
            numReceiversX: analysisNumReceiversX,
            numReceiversY: analysisNumReceiversY,
            computeMs: computeMs,
          }),
        )
        setShowAnalysis(true)
        return
      }
      const req = barnesHutBuildRequest({
        model: props,
        numSourcesX: props.numSourcesX,
        numSourcesY: props.numSourcesY,
        numSourcesZ: props.numSourcesZ,
        numReceiversX: analysisNumReceiversX,
        numReceiversY: analysisNumReceiversY,
        surfaceBounds: props.forwardSurfaceBounds,
        theta0,
      })
      const res = await api.computeGravityAnalysis(
        await buildForwardGravityAnalysisBodyAsync(
          { ...req, analysisMethod: 'barnes_hut' },
          {
            model: props,
            numSourcesX: props.numSourcesX,
            numSourcesY: props.numSourcesY,
            numSourcesZ: props.numSourcesZ,
            numReceiversX: analysisNumReceiversX,
            numReceiversY: analysisNumReceiversY,
            surfaceBounds: props.forwardSurfaceBounds,
            candidateResults: props.gravityResults,
            mapNumX: props.lastRunMeta?.mapNx ?? gravityResponseMeta?.mapNx ?? null,
            mapNumY: props.lastRunMeta?.mapNy ?? gravityResponseMeta?.mapNy ?? null,
          },
        ),
      )
      setAnalysisResult(res)
      setShowAnalysis(true)
    } catch (e) {
      setAnalysisResult(null)
      setAnalysisError(e instanceof Error ? e.message : 'Analysis failed')
      setShowAnalysis(true)
    } finally {
      setAnalysisLoading(false)
    }
  }

  return (
    <div className="forward-solver-container">
      {/* --- Observation grid, θ₀, run, inline stats --- */}
      <div className="forward-solver-controls">
        <h3>{props.modelType || 'No Model Selected'}</h3>
        {!props.modelType && (
          <div className="warning-message">Please select a synthetic gravity model first</div>
        )}

        <div className="control-group">
          <label>Observation Points X: <input type="number" value={numReceiversX || ''} onChange={(e) => setNumReceiversX(e.target.value === '' ? 0 : parseInt(e.target.value) || 0)} min={BARNES_HUT_MIN_OBSERVATION_POINTS} /></label>
        </div>
        <div className="control-group">
          <label>Observation Points Y: <input type="number" value={numReceiversY || ''} onChange={(e) => setNumReceiversY(e.target.value === '' ? 0 : parseInt(e.target.value) || 0)} min={BARNES_HUT_MIN_OBSERVATION_POINTS} /></label>
        </div>
        <div className="control-group">
          <label>θ₀ (accuracy):{' '}
            <input
              type="number"
              value={theta0}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                setTheta0(Number.isFinite(v) ? v : thetaFallback)
              }}
              min={BARNES_HUT_THETA_MIN}
              max={BARNES_HUT_THETA_MAX}
              step={BARNES_HUT_THETA_STEP}
              title="Range 0.1–1.5"
            />{' '}
            <span className="help-text">
              {isRectangularPrismGravityModel(props.modelType)
                ? 'Cuboid/prism: default θ₀ = 0.25; the API also caps θ₀ at 0.25 so Barnes–Hut stays closer to direct Newton on elongated bodies (monopole tree vs full sum). Range 0.1–1.5.'
                : 'Range 0.1–1.5 (default 0.5). Smaller = more accurate, slower; larger = faster, less accurate.'}
            </span>
          </label>
        </div>

        <button
          className="calculate-button"
          onClick={calculateGravity}
          disabled={
            isCalculating ||
            meshWarmupPending ||
            !props.modelType ||
            ( !isGmshTetrahedralModel(props.modelType) &&
              (!numSourcesX || !numSourcesY || !numSourcesZ)) ||
            !numReceiversX ||
            !numReceiversY
          }
        >
          {isCalculating ? 'Calculating...' : meshWarmupPending ? 'Preparing mesh...' : 'Calculate Gravity'}
        </button>
        {isForwardAnalysisModelSupported && (
          <button
            className="calculate-button"
            onClick={runAnalysis}
            disabled={(!showAnalysis && props.gravityResults.length === 0) || isCalculating || analysisLoading}
          >
            {showAnalysis ? 'Model Display' : analysisLoading ? 'Analyzing...' : 'Analysis'}
          </button>
        )}
        {error && <div className="error-message">Error: {error}</div>}

        {props.gravityResults.length === 0 && (
          <p className="gravity-no-results-text">Configure parameters and click &quot;Calculate Gravity&quot; to see Barnes–Hut + Advanced Newton results.</p>
        )}
      </div>
      {/* --- Heatmap + stats (shared layout) --- */}
      {showAnalysis ? (
        <AnalysisResultsView
          result={analysisResult}
          loading={analysisLoading}
          error={analysisError}
          surfaceBounds={props.forwardSurfaceBounds}
          numReceiversX={props.gravityResults.length > 0 && props.lastRunNumReceiversX != null ? props.lastRunNumReceiversX : numReceiversX}
          numReceiversY={props.gravityResults.length > 0 && props.lastRunNumReceiversY != null ? props.lastRunNumReceiversY : numReceiversY}
          runParametersSnapshot={lastRunParametersSnapshot}
          fieldOnly={isFieldOnlyAnalysis}
          forceSquareMap={shouldForceSquareGravityMap(props.modelType, props.cubeX, props.cubeY)}
        />
      ) : (
        <GravityResultsView
          gravityResults={props.gravityResults}
          calculationTime={props.calculationTime}
          computeMs={computeMs}
          numReceiversX={props.gravityResults.length > 0 && props.lastRunNumReceiversX != null ? props.lastRunNumReceiversX : numReceiversX}
          numReceiversY={props.gravityResults.length > 0 && props.lastRunNumReceiversY != null ? props.lastRunNumReceiversY : numReceiversY}
          surfaceBounds={props.forwardSurfaceBounds}
          error={error}
          statsInLeftColumn
          resultsTitle="Barnes–Hut + Advanced Newton Results"
          mapTitle="Barnes–Hut + Advanced Newton Gravity Anomaly Map (mGal)"
          emptyMessage='Configure parameters and click "Calculate Gravity" to see Barnes–Hut + Advanced Newton results.'
          statsFromFullGrid={gravityResponseMeta?.stats ?? null}
          mapGridNumX={gravityResponseMeta?.mapNx ?? null}
          mapGridNumY={gravityResponseMeta?.mapNy ?? null}
          solverMeta={gravityResponseMeta?.solverMeta ?? null}
          fixedMapColorExtent={fixedMapColorExtent}
          forceSquareMap={shouldForceSquareGravityMap(props.modelType, props.cubeX, props.cubeY)}
        />
      )}
    </div>
  )
}
