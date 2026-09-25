/**
 * **Initial model** gravity workflow: load or sketch a 3D density model, set observation grid, run forward gravity.
 *
 * Orchestrates 3D viewport, spreadsheet import, and anomaly colorbar. Logic is split under `initialModel/` and sibling components.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import '../../pages/forward-gravity/shared/ForwardGravityView.css'
import { AxesHelper3D } from '../synthetic-gravity/scene/AxesHelper3D'
import './InitialModelView.css'
import type { ImportedField, InitialModel, InitialModelMode, InitialModelPrimitive, LayerDef } from './initialModel/types'
import { formatAnomalyTick, uid } from './initialModel/math'
import { computeBounds, computeBoundsFromImportedField } from './initialModel/bounds'
import type { ImportedColormapId } from './initialModel/colormap'
import { importInitialModelFromSpreadsheet } from './initialModel/spreadsheetImport'
import { InitialModelAnomalyColorbar } from './InitialModelAnomalyColorbar'
import { ImportedFieldMesh } from './ImportedFieldMesh'
import { InitialModelCameraFit, type CameraFitParams } from './InitialModelCameraFit'

// --- Initial model page: spreadsheet import + R3F preview (union/layered primitives) ---

export default function InitialModelView(props: {
  initialModel: InitialModel | null
  setInitialModel: (m: InitialModel) => void
}) {
  const { initialModel, setInitialModel } = props

  const [mode] = useState<InitialModelMode>('union')

  const [draft, setDraft] = useState<InitialModel>(() => {
    return (
      initialModel ?? {
        units: { length: 'm' },
        primitives: [],
      }
    )
  })

  const [layers, setLayers] = useState<LayerDef[]>(() => {
    return [
      {
        id: uid(),
        topDepth: 20,
        thickness: 80,
        density: 2200,
        tiltX: 0,
        tiltY: 0,
        extentX: 300,
        extentY: 300,
        gridN: 6,
        curvAmp: 0,
        curvSigma: 200,
      },
      {
        id: uid(),
        topDepth: 100,
        thickness: 120,
        density: 2600,
        tiltX: 0,
        tiltY: 0,
        extentX: 300,
        extentY: 300,
        gridN: 6,
        curvAmp: 0,
        curvSigma: 180,
      },
    ]
  })

  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const didInitialFitRef = useRef(false)

  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadStats, setUploadStats] = useState<{ count: number; min: number; max: number } | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [importedField, setImportedField] = useState<ImportedField | null>(null)
  const [showImportedEdges, setShowImportedEdges] = useState<boolean>(true)
  const [importedColormap, setImportedColormap] = useState<ImportedColormapId>('cividis')

  const unionDefaultExtent = useMemo(() => {
    const maxX = Math.max(50, ...draft.primitives.map((p) => Math.abs(p.sizeX)))
    const maxY = Math.max(50, ...draft.primitives.map((p) => Math.abs(p.sizeY)))
    return { maxX, maxY }
  }, [draft.primitives])

  useEffect(() => {
    if (!initialModel) return
    setDraft(initialModel)
  }, [initialModel])

  useEffect(() => {
    if (mode !== 'layers') return
    setLayers((prev) =>
      prev.map((l) => {
        const nextExtentX = l.extentX === 300 ? unionDefaultExtent.maxX : l.extentX
        const nextExtentY = l.extentY === 300 ? unionDefaultExtent.maxY : l.extentY
        return { ...l, extentX: nextExtentX, extentY: nextExtentY }
      }),
    )
  }, [mode, unionDefaultExtent.maxX, unionDefaultExtent.maxY])

  useEffect(() => {
    didInitialFitRef.current = false
  }, [mode])

  useEffect(() => {
    didInitialFitRef.current = false
  }, [importedField])

  // --- Primitives sent to the scene (explicit boxes vs layered lattice) ---

  const renderPrimitives = useMemo(() => {
    if (mode === 'union') return draft.primitives

    const items: InitialModelPrimitive[] = []
    const filtered = layers.filter((l) => l.thickness > 0)

    for (const l of filtered) {
      const topDepthHere = l.topDepth
      const grid = Math.max(1, Math.min(50, l.gridN))
      const cellX = l.extentX / grid
      const cellY = l.extentY / grid
      const halfXExtent = l.extentX / 2
      const halfYExtent = l.extentY / 2
      const halfThickness = l.thickness / 2
      const sigma = Math.max(1e-6, l.curvSigma)

      for (let ix = 0; ix < grid; ix++) {
        const x = -halfXExtent + cellX / 2 + ix * cellX
        for (let iy = 0; iy < grid; iy++) {
          const y = -halfYExtent + cellY / 2 + iy * cellY
          const dx = x
          const dy = y
          const gaussian = l.curvAmp * Math.exp(-((dx * dx + dy * dy) / (2 * sigma * sigma)))
          const depthAtCell = Math.max(0, topDepthHere + l.tiltX * x + l.tiltY * y + gaussian)
          const centerZ = -(depthAtCell + halfThickness)

          items.push({
            id: `${l.id}-${ix}-${iy}`,
            type: 'box',
            density: l.density,
            centerX: x,
            centerY: y,
            centerZ,
            sizeX: cellX,
            sizeY: cellY,
            sizeZ: l.thickness,
          })
        }
      }
    }

    return items
  }, [mode, draft.primitives, layers])

  // --- Imported surface: Z exaggeration for visualization ---

  const importedVertScale = useMemo(() => {
    if (!importedField) return null
    const { xs, ys, zGrid } = importedField
    const ny = ys.length
    const nx = xs.length
    let zMin = Infinity
    let zMax = -Infinity
    for (let iy = 0; iy < ny; iy++) {
      for (let ix = 0; ix < nx; ix++) {
        const z = zGrid[iy][ix]
        if (!Number.isFinite(z)) continue
        zMin = Math.min(zMin, z)
        zMax = Math.max(zMax, z)
      }
    }
    if (!Number.isFinite(zMin) || !Number.isFinite(zMax)) return null
    const zRange = zMax - zMin
    const xSpan = Math.max(...xs) - Math.min(...xs)
    const ySpan = Math.max(...ys) - Math.min(...ys)
    const horiz = Math.max(xSpan, ySpan, 1e-6)
    const exaggeration = zRange < 1e-6 ? 1 : Math.max(1, Math.min(30, (0.42 * horiz) / zRange))
    const zMean = (zMin + zMax) / 2
    return { exaggeration, zMean, zMin, zMax }
  }, [importedField])

  const importedAxisSizes = useMemo(() => {
    if (!importedField || !importedVertScale) return null
    const b = computeBoundsFromImportedField(importedField)
    const { exaggeration, zMean, zMin, zMax } = importedVertScale
    const zVisMin = zMean + (zMin - zMean) * exaggeration
    const zVisMax = zMean + (zMax - zMean) * exaggeration
    const depthSpan = Math.abs(zVisMax - zVisMin)
    const dx = b.maxX - b.minX
    const dy = b.maxZ - b.minZ
    return {
      sizeX: Math.max(10, dx / 3),
      sizeY: Math.max(10, dy / 3),
      sizeZ: Math.max(10, depthSpan / 3),
    }
  }, [importedField, importedVertScale])

  const surfaceFromDraft = useMemo(() => {
    if (importedField && importedVertScale) {
      const { exaggeration, zMean, zMin, zMax } = importedVertScale
      const zVisMin = zMean + (zMin - zMean) * exaggeration
      const zVisMax = zMean + (zMax - zMean) * exaggeration
      return Math.max(50, Math.abs(zVisMin), Math.abs(zVisMax))
    }
    if (importedField) {
      const zs = importedField.zGrid.flat()
      const zMn = Math.min(...zs)
      const zMx = Math.max(...zs)
      return Math.max(50, Math.abs(zMn), Math.abs(zMx))
    }
    const depths = renderPrimitives.map((p) => [p.centerZ - p.sizeZ / 2, p.centerZ + p.sizeZ / 2]).flat()
    const maxAbs = Math.max(50, ...depths.map((z) => Math.abs(z)))
    return maxAbs
  }, [renderPrimitives, importedField, importedVertScale])

  const modelSize = useMemo(() => {
    if (importedField) {
      const ax = importedField.xs.map((v) => Math.abs(v))
      const ay = importedField.ys.map((v) => Math.abs(v))
      const maxX = Math.max(50, ...ax, 1)
      const maxY = Math.max(50, ...ay, 1)
      return { maxX, maxY }
    }
    const maxX = Math.max(50, ...renderPrimitives.map((p) => Math.abs(p.centerX) + p.sizeX / 2))
    const maxY = Math.max(50, ...renderPrimitives.map((p) => Math.abs(p.centerY) + p.sizeY / 2))
    return { maxX, maxY }
  }, [renderPrimitives, importedField])

  // --- World bounds + orbit target (primitives or imported grid) ---

  const bounds = useMemo(() => {
    if (importedField && importedVertScale) {
      const { xs, ys, zGrid } = importedField
      const { exaggeration, zMean } = importedVertScale
      const ny = ys.length
      const nx = xs.length
      let zMin = Infinity
      let zMax = -Infinity
      for (let iy = 0; iy < ny; iy++) {
        for (let ix = 0; ix < nx; ix++) {
          const z = zGrid[iy][ix]
          if (!Number.isFinite(z)) continue
          zMin = Math.min(zMin, z)
          zMax = Math.max(zMax, z)
        }
      }
      const zVisMin = zMean + (zMin - zMean) * exaggeration
      const zVisMax = zMean + (zMax - zMean) * exaggeration
      const zVisTop = Math.min(zVisMin, zVisMax)
      const zVisBot = Math.max(zVisMin, zVisMax)

      let minX = Infinity
      let maxX = -Infinity
      let minZt = Infinity
      let maxZt = -Infinity
      for (let iy = 0; iy < ny; iy++) {
        for (let ix = 0; ix < nx; ix++) {
          minX = Math.min(minX, xs[ix])
          maxX = Math.max(maxX, xs[ix])
          minZt = Math.min(minZt, ys[iy])
          maxZt = Math.max(maxZt, ys[iy])
        }
      }
      const minY = Math.min(0, -zVisBot, -zVisTop)
      const maxY = Math.max(0, -zVisBot, -zVisTop)
      const targetX = (minX + maxX) / 2
      const targetY = (minY + maxY) / 2
      const targetZ = (minZt + maxZt) / 2
      const dx = maxX - minX
      const dy = maxY - minY
      const dz = maxZt - minZt
      const diag = Math.sqrt(dx * dx + dy * dy + dz * dz)
      const radius = Math.max(50, diag / 2)

      return {
        target: [targetX, targetY, targetZ] as [number, number, number],
        radius,
        minX,
        maxX,
        minY,
        maxY,
        minZ: minZt,
        maxZ: maxZt,
      }
    }
    if (importedField) return computeBoundsFromImportedField(importedField)
    if (renderPrimitives.length === 0) {
      return computeBounds([
        {
          id: 'empty',
          type: 'box',
          density: 0,
          centerX: 0,
          centerY: 0,
          centerZ: -100,
          sizeX: 100,
          sizeY: 100,
          sizeZ: 100,
        },
      ])
    }
    return computeBounds(renderPrimitives)
  }, [renderPrimitives, importedField, importedVertScale])

  const fit: CameraFitParams = useMemo(() => {
    const radius = bounds.radius
    const camDist = Math.max(300, radius * 3)
    const far = Math.max(20000, camDist * 30)
    const minDistance = Math.max(50, radius * 0.25)
    const maxDistance = Math.max(2000, radius * 12)

    const target = bounds.target
    const camPos: [number, number, number] = importedField
      ? [
          target[0] + camDist * 0.95,
          target[1] + radius * 0.35,
          target[2] + camDist * 0.55,
        ]
      : [target[0] + camDist, target[1] + radius * 0.05, target[2] + radius * 0.05]

    return { far, minDistance, maxDistance, target, camPos }
  }, [bounds, importedField])

  const importedAnomalyLegend = useMemo(() => {
    if (!importedField) return null
    const { valueGrid } = importedField
    let minV = Infinity
    let maxV = -Infinity
    for (const row of valueGrid) {
      for (const v of row) {
        if (!Number.isFinite(v)) continue
        minV = Math.min(minV, v)
        maxV = Math.max(maxV, v)
      }
    }
    if (!Number.isFinite(minV) || !Number.isFinite(maxV)) return null
    return { minV, maxV, span: maxV - minV }
  }, [importedField])

  // --- XLSX / CSV → draft model + optional inferred grid ---

  const handleInitialModelFile = async (file: File) => {
    setIsUploading(true)
    setUploadError(null)
    setUploadStats(null)
    setImportedField(null)

    try {
      const { inferredGrid, model, stats } = await importInitialModelFromSpreadsheet(file)
      if (inferredGrid) setImportedField(inferredGrid)
      setDraft(model)
      setInitialModel(model)
      setUploadStats(stats)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setUploadError(msg)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="forward-solver-container">
      {/* --- Left: upload + import stats --- */}
      <div className="forward-solver-controls initial-model-controls">
        <h3>Initial Model (MVP: Excel Import)</h3>

        <div className="control-group initial-model-upload-block">
          <label className="initial-model-file-label">
            Upload file:
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              disabled={isUploading}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleInitialModelFile(f)
              }}
            />
          </label>

          <label className="initial-model-mesh-row">
            <input
              type="checkbox"
              checked={showImportedEdges}
              onChange={(e) => setShowImportedEdges(e.target.checked)}
            />
            <span>Show mesh</span>
          </label>

          {uploadError && <div className="error-message">{uploadError}</div>}

          {uploadStats && (
            <div className="results-info">
              <h4>Imported Initial Model</h4>
              <p>
                Points: <strong>{uploadStats.count}</strong>
              </p>
              <p>
                Anomaly (<code>value</code>): <strong>{formatAnomalyTick(uploadStats.min)}</strong> to{' '}
                <strong>{formatAnomalyTick(uploadStats.max)}</strong>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* --- Right: R3F viewport + anomaly colorbar (when grid loaded) --- */}
      <div className="initial-model-right">
        {importedField && importedVertScale ? (
          <div className="initial-model-viewport">
            <div className="initial-model-canvas">
              <Canvas
                camera={{ position: [250, 150, 250], fov: 45, far: 20000, near: 0.1 }}
                gl={{ logarithmicDepthBuffer: true, antialias: true }}
              >
                <color attach="background" args={['#2f3644']} />
                <ambientLight intensity={0.48} />
                <directionalLight position={[0, 520, 0]} intensity={0.95} />
                <directionalLight position={[400, 180, 320]} intensity={0.75} />
                <directionalLight position={[-260, 120, -200]} intensity={0.38} />
                <hemisphereLight args={['#c5cbd8', '#2f3644', 0.55]} />
                <pointLight position={[0, 400, 0]} intensity={0.35} distance={12000} />

                <AxesHelper3D
                  sizeX={importedAxisSizes?.sizeX ?? modelSize.maxX}
                  sizeY={importedAxisSizes?.sizeY ?? modelSize.maxY}
                  sizeZ={importedAxisSizes?.sizeZ ?? surfaceFromDraft}
                  showBoundingBox={false}
                  compact
                  darkTheme
                />
                <ImportedFieldMesh
                  importedField={importedField}
                  importedVertScale={importedVertScale}
                  showImportedEdges={showImportedEdges}
                  importedColormap={importedColormap}
                />
                <OrbitControls
                  ref={controlsRef}
                  enablePan
                  enableZoom
                  enableRotate
                  minDistance={fit.minDistance}
                  maxDistance={fit.maxDistance}
                />
                <InitialModelCameraFit controlsRef={controlsRef} fit={fit} didInitialFitRef={didInitialFitRef} />
              </Canvas>
            </div>
            {importedAnomalyLegend && (
              <InitialModelAnomalyColorbar
                minV={importedAnomalyLegend.minV}
                maxV={importedAnomalyLegend.maxV}
                importedColormap={importedColormap}
                onColormapChange={setImportedColormap}
              />
            )}
          </div>
        ) : (
          <div className="initial-model-right-empty" aria-hidden />
        )}
      </div>
    </div>
  )
}
