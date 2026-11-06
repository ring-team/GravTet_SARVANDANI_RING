import { useMemo, useRef, useState } from 'react'
import { SyntheticModelCanvas } from '../scene/SyntheticModelCanvas'
import SaveModelViewButton from '../save/SaveModelViewButton'
import { useModelViewExport } from '../save/useModelViewExport'
import { syntheticModelViewHalfExtent } from '../scene/syntheticModelDefaultCamera'
import * as THREE from 'three'
import { AxesHelper3D } from '../scene/AxesHelper3D'
import { SyntheticSurfaceLayer, type SyntheticModelObservationProps } from '../scene/SyntheticSurfaceLayer'
import { ObservationPointsDisplayControl } from '../scene/ObservationPointsDisplayControl'
import { MeshWireframe } from '../mesh/MeshWireframe'
import { MeshGridSourceControls, type SharedUnstructuredMeshSliders } from '../mesh/MeshGridSourceControls'
import { valleyMountainDisplayReliefX } from '../mesh/valleyMountainTopography'
import '../shared/Model3DView.css'

type DisplayRenderMode = 'ts' | 'python' | 'dark'

interface ValleyMountainModel3DViewProps extends SyntheticModelObservationProps {
  modelType: string | null
  x: number
  y: number
  z: number
  h: number
  mountainDensity: number
  halfSpaceDensity: number
  mountainHeight: number
  valleyDepth: number
  onXChange: (value: number) => void
  onYChange: (value: number) => void
  onZChange: (value: number) => void
  onHChange: (value: number) => void
  onMountainDensityChange: (value: number) => void
  onHalfSpaceDensityChange: (value: number) => void
  onMountainHeightChange: (value: number) => void
  onValleyDepthChange: (value: number) => void
  numSourcesX: number
  numSourcesY: number
  numSourcesZ: number
  onNumSourcesXChange: (value: number) => void
  onNumSourcesYChange: (value: number) => void
  onNumSourcesZChange: (value: number) => void
  sharedUnstructuredMesh?: SharedUnstructuredMeshSliders
}

function ValleyMountain({
  x,
  y,
  z,
  h,
  mountainHeight,
  valleyDepth,
  renderMode,
}: {
  x: number
  y: number
  z: number
  h: number
  mountainHeight: number
  valleyDepth: number
  renderMode: DisplayRenderMode
}) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape()
    const n = 80
    const xMin = -x / 2
    const xMax = x / 2
    shape.moveTo(xMin, -z / 2)
    for (let i = 0; i <= n; i++) {
      const px = xMin + (i / n) * (xMax - xMin)
      shape.lineTo(px, z / 2 + valleyMountainDisplayReliefX(px, x, mountainHeight, valleyDepth))
    }
    shape.lineTo(xMax, -z / 2)
    shape.closePath()
    const g = new THREE.ExtrudeGeometry(shape, { depth: y, bevelEnabled: false, steps: 1, curveSegments: 48 })
    g.translate(0, 0, -y / 2)
    return g
  }, [x, y, z, mountainHeight, valleyDepth])

  return (
    <mesh position={[0, -h - z / 2, 0]} geometry={geometry}>
      <meshStandardMaterial
        color={renderMode === 'dark' ? '#6b7280' : renderMode === 'python' ? '#8ea0b7' : '#ec4899'}
        metalness={renderMode === 'dark' ? 0.03 : renderMode === 'python' ? 0.05 : 0.25}
        roughness={renderMode === 'dark' ? 0.88 : renderMode === 'python' ? 0.8 : 0.15}
        emissive={renderMode === 'dark' ? '#111827' : renderMode === 'python' ? '#000000' : '#be185d'}
        emissiveIntensity={renderMode === 'dark' ? 0.05 : renderMode === 'python' ? 0 : 0.16}
        polygonOffset
        polygonOffsetFactor={4}
        polygonOffsetUnits={4}
      />
    </mesh>
  )
}

export default function ValleyMountainModel3DView(props: ValleyMountainModel3DViewProps) {
  const {
    modelType,
    x,
    y,
    z,
    h,
    mountainDensity,
    halfSpaceDensity,
    mountainHeight,
    valleyDepth,
    onXChange,
    onYChange,
    onZChange,
    onHChange,
    onMountainDensityChange,
    onHalfSpaceDensityChange,
    onMountainHeightChange,
    onValleyDepthChange,
    numSourcesX,
    numSourcesY,
    numSourcesZ,
    onNumSourcesXChange,
    onNumSourcesYChange,
    onNumSourcesZChange,
    sharedUnstructuredMesh,
    displayObservationPoints,
    onDisplayObservationPointsChange,
    numReceiversX,
    numReceiversY,
    surfaceBounds,
  } = props
  const [renderMode, setRenderMode] = useState<DisplayRenderMode>('python')
  const viewRef = useRef<HTMLDivElement>(null)
  const relief = Math.max(mountainHeight, valleyDepth)
  const { exportHandleRef } = useModelViewExport()
  const viewHalfExtent = syntheticModelViewHalfExtent(x, y, surfaceBounds)

  return (
    <div className="cube-3d-container">
      <div className="cube-3d-view" ref={viewRef}>
        <SyntheticModelCanvas exportHandleRef={exportHandleRef} viewHalfExtent={viewHalfExtent}>
          <ambientLight intensity={1.0} />
          <directionalLight position={[10, 10, 5]} intensity={1.5} />
          <directionalLight position={[-10, -5, -10]} intensity={0.6} />
          <pointLight position={[0, 0, -500]} intensity={1.5} color="#60a5fa" />
          <SyntheticSurfaceLayer
            sizeX={x}
            sizeY={y}
            displayObservationPoints={displayObservationPoints}
            numReceiversX={numReceiversX}
            numReceiversY={numReceiversY}
            surfaceBounds={surfaceBounds}
          />
          <AxesHelper3D sizeX={x} sizeY={y} sizeZ={z + relief * 2} depthFromSurface={h} surfaceBounds={surfaceBounds} />
          <ValleyMountain x={x} y={y} z={z} h={h} mountainHeight={mountainHeight} valleyDepth={valleyDepth} renderMode={renderMode} />
          <MeshWireframe
            modelType={modelType}
            x={x}
            y={y}
            z={z}
            valleyMountainHeight={mountainHeight}
            valleyMountainDepth={valleyDepth}
            position={[0, -h - z / 2, 0]}
            renderStyle={renderMode}
            forwardMeshSourcesX={numSourcesX}
            forwardMeshSourcesY={numSourcesY}
            forwardMeshSourcesZ={numSourcesZ}
          />
        </SyntheticModelCanvas>
      </div>
      <div className="cube-controls">
        <h3>Valley-Mountain Half-Space</h3>
        <SaveModelViewButton viewRef={viewRef} exportHandleRef={exportHandleRef} filenameBase="valley-mountain-model" />
        <div className="control-group">
          <label>Display mesh style:</label>
          <div className="render-style-row">
            <label className="render-style-option"><input type="checkbox" checked={renderMode === 'ts'} onChange={() => setRenderMode('ts')} /><span>Blue</span></label>
            <label className="render-style-option"><input type="checkbox" checked={renderMode === 'python'} onChange={() => setRenderMode('python')} /><span>Gray</span></label>
            <label className="render-style-option"><input type="checkbox" checked={renderMode === 'dark'} onChange={() => setRenderMode('dark')} /><span>Dark Gray</span></label>
          </div>
        </div>
        <ObservationPointsDisplayControl
          displayObservationPoints={displayObservationPoints}
          onDisplayObservationPointsChange={onDisplayObservationPointsChange}
          numReceiversX={numReceiversX}
          numReceiversY={numReceiversY}
        />
        <div className="control-group"><label>Topography block X (m):<input type="number" value={x === 0 ? '' : x} onChange={(e) => onXChange(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)} min="10" step="10" /></label></div>
        <div className="control-group"><label>Topography block Y (m):<input type="number" value={y === 0 ? '' : y} onChange={(e) => onYChange(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)} min="10" step="5" /></label></div>
        <div className="control-group"><label>Topography block Z (m):<input type="number" value={z === 0 ? '' : z} onChange={(e) => onZChange(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)} min="10" step="5" /></label></div>
        <div className="control-group"><label>Observation height h (m):<input type="number" value={h === 0 ? '' : h} onChange={(e) => onHChange(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)} min="0" step="5" /></label></div>
        <div className="control-group"><label>Mountain height (m, display + forward crest):<input type="number" value={mountainHeight === 0 ? '' : mountainHeight} onChange={(e) => onMountainHeightChange(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)} min="0" step="1" /></label></div>
        <div className="control-group"><label>Valley depth (m, display + forward trough):<input type="number" value={valleyDepth === 0 ? '' : valleyDepth} onChange={(e) => onValleyDepthChange(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)} min="0" step="1" /></label></div>
        <div className="control-group"><label>Half-space density (kg/m³):<input type="number" value={halfSpaceDensity === 0 ? '' : halfSpaceDensity} onChange={(e) => onHalfSpaceDensityChange(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)} min="0" step="1" /></label></div>
        <div className="control-group"><label>Mountain–valley block density (kg/m³):<input type="number" value={mountainDensity === 0 ? '' : mountainDensity} onChange={(e) => onMountainDensityChange(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)} min="0" step="1" /></label></div>
        <MeshGridSourceControls modelType={modelType} variant="box" numSourcesX={numSourcesX} numSourcesY={numSourcesY} numSourcesZ={numSourcesZ} onNumSourcesXChange={onNumSourcesXChange} onNumSourcesYChange={onNumSourcesYChange} onNumSourcesZChange={onNumSourcesZChange} sharedUnstructuredMesh={sharedUnstructuredMesh} />
      </div>
    </div>
  )
}
