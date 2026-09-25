/**
 * AMFM (adaptive fast-multipole) forward-modeling page: model picker, parameters, run, and gravity results map.
 *
 * Composes shared `GravityResultsView` with AMFM-specific controls and `useAmfmCalculation` for the backend call.
 */
import { useEffect, useState } from 'react'
import '../../shared/ForwardGravityView.css'
import { api, type GravityAnalysisResponse } from '../../../../services/api'
import AnalysisResultsView from '../analysis_gravity/AnalysisResultsView'
import GravityResultsView from '../../shared/GravityResultsView'
import { shouldForceSquareGravityMap, type SurfaceBounds } from '../../shared/GravityMapView'
import { amfmBuildRequest, type AmfmModelParams } from './amfmBuildRequest'
import { isRectangularPrismGravityModel } from '../../lib/gravityModelKinds'
import {
  AMFM_DEFAULT_CRITICAL_DISTANCE_FACTOR,
  AMFM_DEFAULT_CRITICAL_DISTANCE_FACTOR_RECTANGULAR_PRISM,
  AMFM_DEFAULT_MAX_DEPTH,
  AMFM_DEFAULT_MAX_DEPTH_RECTANGULAR_PRISM,
  AMFM_DEFAULT_MAX_SOURCES_PER_NODE,
  AMFM_DEFAULT_MAX_SOURCES_PER_NODE_RECTANGULAR_PRISM,
} from './amfmConstants'
import { isForwardAnalysisSupported, isFieldOnlyAnalysisSupported } from '../../lib/forwardAnalysisSupport'
import { buildFieldOnlyAnalysisResult } from '../../lib/fieldOnlyAnalysisResult'
import { isGmshTetrahedralModel } from '../../../synthetic-gravity/lib/gmshMeshSupport'
import { useAmfmCalculation } from './amfmCalculation'
import { buildForwardGravityAnalysisBodyAsync } from '../../lib/forwardAnalysisRequest'
import { forwardRunGeometryKey } from '../../lib/forwardRunGeometryKey'
import type { ForwardRunMeta } from '../../lib/forwardRunMeta'

// --- Props: synthetic model + source/receiver counts from app shell ---

interface AMFMViewProps extends AmfmModelParams {
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
}

// --- Page: AMFM hook + left controls + shared results/map ---

export default function AMFMView(props: AMFMViewProps) {
  const {
    numSourcesX,
    numSourcesY,
    numSourcesZ,
    numReceiversX,
    numReceiversY,
    onNumReceiversXChange: setNumReceiversX,
    onNumReceiversYChange: setNumReceiversY,
  } = props
  const [criticalDistanceFactor, setCriticalDistanceFactor] = useState(() =>
    isRectangularPrismGravityModel(props.modelType)
      ? AMFM_DEFAULT_CRITICAL_DISTANCE_FACTOR_RECTANGULAR_PRISM
      : AMFM_DEFAULT_CRITICAL_DISTANCE_FACTOR
  )
  const [maxDepth, setMaxDepth] = useState(() =>
    isRectangularPrismGravityModel(props.modelType)
      ? AMFM_DEFAULT_MAX_DEPTH_RECTANGULAR_PRISM
      : AMFM_DEFAULT_MAX_DEPTH
  )
  const [maxSourcesPerNode, setMaxSourcesPerNode] = useState(() =>
    isRectangularPrismGravityModel(props.modelType)
      ? AMFM_DEFAULT_MAX_SOURCES_PER_NODE_RECTANGULAR_PRISM
      : AMFM_DEFAULT_MAX_SOURCES_PER_NODE
  )

  useEffect(() => {
    const prism = isRectangularPrismGravityModel(props.modelType)
    setCriticalDistanceFactor(
      prism ? AMFM_DEFAULT_CRITICAL_DISTANCE_FACTOR_RECTANGULAR_PRISM : AMFM_DEFAULT_CRITICAL_DISTANCE_FACTOR
    )
    setMaxDepth(prism ? AMFM_DEFAULT_MAX_DEPTH_RECTANGULAR_PRISM : AMFM_DEFAULT_MAX_DEPTH)
    setMaxSourcesPerNode(
      prism ? AMFM_DEFAULT_MAX_SOURCES_PER_NODE_RECTANGULAR_PRISM : AMFM_DEFAULT_MAX_SOURCES_PER_NODE
    )
  }, [props.modelType])
  useEffect(() => {
    setShowAnalysis(false)
    setAnalysisResult(null)
    setAnalysisError(null)
  }, [props.gravityResults, props.modelType])

  const isForwardAnalysisModelSupported = isForwardAnalysisSupported(props.modelType)
  const isFieldOnlyAnalysis = isFieldOnlyAnalysisSupported(props.modelType)

  const criticalDistanceFallback = isRectangularPrismGravityModel(props.modelType)
    ? AMFM_DEFAULT_CRITICAL_DISTANCE_FACTOR_RECTANGULAR_PRISM
    : AMFM_DEFAULT_CRITICAL_DISTANCE_FACTOR
  const maxDepthFallback = isRectangularPrismGravityModel(props.modelType)
    ? AMFM_DEFAULT_MAX_DEPTH_RECTANGULAR_PRISM
    : AMFM_DEFAULT_MAX_DEPTH
  const maxSourcesPerNodeFallback = isRectangularPrismGravityModel(props.modelType)
    ? AMFM_DEFAULT_MAX_SOURCES_PER_NODE_RECTANGULAR_PRISM
    : AMFM_DEFAULT_MAX_SOURCES_PER_NODE

  const {
    isCalculating,
    error,
    computeMs,
    gravityResponseMeta,
    fixedMapColorExtent,
    lastRunGeometryKey,
    lastRunParametersSnapshot,
    calculateGravity,
  } = useAmfmCalculation({
    ...props,
    criticalDistanceFactor,
    maxDepth,
    maxSourcesPerNode,
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
            analysisMethod: 'amfm',
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
      const req = amfmBuildRequest({
        model: props,
        numSourcesX: props.numSourcesX,
        numSourcesY: props.numSourcesY,
        numSourcesZ: props.numSourcesZ,
        numReceiversX: analysisNumReceiversX,
        numReceiversY: analysisNumReceiversY,
        surfaceBounds: props.forwardSurfaceBounds,
        criticalDistanceFactor,
        maxDepth,
        maxSourcesPerNode,
      })
      const res = await api.computeGravityAnalysis(
        await buildForwardGravityAnalysisBodyAsync(
          { ...req, analysisMethod: 'amfm' },
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

  const isGmshTetra = isGmshTetrahedralModel(props.modelType)
  const meshCountsRequired = !isGmshTetra

  const getModelName = () => {
    return props.modelType || 'No Model Selected'
  }

  return (
    <div className="forward-solver-container">
      {/* --- Observation grid, octree / multipole params, run --- */}
      <div className="forward-solver-controls">
        <h3>{getModelName()}</h3>

        {!props.modelType && (
          <div className="warning-message">
            Please select a synthetic gravity model first
          </div>
        )}

        <div className="control-group">
          <label>
            Observation Points X:
            <input
              type="number"
              value={numReceiversX === 0 ? '' : numReceiversX}
              onChange={(e) => {
                const val = e.target.value
                setNumReceiversX(val === '' ? 0 : parseInt(val) || 0)
              }}
              min="5"
              step="1"
            />
            <span className="help-text">Number of observation points along X axis</span>
          </label>
        </div>

        <div className="control-group">
          <label>
            Observation Points Y:
            <input
              type="number"
              value={numReceiversY === 0 ? '' : numReceiversY}
              onChange={(e) => {
                const val = e.target.value
                setNumReceiversY(val === '' ? 0 : parseInt(val) || 0)
              }}
              min="5"
              step="1"
            />
            <span className="help-text">Number of observation points along Y axis</span>
          </label>
        </div>

        <div className="control-group">
          <label>
            Critical Distance Factor:
            <input
              type="number"
              value={criticalDistanceFactor}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                setCriticalDistanceFactor(Number.isFinite(v) ? v : criticalDistanceFallback)
              }}
              min="1.0"
              max="5.0"
              step="0.1"
            />
            <span className="help-text">
              {isRectangularPrismGravityModel(props.modelType)
                ? 'Cuboid/prism: defaults favor direct near-field (≥3.5) vs multipole far-field. Ellipsoids stay isotropic; elongated boxes need this so the map matches Newton. API enforces floors for prism.'
                : 'Factor for near-field/far-field boundary (2.0–3.0 typical). Higher = more direct near-field.'}
            </span>
          </label>
        </div>

        <div className="control-group">
          <label>
            Max Octree Depth:
            <input
              type="number"
              value={maxDepth}
              onChange={(e) => setMaxDepth(parseInt(e.target.value, 10) || maxDepthFallback)}
              min="5"
              max="20"
              step="1"
            />
            <span className="help-text">
              {isRectangularPrismGravityModel(props.modelType)
                ? 'Prism default 12 (deeper tree for elongated geometry). API uses at least 12 for cuboid/prism.'
                : 'Maximum depth of the octree (5–20 recommended).'}
            </span>
          </label>
        </div>

        <div className="control-group">
          <label>
            Max Sources Per Node:
            <input
              type="number"
              value={maxSourcesPerNode}
              onChange={(e) =>
                setMaxSourcesPerNode(parseInt(e.target.value, 10) || maxSourcesPerNodeFallback)
              }
              min="16"
              max="1024"
              step="1"
            />
            <span className="help-text">
              {isRectangularPrismGravityModel(props.modelType)
                ? 'Prism default 128 (finer nodes). API caps at 128 for cuboid/prism to reduce multipole error along long axes.'
                : 'Maximum sources per octree node before subdivision.'}
            </span>
          </label>
        </div>

        <button
          className="calculate-button"
          onClick={calculateGravity}
          disabled={isCalculating || !props.modelType || (meshCountsRequired && (numSourcesX === 0 || numSourcesY === 0 || numSourcesZ === 0)) || numReceiversX === 0 || numReceiversY === 0}
        >
          {isCalculating ? 'Calculating...' : 'Calculate Gravity'}
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

        {error && (
          <div className="error-message">
            Error: {error}
          </div>
        )}

        {props.gravityResults.length === 0 && (
          <p className="gravity-no-results-text">Configure parameters and click &quot;Calculate Gravity&quot; to see results.</p>
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
          resultsTitle="AMF+ Advanced Newton Results"
          mapTitle="AMF+ Advanced Newton Gravity Anomaly Map (mGal)"
          emptyMessage='Configure parameters and click "Calculate Gravity" to see AMF+ Advanced Newton results.'
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
