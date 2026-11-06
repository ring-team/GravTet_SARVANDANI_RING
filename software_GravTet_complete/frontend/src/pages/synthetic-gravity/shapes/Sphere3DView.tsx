/**
 * 3D preview for the **sphere** synthetic model: ball wireframe and structured/unstructured mesh controls.
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

interface Sphere3DViewProps extends SyntheticModelObservationProps {
  modelType: string | null
  radius: number
  h: number
  density: number
  onRadiusChange: (value: number) => void
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

function Sphere({
  radius,
  h,
  renderMode,
}: {
  radius: number
  h: number
  renderMode: DisplayRenderMode
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  
  // Surface is at y = 0, sphere is always below surface
  // Coordinate mapping for unified system:
  // X (horizontal) -> Three.js X
  // Y (horizontal) -> Three.js Z
  // Z (depth)      -> Three.js Y (negative)
  // position: [X, Y, Z] where Y is vertical depth (negative)
  const position: [number, number, number] = [0, -h - radius, 0]

  return (
    <mesh ref={meshRef} position={position} scale={[radius, radius, radius]}>
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
        wireframe={false}
      />
    </mesh>
  )
}

export default function Sphere3DView({
  modelType,
  radius,
  h,
  density,
  onRadiusChange,
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
}: Sphere3DViewProps) {
  const [renderMode, setRenderMode] = useState<DisplayRenderMode>('python')
  const viewRef = useRef<HTMLDivElement>(null)
  const { exportHandleRef } = useModelViewExport()
  const viewHalfExtent = syntheticModelViewHalfExtent(radius * 2, radius * 2, surfaceBounds)

  return (
    <div className="cube-3d-container">
      <div className="cube-3d-view" ref={viewRef}>
        <SyntheticModelCanvas exportHandleRef={exportHandleRef} viewHalfExtent={viewHalfExtent}>
          <ambientLight intensity={1.0} />
          <directionalLight position={[10, 10, 5]} intensity={1.5} />
          <directionalLight position={[-10, -5, -10]} intensity={0.6} />
          <pointLight position={[0, 0, -500]} intensity={1.5} color="#60a5fa" />
          <SyntheticSurfaceLayer
            sizeX={radius * 2}
            sizeY={radius * 2}
            displayObservationPoints={displayObservationPoints}
            numReceiversX={numReceiversX}
            numReceiversY={numReceiversY}
            surfaceBounds={surfaceBounds}
          />
          <AxesHelper3D sizeX={radius * 2} sizeY={radius * 2} sizeZ={radius * 2} depthFromSurface={h} surfaceBounds={surfaceBounds} />
          <Sphere renderMode={renderMode} radius={radius} h={h} />
          <MeshWireframe
            modelType={modelType}
            radius={radius}
            position={[0, -h - radius, 0]}
            renderStyle={renderMode}
            forwardMeshSourcesX={numSourcesX}
            forwardMeshSourcesY={numSourcesY}
            forwardMeshSourcesZ={numSourcesZ}
          />
        </SyntheticModelCanvas>
      </div>
      
      <div className="cube-controls">
        <h3>Sphere Parameters</h3>
        <SaveModelViewButton viewRef={viewRef} exportHandleRef={exportHandleRef} filenameBase="sphere-model" />

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
            Radius (m):
            <input
              type="number"
              value={radius === 0 ? '' : radius}
              onChange={(e) => {
                const val = e.target.value;
                onRadiusChange(val === '' ? 0 : parseFloat(val) || 0);
              }}
              onFocus={(e) => {
                if (radius === 0) {
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
            <span className="help-text">Distance from surface to top of sphere</span>
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
