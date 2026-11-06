/**
 * Analytical closed-form forward gravity (Cube / Sphere): observation grid + `/api/compute_gravity_analytical`.
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import '../../shared/ForwardGravityView.css'
import { api, type GravityAnalysisResponse } from '../../../../services/api'
import { isForwardAnalysisSupported, isFieldOnlyAnalysisSupported } from '../../lib/forwardAnalysisSupport'
import { buildFieldOnlyAnalysisResult } from '../../lib/fieldOnlyAnalysisResult'
import { isAnalyticalClosedFormModelSupported } from '../../lib/analyticalClosedFormSupport'
import AnalysisResultsView from '../analysis_gravity/AnalysisResultsView'
import GravityResultsView from '../../shared/GravityResultsView'
import { shouldForceSquareGravityMap, type SurfaceBounds } from '../../shared/GravityMapView'
import { quadratureBuildRequest } from '../quadrature_gravity/quadratureBuildRequest'
import { useAnalyticalClosedFormCalculation } from './useAnalyticalClosedFormCalculation'
import { buildForwardGravityAnalysisBodyAsync } from '../../lib/forwardAnalysisRequest'
import { forwardRunGeometryKey } from '../../lib/forwardRunGeometryKey'
import type { ForwardRunMeta } from '../../lib/forwardRunMeta'
import type { ForwardModelParams } from '../../lib/forwardModelParams'

interface AnalyticalClosedFormViewProps extends ForwardModelParams {
  numSourcesX: number
  numSourcesY: number
  numSourcesZ: number
  numReceiversX: number
  numReceiversY: number
  onNumReceiversXChange: (v: number) => void
  onNumReceiversYChange: (v: number) => void
  forwardSurfaceBounds: SurfaceBounds
  lastRunNumReceiversX: number | null
  lastRunNumReceiversY: number | null
  onLastRunNumReceiversSet: (x: number, y: number) => void
  gravityResults: number[]
  setGravityResults: (results: number[]) => void
  calculationTime: number | null
  setCalculationTime: (time: number | null) => void
  lastRunMeta?: ForwardRunMeta | null
  onLastRunMetaSet?: (meta: ForwardRunMeta) => void
}

export default function AnalyticalClosedFormView(props: AnalyticalClosedFormViewProps) {
  const {
    numReceiversX,
    numReceiversY,
    onNumReceiversXChange: setNumReceiversX,
    onNumReceiversYChange: setNumReceiversY,
  } = props

  const calculationInput = { ...props }

  const {
    isCalculating,
    error,
    computeMs,
    gravityResponseMeta,
    fixedMapColorExtent,
    lastRunGeometryKey,
    lastRunParametersSnapshot,
    calculateGravity,
  } = useAnalyticalClosedFormCalculation(calculationInput)

  const currentGeometryKey = forwardRunGeometryKey(
    props,
    props.numSourcesX,
    props.numSourcesY,
    props.numSourcesZ,
    props.forwardSurfaceBounds,
  )
  const persistedGeometryKey = props.lastRunMeta?.geometryKey ?? lastRunGeometryKey
  const analysisGeometryStale =
    props.gravityResults.length > 0 &&
    persistedGeometryKey != null &&
    persistedGeometryKey !== currentGeometryKey
  const analysisNeedsFreshCalculate =
    props.gravityResults.length > 0 && persistedGeometryKey == null
  const isForwardAnalysisModelSupported = isForwardAnalysisSupported(props.modelType)
  const isFieldOnlyAnalysis = isFieldOnlyAnalysisSupported(props.modelType)
  const isModelSupported = isAnalyticalClosedFormModelSupported(props.modelType)
  const [showAnalyticalModelTypeModal, setShowAnalyticalModelTypeModal] = useState(false)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [analysisResult, setAnalysisResult] = useState<GravityAnalysisResponse | null>(null)
  useEffect(() => {
    setShowAnalysis(false)
    setAnalysisResult(null)
    setAnalysisError(null)
  }, [
    props.gravityResults,
    props.modelType,
    props.h,
    props.density,
    props.cubeX,
    props.cubeY,
    props.cubeZ,
    props.sphereRadius,
    numReceiversX,
    numReceiversY,
    props.forwardSurfaceBounds,
  ])

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
      const analysisMethod = 'quadrature_second_order'
      if (isFieldOnlyAnalysis) {
        setAnalysisResult(
          buildFieldOnlyAnalysisResult({
            analysisMethod,
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
      const req = quadratureBuildRequest({
        model: props,
        executionMode: 'reference',
        numThreads: 0,
        simdLanes: 0,
        receiverBlockSize: 0,
        sourceBlockSize: 0,
        numSourcesX: props.numSourcesX,
        numSourcesY: props.numSourcesY,
        numSourcesZ: props.numSourcesZ,
        numReceiversX: analysisNumReceiversX,
        numReceiversY: analysisNumReceiversY,
        surfaceBounds: props.forwardSurfaceBounds,
      })
      const res = await api.computeGravityAnalysis(
        await buildForwardGravityAnalysisBodyAsync(
          { ...req, analysisMethod },
          {
            model: props,
            numSourcesX: props.numSourcesX,
            numSourcesY: props.numSourcesY,
            numSourcesZ: props.numSourcesZ,
            numReceiversX: analysisNumReceiversX,
            numReceiversY: analysisNumReceiversY,
            surfaceBounds: props.forwardSurfaceBounds,
            executionMode: 'reference',
            numThreads: 0,
            simdLanes: 0,
            receiverBlockSize: 0,
            sourceBlockSize: 0,
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

  const handleCalculateClick = () => {
    if (!isModelSupported) {
      setShowAnalyticalModelTypeModal(true)
      return
    }
    void calculateGravity()
  }

  return (
    <div className="forward-solver-container">
      <div className="forward-solver-controls">
        <h3>{props.modelType || 'No Model Selected'}</h3>

        {!props.modelType && (
          <div className="warning-message">Please select a synthetic gravity model first</div>
        )}

        <div className="control-group">
          <span className="help-text">
            Analytical solution uses continuous geometry (Cube or Sphere); source mesh resolution does not affect the result.
          </span>
        </div>

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
              onFocus={(e) => {
                if (numReceiversX === 0) e.target.select()
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
              onFocus={(e) => {
                if (numReceiversY === 0) e.target.select()
              }}
              min="5"
              step="1"
            />
            <span className="help-text">Number of observation points along Y axis</span>
          </label>
        </div>

        <button
          className="calculate-button"
          onClick={handleCalculateClick}
          disabled={isCalculating || !props.modelType || numReceiversX === 0 || numReceiversY === 0}
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

        {error && <div className="error-message">Error: {error}</div>}

        {props.gravityResults.length === 0 && (
          <p className="gravity-no-results-text">
            Configure parameters and click &quot;Calculate Gravity&quot; to see results.
          </p>
        )}
      </div>

      {showAnalysis ? (
        <AnalysisResultsView
          result={analysisResult}
          loading={analysisLoading}
          error={analysisError}
          surfaceBounds={props.forwardSurfaceBounds}
          numReceiversX={
            props.gravityResults.length > 0 && props.lastRunNumReceiversX != null
              ? props.lastRunNumReceiversX
              : numReceiversX
          }
          numReceiversY={
            props.gravityResults.length > 0 && props.lastRunNumReceiversY != null
              ? props.lastRunNumReceiversY
              : numReceiversY
          }
          runParametersSnapshot={lastRunParametersSnapshot}
          fieldOnly={isFieldOnlyAnalysis}
          forceSquareMap={shouldForceSquareGravityMap(props.modelType, props.cubeX, props.cubeY)}
        />
      ) : (
        <GravityResultsView
          gravityResults={props.gravityResults}
          calculationTime={props.calculationTime}
          computeMs={computeMs}
          numSources={null}
          numReceiversX={
            props.gravityResults.length > 0 && props.lastRunNumReceiversX != null
              ? props.lastRunNumReceiversX
              : numReceiversX
          }
          numReceiversY={
            props.gravityResults.length > 0 && props.lastRunNumReceiversY != null
              ? props.lastRunNumReceiversY
              : numReceiversY
          }
          surfaceBounds={props.forwardSurfaceBounds}
          error={error}
          statsInLeftColumn
          resultsTitle="Analytical (closed-form) Results"
          mapTitle="Analytical (closed-form) Gravity Anomaly Map (mGal)"
          emptyMessage='Configure parameters and click "Calculate Gravity" to see results.'
          statsFromFullGrid={gravityResponseMeta?.stats ?? null}
          mapGridNumX={gravityResponseMeta?.mapNx ?? null}
          mapGridNumY={gravityResponseMeta?.mapNy ?? null}
          solverMeta={gravityResponseMeta?.solverMeta ?? null}
          fixedMapColorExtent={fixedMapColorExtent}
          forceSquareMap={shouldForceSquareGravityMap(props.modelType, props.cubeX, props.cubeY)}
        />
      )}
      {showAnalyticalModelTypeModal &&
        createPortal(
          <div
            className="forward-gravity-modal-overlay"
            onClick={() => setShowAnalyticalModelTypeModal(false)}
          >
            <div className="forward-gravity-modal" onClick={(e) => e.stopPropagation()}>
              <div className="forward-gravity-modal-header">
                <h2 className="forward-gravity-modal-title">Unsupported Model Type for Analytical</h2>
                <button
                  type="button"
                  className="forward-gravity-modal-close"
                  onClick={() => setShowAnalyticalModelTypeModal(false)}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div style={{ padding: '18px 20px 20px 20px', color: '#374151', lineHeight: 1.5 }}>
                Analytical closed-form supports <strong>Cube</strong> and <strong>Sphere</strong> catalog models only.
                For Valley–Mountain and other shapes, use Quadrature second order.
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
