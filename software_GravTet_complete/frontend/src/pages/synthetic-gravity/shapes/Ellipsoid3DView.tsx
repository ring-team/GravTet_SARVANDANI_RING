/**
 * 3D preview for the **ellipsoid** synthetic model: triaxial surface mesh preview and source grid sliders.
 */
import { useRef, useState } from 'react'
import { SyntheticModelCanvas } from '../scene/SyntheticModelCanvas'
import SaveModelViewButton from '../save/SaveModelViewButton'
import { useModelViewExport } from '../save/useModelViewExport'
import { syntheticModelViewHalfExtent } from '../scene/syntheticModelDefaultCamera'
import { AxesHelper3D } from '../scene/AxesHelper3D'
import { SyntheticSurfaceLayer, type SyntheticModelObservationProps } from '../scene/SyntheticSurfaceLayer'
import { ObservationPointsDisplayControl } from '../scene/ObservationPointsDisplayControl'
import { MeshGridSourceControls, type SharedUnstructuredMeshSliders } from '../mesh/MeshGridSourceControls'
import { MeshWireframe } from '../mesh/MeshWireframe'
import * as THREE from 'three'
import '../shared/Model3DView.css'

type DisplayRenderMode = 'ts' | 'python' | 'dark'

interface Ellipsoid3DViewProps extends SyntheticModelObservationProps {
  modelType: string | null
  a: number
  b: number
  c: number
  h: number
  density: number
  onAChange: (value: number) => void
  onBChange: (value: number) => void
  onCChange: (value: number) => void
  onHChange: (value: number) => void
  onDensityChange: (value: number) => void
  numSourcesX: number
  numSourcesY: number
  numSourcesZ: number
  onNumSourcesXChange: (value: number) => void
  onNumSourcesYChange: (value: number) => void
  onNumSourcesZChange: (value: number) => void
  sharedUnstructuredMesh?: SharedUnstructuredMeshSliders
}

function Ellipsoid({
  a,
  b,
  c,
  h,
  renderMode,
}: {
  a: number
  b: number
  c: number
  h: number
  renderMode: DisplayRenderMode
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  
  // Surface is at y = 0, ellipsoid is always below surface
  // Coordinate mapping for unified system:
  // X (horizontal) -> Three.js X
  // Y (horizontal) -> Three.js Z
  // Z (depth)      -> Three.js Y (negative)
  // c is the vertical semi-axis (depth)
  // position: [X, Y, Z] where Y is vertical depth (negative)
  const position: [number, number, number] = [0, -h - c, 0]

  return (
    <mesh ref={meshRef} position={position} scale={[a, c, b]}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial
        color={renderMode === 'dark' ? '#6b7280' : renderMode === 'python' ? '#8ea0b7' : '#2563eb'}
        metalness={renderMode === 'dark' ? 0.03 : renderMode === 'python' ? 0.05 : 0.3}
        roughness={renderMode === 'dark' ? 0.88 : renderMode === 'python' ? 0.8 : 0.1}
        emissive={renderMode === 'dark' ? '#111827' : renderMode === 'python' ? '#000000' : '#1e40af'}
        emissiveIntensity={renderMode === 'dark' ? 0.05 : renderMode === 'python' ? 0 : 0.2}
        polygonOffset
        polygonOffsetFactor={4}
        polygonOffsetUnits={4}
      />
    </mesh>
  )
}

export default function Ellipsoid3DView({
  modelType,
  a,
  b,
  c,
  h,
  density,
  onAChange,
  onBChange,
  onCChange,
  onHChange,
  onDensityChange,
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
}: Ellipsoid3DViewProps) {
  const [renderMode, setRenderMode] = useState<DisplayRenderMode>('python')
  const viewRef = useRef<HTMLDivElement>(null)
  // Volume of ellipsoid: (4/3) * π * a * b * c
  const { exportHandleRef } = useModelViewExport()
  const viewHalfExtent = syntheticModelViewHalfExtent(a * 2, b * 2, surfaceBounds)

  return (
    <div className="cube-3d-container">
      <div className="cube-3d-view" ref={viewRef}>
        <SyntheticModelCanvas exportHandleRef={exportHandleRef} viewHalfExtent={viewHalfExtent}>
          <ambientLight intensity={1.0} />
          <directionalLight position={[10, 10, 5]} intensity={1.5} />
          <directionalLight position={[-10, -5, -10]} intensity={0.6} />
          <pointLight position={[0, 0, -500]} intensity={1.5} color="#60a5fa" />
          <SyntheticSurfaceLayer
            sizeX={a * 2}
            sizeY={b * 2}
            displayObservationPoints={displayObservationPoints}
            numReceiversX={numReceiversX}
            numReceiversY={numReceiversY}
            surfaceBounds={surfaceBounds}
          />
          <AxesHelper3D sizeX={a * 2} sizeY={b * 2} sizeZ={c * 2} depthFromSurface={h} surfaceBounds={surfaceBounds} />
          <Ellipsoid renderMode={renderMode} a={a} b={b} c={c} h={h} />
          <MeshWireframe
            modelType={modelType}
            a={a}
            b={b}
            c={c}
            position={[0, -h - c, 0]}
            renderStyle={renderMode}
            forwardMeshSourcesX={numSourcesX}
            forwardMeshSourcesY={numSourcesY}
            forwardMeshSourcesZ={numSourcesZ}
          />
        </SyntheticModelCanvas>
      </div>
      
      <div className="cube-controls">
        <h3>Ellipsoid Parameters</h3>
        <SaveModelViewButton viewRef={viewRef} exportHandleRef={exportHandleRef} filenameBase="ellipsoid-model" />

        <div className="control-group">
          <label>Display mesh style:</label>
          <div className="render-style-row">
            <label className="render-style-option">
              <input
                type="checkbox"
                checked={renderMode === 'ts'}
                onChange={() => setRenderMode('ts')}
              />
              <span>Blue</span>
            </label>
            <label className="render-style-option">
              <input
                type="checkbox"
                checked={renderMode === 'python'}
                onChange={() => setRenderMode('python')}
              />
              <span>Gray</span>
            </label>
            <label className="render-style-option">
              <input
                type="checkbox"
                checked={renderMode === 'dark'}
                onChange={() => setRenderMode('dark')}
              />
              <span>Dark Gray</span>
            </label>
          </div>
        </div>

        <ObservationPointsDisplayControl
          displayObservationPoints={displayObservationPoints}
          onDisplayObservationPointsChange={onDisplayObservationPointsChange}
          numReceiversX={numReceiversX}
          numReceiversY={numReceiversY}
        />

        <div className="control-group">
          <label>
            Semi-axis A (X, m):
            <input
              type="number"
              value={a === 0 ? '' : a}
              onChange={(e) => {
                const val = e.target.value;
                onAChange(val === '' ? 0 : parseFloat(val) || 0);
              }}
              onFocus={(e) => {
                if (a === 0) {
                  e.target.select();
                }
              }}
              min="0"
              step="10"
            />
          </label>
        </div>

        <div className="control-group">
          <label>
            Semi-axis B (Y, m):
            <input
              type="number"
              value={b === 0 ? '' : b}
              onChange={(e) => {
                const val = e.target.value;
                onBChange(val === '' ? 0 : parseFloat(val) || 0);
              }}
              onFocus={(e) => {
                if (b === 0) {
                  e.target.select();
                }
              }}
              min="0"
              step="10"
            />
          </label>
        </div>

        <div className="control-group">
          <label>
            Semi-axis C (Z, m):
            <input
              type="number"
              value={c === 0 ? '' : c}
              onChange={(e) => {
                const val = e.target.value;
                onCChange(val === '' ? 0 : parseFloat(val) || 0);
              }}
              onFocus={(e) => {
                if (c === 0) {
                  e.target.select();
                }
              }}
              min="0"
              step="10"
            />
            <span className="help-text">Vertical semi-axis (depth)</span>
          </label>
        </div>

        <div className="control-group">
          <label>
            Depth from Surface (h, m):
            <input
              type="number"
              value={h === 0 ? '' : h}
              onChange={(e) => {
                const val = e.target.value;
                onHChange(val === '' ? 0 : parseFloat(val) || 0);
              }}
              onFocus={(e) => {
                if (h === 0) {
                  e.target.select();
                }
              }}
              min="0"
              step="10"
            />
            <span className="help-text">Distance from surface to top of ellipsoid</span>
          </label>
        </div>

        <div className="control-group">
          <label>
            Density (kg/m³):
            <input
              type="number"
              value={density === 0 ? '' : density}
              onChange={(e) => {
                const val = e.target.value;
                onDensityChange(val === '' ? 0 : parseFloat(val) || 0);
              }}
              onFocus={(e) => {
                if (density === 0) {
                  e.target.select();
                }
              }}
              min="0"
              step="1"
            />
          </label>
        </div>

        <MeshGridSourceControls
          modelType={modelType}
          variant="sphere"
          numSourcesX={numSourcesX}
          numSourcesY={numSourcesY}
          numSourcesZ={numSourcesZ}
          onNumSourcesXChange={onNumSourcesXChange}
          onNumSourcesYChange={onNumSourcesYChange}
          onNumSourcesZChange={onNumSourcesZChange}
          sharedUnstructuredMesh={sharedUnstructuredMesh}
        />
      </div>
    </div>
  )
}
