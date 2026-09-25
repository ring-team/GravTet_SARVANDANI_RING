/**
 * 3D preview for a **horizontal cylinder** (axis along X): surface wireframe and mesh density UI.
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

interface HorizontalCylinder3DViewProps extends SyntheticModelObservationProps {
  modelType: string | null
  radius: number
  length: number
  h: number
  density: number
  onRadiusChange: (value: number) => void
  onLengthChange: (value: number) => void
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

function HorizontalCylinder({
  radius,
  length,
  h,
  renderMode,
}: {
  radius: number
  length: number
  h: number
  renderMode: DisplayRenderMode
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  
  // Surface is at y = 0, cylinder is always below surface
  // h = distance from surface to top of cylinder
  // For horizontal cylinder, the cylinder is rotated 90 degrees around Z axis
  // Top of cylinder = -h, Bottom of cylinder = -h - 2*radius
  // Center of cylinder = -h - radius
  const position: [number, number, number] = [0, -h - radius, 0]

  return (
    <mesh ref={meshRef} position={position} rotation={[0, 0, Math.PI / 2]} scale={[radius, length, radius]}>
      <cylinderGeometry args={[1, 1, 1, 32, 1]} />
      <meshStandardMaterial
        color={renderMode === 'dark' ? '#6b7280' : renderMode === 'python' ? '#8ea0b7' : '#2563eb'}
        metalness={renderMode === 'dark' ? 0.03 : renderMode === 'python' ? 0.05 : 0.3}
        roughness={renderMode === 'dark' ? 0.88 : renderMode === 'python' ? 0.8 : 0.1}
        emissive={renderMode === 'dark' ? '#111827' : renderMode === 'python' ? '#000000' : '#1e40af'}
        emissiveIntensity={renderMode === 'dark' ? 0.05 : renderMode === 'python' ? 0 : 0.2}
        polygonOffset
        polygonOffsetFactor={8}
        polygonOffsetUnits={8}
      />
    </mesh>
  )
}

export default function HorizontalCylinder3DView({
  modelType,
  radius,
  length,
  h,
  density,
  onRadiusChange,
  onLengthChange,
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
}: HorizontalCylinder3DViewProps) {
  const [renderMode, setRenderMode] = useState<DisplayRenderMode>('python')
  const viewRef = useRef<HTMLDivElement>(null)
  const { exportHandleRef } = useModelViewExport()
  const viewHalfExtent = syntheticModelViewHalfExtent(length, radius * 2, surfaceBounds)

  return (
    <div className="cube-3d-container">
      <div className="cube-3d-view" ref={viewRef}>
        <SyntheticModelCanvas exportHandleRef={exportHandleRef} viewHalfExtent={viewHalfExtent}>
          <ambientLight intensity={1.0} />
          <directionalLight position={[10, 10, 5]} intensity={1.5} />
          <directionalLight position={[-10, -5, -10]} intensity={0.6} />
          <pointLight position={[0, -500, 0]} intensity={1.5} color="#60a5fa" />
          <pointLight position={[0, -1000, 0]} intensity={1.2} color="#93c5fd" />
          <pointLight position={[0, -2000, 0]} intensity={1.0} color="#3b82f6" />
          <pointLight position={[0, -3000, 0]} intensity={0.8} color="#2563eb" />
          <SyntheticSurfaceLayer
            sizeX={length}
            sizeY={radius * 2}
            displayObservationPoints={displayObservationPoints}
            numReceiversX={numReceiversX}
            numReceiversY={numReceiversY}
            surfaceBounds={surfaceBounds}
          />
          <AxesHelper3D sizeX={length} sizeY={radius * 2} sizeZ={radius * 2} depthFromSurface={h} surfaceBounds={surfaceBounds} />
          <HorizontalCylinder renderMode={renderMode} radius={radius} length={length} h={h} />
          <MeshWireframe
            modelType={modelType}
            cylinderRadius={radius}
            cylinderLength={length}
            position={[0, -h - radius, 0]}
            rotation={[0, 0, Math.PI / 2]}
            renderStyle={renderMode}
            forwardMeshSourcesX={numSourcesX}
            forwardMeshSourcesY={numSourcesY}
            forwardMeshSourcesZ={numSourcesZ}
          />
        </SyntheticModelCanvas>
      </div>
      
      <div className="cube-controls">
        <h3>Horizontal Cylinder Parameters</h3>
        <SaveModelViewButton viewRef={viewRef} exportHandleRef={exportHandleRef} filenameBase="horizontal-cylinder-model" />

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
            Length (m):
            <input
              type="number"
              value={length === 0 ? '' : length}
              onChange={(e) => {
                const val = e.target.value;
                onLengthChange(val === '' ? 0 : parseFloat(val) || 0);
              }}
              onFocus={(e) => {
                if (length === 0) {
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
            <span className="help-text">Distance from surface to top of cylinder</span>
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
          variant="horizontalCylinder"
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

