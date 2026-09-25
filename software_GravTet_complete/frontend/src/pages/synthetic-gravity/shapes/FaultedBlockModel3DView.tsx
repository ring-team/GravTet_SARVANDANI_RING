/**
 * 3D preview for the **faulted block** synthetic model: offset blocks and fault plane visualization.
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

interface FaultedBlockModel3DViewProps extends SyntheticModelObservationProps {
  modelType: string | null
  x: number
  y: number
  z: number
  faultOffset: number
  h: number
  density: number
  onXChange: (value: number) => void
  onYChange: (value: number) => void
  onZChange: (value: number) => void
  onFaultOffsetChange: (value: number) => void
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

function FaultedBlock({
  x,
  y,
  z,
  faultOffset,
  h,
  renderMode,
}: {
  x: number
  y: number
  z: number
  faultOffset: number
  h: number
  renderMode: DisplayRenderMode
}) {
  const groupRef = useRef<THREE.Group>(null)
  
  // Surface is at y = 0, block is always below surface
  // h = distance from surface to top of block
  // Create two blocks: one on left side, one on right side with offset
  const leftBlockCenter = -h - z / 2
  const rightBlockCenter = -h - z / 2 - faultOffset
  const darkLike = renderMode === 'dark'
  const pythonLike = renderMode === 'python'

  return (
    <group ref={groupRef}>
      {/* Left block (lower) */}
      <mesh position={[-x / 4, leftBlockCenter, 0]}>
        <boxGeometry args={[x / 2, z, y]} />
        <meshStandardMaterial 
          color={darkLike ? '#6b7280' : pythonLike ? '#8ea0b7' : '#2563eb'}
          metalness={darkLike ? 0.03 : pythonLike ? 0.05 : 0.3}
          roughness={darkLike ? 0.88 : pythonLike ? 0.8 : 0.1}
          emissive={darkLike ? '#111827' : pythonLike ? '#000000' : '#1e40af'}
          emissiveIntensity={darkLike ? 0.05 : pythonLike ? 0 : 0.2}
          polygonOffset
          polygonOffsetFactor={8}
          polygonOffsetUnits={8}
        />
      </mesh>
      {/* Right block (offset) */}
      <mesh position={[x / 4, rightBlockCenter, 0]}>
        <boxGeometry args={[x / 2, z, y]} />
        <meshStandardMaterial 
          color={darkLike ? '#6b7280' : pythonLike ? '#8ea0b7' : '#2563eb'}
          metalness={darkLike ? 0.03 : pythonLike ? 0.05 : 0.3}
          roughness={darkLike ? 0.88 : pythonLike ? 0.8 : 0.1}
          emissive={darkLike ? '#111827' : pythonLike ? '#000000' : '#1e40af'}
          emissiveIntensity={darkLike ? 0.05 : pythonLike ? 0 : 0.2}
          polygonOffset
          polygonOffsetFactor={8}
          polygonOffsetUnits={8}
        />
      </mesh>
    </group>
  )
}

export default function FaultedBlockModel3DView({
  modelType,
  x,
  y,
  z,
  faultOffset,
  h,
  density,
  onXChange,
  onYChange,
  onZChange,
  onFaultOffsetChange,
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
}: FaultedBlockModel3DViewProps) {
  const [renderMode, setRenderMode] = useState<DisplayRenderMode>('python')
  const viewRef = useRef<HTMLDivElement>(null)
  const halfSourcesX = Math.max(1, Math.round(numSourcesX / 2))
  const { exportHandleRef } = useModelViewExport()
  const viewHalfExtent = syntheticModelViewHalfExtent(x, y, surfaceBounds)

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
            sizeX={x}
            sizeY={y}
            displayObservationPoints={displayObservationPoints}
            numReceiversX={numReceiversX}
            numReceiversY={numReceiversY}
            surfaceBounds={surfaceBounds}
          />
          <AxesHelper3D sizeX={x} sizeY={y} sizeZ={z} depthFromSurface={h} surfaceBounds={surfaceBounds} />
          <FaultedBlock x={x} y={y} z={z} faultOffset={faultOffset} h={h} renderMode={renderMode} />
          <MeshWireframe
            modelType={modelType}
            x={x / 2}
            y={y}
            z={z}
            position={[-x / 4, -h - z / 2, 0]}
            renderStyle={renderMode}
            forwardMeshSourcesX={halfSourcesX}
            forwardMeshSourcesY={numSourcesY}
            forwardMeshSourcesZ={numSourcesZ}
          />
          <MeshWireframe
            modelType={modelType}
            x={x / 2}
            y={y}
            z={z}
            position={[x / 4, -h - z / 2 - faultOffset, 0]}
            renderStyle={renderMode}
            forwardMeshSourcesX={halfSourcesX}
            forwardMeshSourcesY={numSourcesY}
            forwardMeshSourcesZ={numSourcesZ}
          />
        </SyntheticModelCanvas>
      </div>
      
      <div className="cube-controls">
        <h3>Faulted Block Model Parameters</h3>
        <SaveModelViewButton viewRef={viewRef} exportHandleRef={exportHandleRef} filenameBase="faulted-block-model" />

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
            X Dimension (m):
            <input
              type="number"
              value={x === 0 ? '' : x}
              onChange={(e) => {
                const val = e.target.value;
                onXChange(val === '' ? 0 : parseFloat(val) || 0);
              }}
              onFocus={(e) => {
                if (x === 0) {
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
            Y Dimension (m):
            <input
              type="number"
              value={y === 0 ? '' : y}
              onChange={(e) => {
                const val = e.target.value;
                onYChange(val === '' ? 0 : parseFloat(val) || 0);
              }}
              onFocus={(e) => {
                if (y === 0) {
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
            Z Dimension (m):
            <input
              type="number"
              value={z === 0 ? '' : z}
              onChange={(e) => {
                const val = e.target.value;
                onZChange(val === '' ? 0 : parseFloat(val) || 0);
              }}
              onFocus={(e) => {
                if (z === 0) {
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
            Fault Offset (m):
            <input
              type="number"
              value={faultOffset === 0 ? '' : faultOffset}
              onChange={(e) => {
                const val = e.target.value;
                onFaultOffsetChange(val === '' ? 0 : parseFloat(val) || 0);
              }}
              onFocus={(e) => {
                if (faultOffset === 0) {
                  e.target.select();
                }
              }}
              min="0"
              step="10"
            />
            <span className="help-text">Vertical offset between fault blocks</span>
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
            <span className="help-text">Distance from surface to top of block</span>
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
          variant="box"
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

