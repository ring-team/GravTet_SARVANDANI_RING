/**
 * Direct Newton forward-modeling page: model parameters, SIMD/thread mode, run, and gravity anomaly map.
 *
 * Uses shared results chrome with Newton-specific execution controls and `useDirectNewtonCalculation`.
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import '../../shared/ForwardGravityView.css'
import { api, type GravityAnalysisResponse } from '../../../../services/api'
import { isForwardAnalysisSupported, isFieldOnlyAnalysisSupported } from '../../lib/forwardAnalysisSupport'
import { buildFieldOnlyAnalysisResult } from '../../lib/fieldOnlyAnalysisResult'
import { isAnalyticalClosedFormModelSupported } from '../../lib/analyticalClosedFormSupport'
import { isTetrahedralModel } from '../../../synthetic-gravity/lib/gmshMeshSupport'
import AnalysisResultsView from '../analysis_gravity/AnalysisResultsView'
import GravityResultsView from '../../shared/GravityResultsView'
import { shouldForceSquareGravityMap, type SurfaceBounds } from '../../shared/GravityMapView'
import { directNewtonBuildRequest, type DirectNewtonModelParams, directNewtonEstimateSourceCount } from './directNewtonBuildRequest'
import { useDirectNewtonCalculation } from './directNewtonCalculation'
import { buildForwardGravityAnalysisBodyAsync } from '../../lib/forwardAnalysisRequest'
import { forwardRunGeometryKey } from '../../lib/forwardRunGeometryKey'
import type { ForwardRunMeta } from '../../lib/forwardRunMeta'
import { resolveForwardSourceCount } from '../../lib/forwardSourceEstimate'

// --- Props: execution mode + shared forward grid from app shell ---

interface DirectNewtonViewProps extends DirectNewtonModelParams {
  solverKind?: 'direct_newton' | 'analytical_closedform'
  executionMode: 'reference' | 'tiled' | 'simd_tiled' | 'simd_tiled_threading'
  /** Optional thread count override for simd_tiled_threading (strong scaling). */
  numThreads?: number
  gravityResults: number[]
  setGravityResults: (results: number[]) => void
  calculationTime: number | null
  setCalculationTime: (time: number | null) => void
  /** Shared forward-gravity params (controlled by parent); same for all methods */
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
  /** Shared map extent so it does not change when switching method or observation points */
  forwardSurfaceBounds: SurfaceBounds
  /** Grid size from this method’s last run (persisted in parent so it survives view switch) */
  lastRunNumReceiversX: number | null
  lastRunNumReceiversY: number | null
  onLastRunNumReceiversSet: (x: number, y: number) => void
  lastRunMeta?: ForwardRunMeta | null
  onLastRunMetaSet?: (meta: ForwardRunMeta) => void
  gmshCachedElementCount?: number | null
}

// --- Page: direct summation hook + controls + shared results/map ---

export default function DirectNewtonView(props: DirectNewtonViewProps) {
  const {
    numSourcesX,
    numSourcesY,
    numSourcesZ,
    numReceiversX,
    numReceiversY,
    onNumReceiversXChange: setNumReceiversX,
    onNumReceiversYChange: setNumReceiversY,
  } = props

  const isAnalytical = props.solverKind === 'analytical_closedform'

  const hwConcurrency = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 1 : 1
  const [selectedNumThreads, setSelectedNumThreads] = useState<number>(hwConcurrency)
  const [receiverBlockSize, setReceiverBlockSize] = useState<number>(64)
  const [sourceBlockSize, setSourceBlockSize] = useState<number>(128)

  useEffect(() => {
    setSelectedNumThreads((prev) => {
      if (typeof navigator === 'undefined') return prev
      const hw = navigator.hardwareConcurrency || 1
      return prev >= 1 && prev <= hw ? prev : hw
    })
  }, [])

  const shouldShowThreadPicker = !isAnalytical && props.executionMode === 'simd_tiled_threading'
  const shouldShowBlockPicker =
    !isAnalytical &&
    (props.executionMode === 'tiled' ||
      props.executionMode === 'simd_tiled' ||
      props.executionMode === 'simd_tiled_threading')
  const nReceivers = Math.max(1, numReceiversX * numReceiversY)
  const nSourcesMax = Math.max(
    1,
    resolveForwardSourceCount(
      props.modelType,
      numSourcesX,
      numSourcesY,
      numSourcesZ,
      props.gmshCachedElementCount,
    ) || directNewtonEstimateSourceCount(props.modelType, numSourcesX, numSourcesY, numSourcesZ),
  )

  useEffect(() => {
    setReceiverBlockSize((prev) => {
      const next = prev <= 0 ? Math.min(64, nReceivers) : Math.min(prev, nReceivers)
      return Math.max(1, next)
    })
    setSourceBlockSize((prev) => {
      const next = prev <= 0 ? Math.min(128, nSourcesMax) : Math.min(prev, nSourcesMax)
      return Math.max(1, next)
    })
  }, [nReceivers, nSourcesMax])

  const calculationInput = {
    ...props,
    numThreads: shouldShowThreadPicker ? selectedNumThreads : 0,
    receiverBlockSize: shouldShowBlockPicker ? Math.min(Math.max(1, receiverBlockSize), nReceivers) : 0,
    sourceBlockSize: shouldShowBlockPicker ? Math.min(Math.max(1, sourceBlockSize), nSourcesMax) : 0,
  }

  const {
    isCalculating,
    error,
    computeMs,
    numSources,
    gravityResponseMeta,
    fixedMapColorExtent,
    lastRunGeometryKey,
    lastRunParametersSnapshot,
    calculateGravity,
  } = useDirectNewtonCalculation(calculationInput)

  const nSourcesCap = Math.max(1, (numSources != null && numSources > 0 ? numSources : nSourcesMax))

  useEffect(() => {
    setSourceBlockSize((prev) => Math.max(1, Math.min(prev, nSourcesCap)))
  }, [nSourcesCap])

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
  const isForwardAnalysisModelSupported = isForwardAnalysisSupported(props.modelType)
  const isFieldOnlyAnalysis = isFieldOnlyAnalysisSupported(props.modelType)
  const isAnalyticalModelTypeSupported = isAnalyticalClosedFormModelSupported(props.modelType)
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
    numSourcesX,
    numSourcesY,
    numSourcesZ,
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
      const analysisMethod = 'direct_newton'
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
      const req = directNewtonBuildRequest({
        model: props,
        executionMode: props.executionMode,
        numThreads: shouldShowThreadPicker ? selectedNumThreads : 0,
        receiverBlockSize: shouldShowBlockPicker ? receiverBlockSize : 0,
        sourceBlockSize: shouldShowBlockPicker ? sourceBlockSize : 0,
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
            executionMode: props.executionMode,
            numThreads: shouldShowThreadPicker ? selectedNumThreads : 0,
            receiverBlockSize: shouldShowBlockPicker ? receiverBlockSize : 0,
            sourceBlockSize: shouldShowBlockPicker ? sourceBlockSize : 0,
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

  const isTetrahedral = isTetrahedralModel(props.modelType)
  const meshCountsRequired = !isAnalytical && !isTetrahedral

  const getModelName = () => {
    return props.modelType || 'No Model Selected'
  }

  const handleCalculateClick = () => {
    if (isAnalytical && !isAnalyticalModelTypeSupported) {
      setShowAnalyticalModelTypeModal(true)
      return
    }
    void calculateGravity()
  }

  return (
    <div className="forward-solver-container">
      {/* --- Observation grid, run, inline stats --- */}
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
                const val = e.target.value;
                setNumReceiversX(val === '' ? 0 : parseInt(val) || 0);
              }}
              onFocus={(e) => {
                if (numReceiversX === 0) {
                  e.target.select();
                }
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
                const val = e.target.value;
                setNumReceiversY(val === '' ? 0 : parseInt(val) || 0);
              }}
              onFocus={(e) => {
                if (numReceiversY === 0) {
                  e.target.select();
                }
              }}
              min="5"
              step="1"
            />
            <span className="help-text">Number of observation points along Y axis</span>
          </label>
        </div>
        {isAnalytical && (
          <div className="control-group">
            <span className="help-text">Analytical method ignores source mesh resolution.</span>
          </div>
        )}

        {shouldShowThreadPicker && (
          <div className="control-group">
            <label>
              Thread count (P):
              <span className="help-text">Used for SIMDTiledThreading (strong scaling)</span>
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: 8,
                paddingTop: 4,
                paddingBottom: 8,
                maxHeight: 180,
                overflowY: 'auto',
              }}
            >
              {Array.from(
                { length: Math.max(1, (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 1) || 1) },
                (_, i) => i + 1
              ).map((t) => (
                <label
                  key={t}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    color: '#374151',
                    userSelect: 'none',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedNumThreads === t}
                    onChange={() => setSelectedNumThreads(t)}
                  />
                  {t}
                </label>
              ))}
            </div>
          </div>
        )}
        {shouldShowBlockPicker && (
          <div className="control-group">
            <label>
              Receiver block size (B<sub>r</sub>):
              <input
                type="number"
                value={receiverBlockSize === 0 ? '' : receiverBlockSize}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === '') {
                    setReceiverBlockSize(0)
                    return
                  }
                  const n = parseInt(val, 10)
                  if (!Number.isFinite(n) || n < 0) return
                  setReceiverBlockSize(Math.min(nReceivers, n))
                }}
                onBlur={() => {
                  if (receiverBlockSize < 1) setReceiverBlockSize(1)
                  else setReceiverBlockSize(Math.min(nReceivers, Math.max(1, receiverBlockSize)))
                }}
                min={1}
                max={nReceivers}
                step={1}
              />
            </label>
            <label>
              Source block size (B<sub>s</sub>):
              <input
                type="number"
                value={sourceBlockSize === 0 ? '' : sourceBlockSize}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === '') {
                    setSourceBlockSize(0)
                    return
                  }
                  const n = parseInt(val, 10)
                  if (!Number.isFinite(n) || n < 0) return
                  setSourceBlockSize(Math.min(nSourcesCap, n))
                }}
                onBlur={() => {
                  if (sourceBlockSize < 1) setSourceBlockSize(1)
                  else setSourceBlockSize(Math.min(nSourcesCap, Math.max(1, sourceBlockSize)))
                }}
                min={1}
                max={nSourcesCap}
                step={1}
              />
            </label>
          </div>
        )}

        <button
          className="calculate-button"
          onClick={handleCalculateClick}
          disabled={isCalculating || !props.modelType || (meshCountsRequired && (numSourcesX === 0 || numSourcesY === 0 || numSourcesZ === 0)) || numReceiversX === 0 || numReceiversY === 0}
        >
          {isCalculating ? 'Calculating...' : 'Calculate Gravity'}
        </button>
        {!isAnalytical && isForwardAnalysisModelSupported && (
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
      {!isAnalytical && showAnalysis ? (
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
          numSources={numSources}
          numReceiversX={props.gravityResults.length > 0 && props.lastRunNumReceiversX != null ? props.lastRunNumReceiversX : numReceiversX}
          numReceiversY={props.gravityResults.length > 0 && props.lastRunNumReceiversY != null ? props.lastRunNumReceiversY : numReceiversY}
          surfaceBounds={props.forwardSurfaceBounds}
          error={error}
          statsInLeftColumn
          resultsTitle={
            isAnalytical
              ? 'Analytical (closed-form) Results'
              : props.executionMode === 'reference'
              ? 'Direct Newton (reference) Results'
              : props.executionMode === 'tiled'
              ? 'Direct Newton (tiled) Results'
              : props.executionMode === 'simd_tiled'
              ? 'Direct Newton (SIMDTiled) Results'
              : 'Direct Newton (SIMDTiledThreading) Results'
          }
          mapTitle={
            isAnalytical
              ? 'Analytical (closed-form) Gravity Anomaly Map (mGal)'
              : 'Direct Newton Gravity Anomaly Map (mGal)'
          }
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
                 (Analytical and non-tetra mesh types hidden in this GravTet release.)
                Please choose a supported model and try again.
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
