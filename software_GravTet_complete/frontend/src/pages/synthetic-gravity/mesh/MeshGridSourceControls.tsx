/**
 * **Mesh grid UI** for the synthetic forward-model panel: either explicit source counts (structured mesh)
 * or “unstructured” proxy sliders (target element size, refinement, …) that map to parent `numSourcesX/Y/Z`.
 *
 * Unstructured proxy sliders can be lifted to App (`sharedUnstructuredMesh`) so they persist
 * across header navigation and model changes, like `forwardNumSourcesX/Y/Z`.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  GMSH_MESH_UNSUPPORTED_SHAPE_MESSAGE,
  isGmshMeshBuildSupported,
  isTetrahedralModel,
  usesProxyMeshSizeSliders,
  type GmshMeshBuildStats,
} from '../lib/gmshMeshSupport'
import { estimateMeshElementCount } from '../lib/tetraMeshSourceEstimate'
import { getDefaultForwardSourceCounts } from '../default_data/defaultSources'
import { getProxyMeshSliderDefaults } from './unstructuredMeshSliderDefaults'

export type MeshGridSourceVariant = 'box' | 'sphere' | 'verticalCylinder' | 'horizontalCylinder'

/**
 * Parse numeric text from `<input>`; EU-style decimals like `1,46` must not use raw
 * `parseFloat` (which returns `1` and breaks mesh proxy monotonicity vs what the user sees).
 */
function parseDecimalInput(raw: string, fallback: number): number {
  let t = raw.trim().replace(/\s/g, '')
  if (t === '' || t === '-' || t === '.' || t === '-.') return fallback
  if (t.includes(',') && !t.includes('.')) {
    t = t.replace(/,/g, '.')
  } else if (t.includes(',') && t.includes('.')) {
    const lastComma = t.lastIndexOf(',')
    const lastDot = t.lastIndexOf('.')
    if (lastComma > lastDot) {
      t = t.replace(/\./g, '').replace(',', '.')
    } else {
      t = t.replace(/,/g, '')
    }
  }
  const n = Number(t)
  return Number.isFinite(n) ? n : fallback
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9
}

/** Dot decimal text for display; JS `toString()` is locale-independent. */
function formatDecimalFieldValue(value: number): string {
  if (!Number.isFinite(value)) return ''
  return value.toString()
}

type DotDecimalNumberInputProps = {
  value: number
  onChange: (value: number) => void
  min?: number
  step?: number
}

/**
 * Dot-decimal text field + native `type="number"` overlay for steppers only.
 * OS locale can render `2,26` on a plain number input; the text field always shows `2.26`.
 */
function DotDecimalNumberInput({ value, onChange, min, step = 0.05 }: DotDecimalNumberInputProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const editing = draft !== null

  const commitValue = (nextRaw: number) => {
    if (!Number.isFinite(nextRaw)) return
    const next = min != null ? Math.max(min, nextRaw) : nextRaw
    if (nearlyEqual(next, value)) return
    onChange(next)
  }

  return (
    <div className="control-number-field">
      <input
        type="text"
        inputMode="decimal"
        lang="en-US"
        className="control-number-field__text"
        value={editing ? draft! : formatDecimalFieldValue(value)}
        onFocus={() => setDraft(formatDecimalFieldValue(value))}
        onChange={(e) => {
          const raw = e.target.value
          setDraft(raw)
          if (raw === '' || raw === '-' || raw === '.' || raw === '-.') return
          commitValue(parseDecimalInput(raw, value))
        }}
        onBlur={() => {
          if (editing) {
            const raw = draft ?? ''
            if (raw !== '' && raw !== '-' && raw !== '.' && raw !== '-.') {
              commitValue(parseDecimalInput(raw, value))
            }
          }
          setDraft(null)
        }}
      />
      <input
        type="number"
        lang="en-US"
        className="control-number-field__spinner"
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        min={min}
        step={step}
        onChange={(e) => {
          const raw = e.target.value
          if (raw === '') return
          setDraft(null)
          commitValue(parseDecimalInput(raw, value))
        }}
      />
    </div>
  )
}

const LABELS: Record<MeshGridSourceVariant, { x: string; y: string; z: string }> = {
  box: {
    x: 'Sources along X',
    y: 'Sources along Y',
    z: 'Sources along Z',
  },
  sphere: {
    x: 'Sources (radial r)',
    y: 'Sources (θ, azimuth)',
    z: 'Sources (φ, colatitude)',
  },
  verticalCylinder: {
    x: 'Sources (r, radial)',
    y: 'Sources (θ, azimuth)',
    z: 'Sources (z, axis)',
  },
  horizontalCylinder: {
    x: 'Sources (r, radial)',
    y: 'Sources (θ, azimuth)',
    z: 'Sources (length)',
  },
}

const AXIS_SYMBOLS: Record<MeshGridSourceVariant, { x: string; y: string; z: string }> = {
  box: { x: 'X', y: 'Y', z: 'Z' },
  sphere: { x: 'r', y: 'θ', z: 'φ' },
  verticalCylinder: { x: 'r', y: 'θ', z: 'z' },
  horizontalCylinder: { x: 'r', y: 'θ', z: 'length' },
}

/** Lifted to `App` so unstructured / Gmsh sliders survive view / model switches (optional). */
export type SharedUnstructuredMeshSliders = {
  targetElementSize: number
  surfaceRefinement: number
  localRefinementNearEdges: number
  setTargetElementSize: (v: number) => void
  setSurfaceRefinement: (v: number) => void
  setLocalRefinementNearEdges: (v: number) => void
  gmshLastBuildStats?: GmshMeshBuildStats | null
  gmshPreviewLoading?: boolean
}

export interface MeshGridSourceControlsProps {
  modelType?: string | null
  variant: MeshGridSourceVariant
  numSourcesX: number
  numSourcesY: number
  numSourcesZ: number
  onNumSourcesXChange: (value: number) => void
  onNumSourcesYChange: (value: number) => void
  onNumSourcesZChange: (value: number) => void
  sharedUnstructuredMesh?: SharedUnstructuredMeshSliders
}

export function MeshGridSourceControls({
  modelType,
  variant,
  numSourcesX,
  numSourcesY,
  numSourcesZ,
  onNumSourcesXChange,
  onNumSourcesYChange,
  onNumSourcesZChange,
  sharedUnstructuredMesh: u,
}: MeshGridSourceControlsProps) {
  const L = LABELS[variant]
  const axisSymbols = AXIS_SYMBOLS[variant]
  const baseSourceCount = useMemo(() => {
    const nx = Math.max(0, Math.round(numSourcesX || 0))
    const ny = Math.max(0, Math.round(numSourcesY || 0))
    const nz = Math.max(0, Math.round(numSourcesZ || 0))
    return nx * ny * nz
  }, [numSourcesX, numSourcesY, numSourcesZ])
  const usesProxySliders = useMemo(() => usesProxyMeshSizeSliders(modelType), [modelType])
  const isTetrahedral = useMemo(() => isTetrahedralModel(modelType), [modelType])
  const usesProxyGridPreview = isTetrahedral
  const gmshPreviewLoading = Boolean(u?.gmshPreviewLoading)
  const gmshSourceCount = u?.gmshLastBuildStats?.numElements ?? null
  const baseModel = useMemo(() => (modelType || '').split(' - ')[0], [modelType])
  const isSphere = baseModel === 'Sphere'
  const isEllipsoid = baseModel === 'Ellipsoid'
  const isUnstructuredPoly = false

  // Baseline anchor to prevent self-amplifying feedback loops:
  // - for unstructured mode we pin to catalog defaults for determinism
  // - for structured mode we keep current counts
  const baselineCountsRef = useRef({ x: numSourcesX, y: numSourcesY, z: numSourcesZ })
  // Must start undefined so the first sync always runs. If we init with `modelType`,
  // `prev === modelType` on mount and we never copy props → stale counts from another
  // object can leak into the unstructured proxy mapping for Sphere/Ellipsoid.
  const prevModelTypeRef = useRef<string | null | undefined>(undefined)
  useLayoutEffect(() => {
    if (prevModelTypeRef.current !== modelType) {
      if (modelType && isTetrahedral) {
        const d = getDefaultForwardSourceCounts(modelType)
        baselineCountsRef.current = { x: d.numSourcesX, y: d.numSourcesY, z: d.numSourcesZ }
      } else {
        baselineCountsRef.current = { x: numSourcesX, y: numSourcesY, z: numSourcesZ }
      }
      prevModelTypeRef.current = modelType
    }
  }, [modelType, numSourcesX, numSourcesY, numSourcesZ])

  const useSharedProxySliders = Boolean(usesProxySliders && u)

  const [localTargetElementSize, setLocalTargetElementSize] = useState<number>(2)
  const [localSurfaceRefinement, setLocalSurfaceRefinement] = useState<number>(0.25)
  const [localLocalRefinementNearEdges, setLocalLocalRefinementNearEdges] = useState<number>(0.25)

  const targetElementSize = useSharedProxySliders ? u!.targetElementSize : localTargetElementSize
  const surfaceRefinement = useSharedProxySliders ? u!.surfaceRefinement : localSurfaceRefinement
  const localRefinementNearEdges = useSharedProxySliders ? u!.localRefinementNearEdges : localLocalRefinementNearEdges
  const displayedSourceCount = useMemo(() => {
    if (isTetrahedral) {
      return gmshSourceCount
    }
    if (usesProxySliders && modelType) {
      return estimateMeshElementCount(modelType, numSourcesX, numSourcesY, numSourcesZ)
    }
    return baseSourceCount
  }, [
    isTetrahedral,
    gmshSourceCount,
    usesProxySliders,
    modelType,
    numSourcesX,
    numSourcesY,
    numSourcesZ,
    baseSourceCount,
  ])

  useEffect(() => {
    if (!usesProxySliders || useSharedProxySliders) return
    const d = getProxyMeshSliderDefaults(modelType)
    if (!d) return
    setLocalTargetElementSize(d.targetElementSize)
    setLocalSurfaceRefinement(d.surfaceRefinement)
    setLocalLocalRefinementNearEdges(d.localRefinementNearEdges)
  }, [usesProxySliders, modelType, useSharedProxySliders])

  /**
   * Map unstructured sliders → proxy numSources. Call from slider onChange, or from the
   * catalog-default sync below (full explicit overrides only).
   */
  type UnstructOverride = Partial<{
    targetElementSize: number
    surfaceRefinement: number
    localRefinementNearEdges: number
  }>

  const pushUnstructuredProxy = useCallback(
    (override: UnstructOverride = {}) => {
      if (!usesProxyGridPreview) return

      // Ceil keeps grid dimensions (weakly) monotone in refinement: small changes
      // in target size no longer flip totals downward due to `Math.round` at .5 boundaries.
      const meshDimFromScale = (n: number, lo: number) => Math.max(lo, Math.ceil(n - 1e-9))
      const base = baselineCountsRef.current

      const te = override.targetElementSize ?? targetElementSize
      const sr = override.surfaceRefinement ?? surfaceRefinement
      const lr = override.localRefinementNearEdges ?? localRefinementNearEdges
      const catalog = getProxyMeshSliderDefaults(modelType)
      const mq = catalog?.meshQuality ?? 0.75

      // Drive refinement from the visible target size (model units, typically m).
      // Tiny positive floor avoids div-by-zero only.
      const effectiveTarget = Math.max(1e-3, te)
      const refinementExponent =
        isSphere
          ? isUnstructuredPoly
            ? 0.85
            : 0.82
          : isEllipsoid
            ? 1.0
            : 0.9
      const refinement = Math.pow(1 / Math.max(1e-6, effectiveTarget), refinementExponent)
      const maxRefinement = isSphere ? (isUnstructuredPoly ? 6 : 5) : isEllipsoid ? 9 : 8
      // Lower floor was 0.25, which blocked very coarse meshes; tiny floor avoids div-by-zero while allowing large elements.
      const refinementClamped = Math.max(0.04, Math.min(maxRefinement, refinement))

      const surfaceMultiplier = 1 + sr * (isSphere ? (isUnstructuredPoly ? 0.46 : 0.4) : isEllipsoid ? 0.8 : 0.75)
      const edgeMultiplier = 1 + lr * (isSphere ? (isUnstructuredPoly ? 0.46 : 0.4) : isEllipsoid ? 0.8 : 0.75)
      const q = Math.max(0, Math.min(1, mq))
      const qualityMultiplier =
        isSphere
          ? isUnstructuredPoly
            ? 0.92 + q * 0.14
            : 0.9 + q * 0.1
          : isEllipsoid
            ? 0.85 + q * 0.35
            : 0.9 + q * 0.28

      // Keep deterministic output for identical visible parameters.
      const seedMultiplier = 1.0

      const nextX = meshDimFromScale(base.x * refinementClamped * edgeMultiplier * qualityMultiplier * seedMultiplier, 1)
      const nextY = meshDimFromScale(base.y * refinementClamped * surfaceMultiplier * qualityMultiplier * seedMultiplier, 1)
      const nextZ = meshDimFromScale(base.z * refinementClamped * surfaceMultiplier * qualityMultiplier * seedMultiplier, 1)

      if (nextX !== numSourcesX) onNumSourcesXChange(nextX)
      if (nextY !== numSourcesY) onNumSourcesYChange(nextY)
      if (nextZ !== numSourcesZ) onNumSourcesZChange(nextZ)
    },
    [
      usesProxyGridPreview,
      isSphere,
      isEllipsoid,
      isUnstructuredPoly,
      modelType,
      targetElementSize,
      surfaceRefinement,
      localRefinementNearEdges,
      numSourcesX,
      numSourcesY,
      numSourcesZ,
      onNumSourcesXChange,
      onNumSourcesYChange,
      onNumSourcesZChange,
    ],
  )

  /**
   * Lifted sliders (`sharedUnstructuredMesh`): re-apply proxy when model or slider values change.
   * Do not depend on numSourcesX/Y/Z here — that caused extra proxy/Gmsh preview churn when
   * counts were updated as the output of the same mapping.
   */
  useEffect(() => {
    if (!usesProxyGridPreview || !modelType || !u) return
    pushUnstructuredProxy({
      targetElementSize: u.targetElementSize,
      surfaceRefinement: u.surfaceRefinement,
      localRefinementNearEdges: u.localRefinementNearEdges,
    })
  }, [
    usesProxyGridPreview,
    modelType,
    u?.targetElementSize,
    u?.surfaceRefinement,
    u?.localRefinementNearEdges,
    pushUnstructuredProxy,
  ])

  /**
   * Local-only sliders: if counts still match catalog defaults, apply file defaults once.
   */
  useEffect(() => {
    if (!usesProxyGridPreview || !modelType || u) return
    const d = getDefaultForwardSourceCounts(modelType)
    if (
      numSourcesX !== d.numSourcesX ||
      numSourcesY !== d.numSourcesY ||
      numSourcesZ !== d.numSourcesZ
    ) {
      return
    }
    const defaults = getProxyMeshSliderDefaults(modelType)
    if (!defaults) return
    queueMicrotask(() => {
      pushUnstructuredProxy({
        targetElementSize: defaults.targetElementSize,
        surfaceRefinement: defaults.surfaceRefinement,
        localRefinementNearEdges: defaults.localRefinementNearEdges,
      })
    })
  }, [usesProxyGridPreview, modelType, numSourcesX, numSourcesY, numSourcesZ, pushUnstructuredProxy, u])

  const formatSourceCount = (value: number) => value.toLocaleString()

  const tetraSourceCountLabel = useMemo(() => {
    if (!isTetrahedral) return null
    if (gmshPreviewLoading) return 'Calculating…'
    if (displayedSourceCount != null) return formatSourceCount(displayedSourceCount)
    return '—'
  }, [isTetrahedral, displayedSourceCount, gmshPreviewLoading])

  return (
    <>
      <div className="mesh-source-grid-block">
        <h4 className="mesh-source-grid-heading">Mesh grid</h4>
        <div className="mesh-source-count-label">
          {usesProxySliders
            ? 'Number of sources'
            : `Number of sources (${axisSymbols.x} × ${axisSymbols.y} × ${axisSymbols.z})`}
        </div>
        <div className="mesh-source-count-value">
          = {isTetrahedral ? tetraSourceCountLabel : formatSourceCount(displayedSourceCount)}
        </div>
      </div>
      {isTetrahedral && !isGmshMeshBuildSupported(modelType) ? (
        <div
          style={{
            marginBottom: 12,
            padding: '8px 10px',
            fontSize: 12,
            lineHeight: 1.45,
            borderRadius: 6,
            background: 'rgba(255, 193, 7, 0.12)',
            border: '1px solid rgba(255, 193, 7, 0.35)',
          }}
        >
          {GMSH_MESH_UNSUPPORTED_SHAPE_MESSAGE}
        </div>
      ) : null}

      {usesProxySliders ? (
        <>
          <div className="control-group">
            <label>
              Target element size (m):
              <DotDecimalNumberInput
                value={targetElementSize}
                min={0.01}
                step={0.05}
                onChange={(v) => {
                  if (u) u.setTargetElementSize(v)
                  else setLocalTargetElementSize(v)
                  pushUnstructuredProxy({ targetElementSize: v })
                }}
              />
            </label>
          </div>

          <div className="control-group">
            <label>
              Refinement level (dimensionless):
              <DotDecimalNumberInput
                value={surfaceRefinement}
                min={0}
                step={0.05}
                onChange={(v) => {
                  if (u) {
                    u.setSurfaceRefinement(v)
                    if (isTetrahedral) u.setLocalRefinementNearEdges(v)
                  } else {
                    setLocalSurfaceRefinement(v)
                    if (isTetrahedral) setLocalLocalRefinementNearEdges(v)
                  }
                  pushUnstructuredProxy({ surfaceRefinement: v })
                }}
              />
            </label>
          </div>

        </>
      ) : (
        <>
          <div className="control-group">
            <label>
              {L.x}:
              <input
                type="number"
                value={numSourcesX === 0 ? '' : numSourcesX}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '') {
                    onNumSourcesXChange(0)
                    return
                  }
                  const n = parseInt(v, 10)
                  onNumSourcesXChange(Number.isFinite(n) && n >= 1 ? n : 1)
                }}
                onBlur={() => {
                  if (numSourcesX < 1) onNumSourcesXChange(1)
                }}
                onFocus={(e) => {
                  if (numSourcesX === 0) e.target.select()
                }}
                min={1}
                step={1}
              />
            </label>
          </div>
          <div className="control-group">
            <label>
              {L.y}:
              <input
                type="number"
                value={numSourcesY === 0 ? '' : numSourcesY}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '') {
                    onNumSourcesYChange(0)
                    return
                  }
                  const n = parseInt(v, 10)
                  onNumSourcesYChange(Number.isFinite(n) && n >= 1 ? n : 1)
                }}
                onBlur={() => {
                  if (numSourcesY < 1) onNumSourcesYChange(1)
                }}
                onFocus={(e) => {
                  if (numSourcesY === 0) e.target.select()
                }}
                min={1}
                step={1}
              />
            </label>
          </div>
          <div className="control-group">
            <label>
              {L.z}:
              <input
                type="number"
                value={numSourcesZ === 0 ? '' : numSourcesZ}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '') {
                    onNumSourcesZChange(0)
                    return
                  }
                  const n = parseInt(v, 10)
                  onNumSourcesZChange(Number.isFinite(n) && n >= 1 ? n : 1)
                }}
                onBlur={() => {
                  if (numSourcesZ < 1) onNumSourcesZChange(1)
                }}
                onFocus={(e) => {
                  if (numSourcesZ === 0) e.target.select()
                }}
                min={1}
                step={1}
              />
            </label>
          </div>
        </>
      )}
    </>
  )
}
