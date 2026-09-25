/**
 * 3D preview for the **four cubes** compound model: four boxes with independent sizes and combined wireframe.
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

interface FourCubes3DViewProps extends SyntheticModelObservationProps {
  modelType: string | null
  // Cube 1
  cube1X: number
  cube1Y: number
  cube1Z: number
  cube1H: number
  cube1Density: number
  // Cube 2
  cube2X: number
  cube2Y: number
  cube2Z: number
  cube2H: number
  cube2Density: number
  // Cube 3
  cube3X: number
  cube3Y: number
  cube3Z: number
  cube3H: number
  cube3Density: number
  // Cube 4
  cube4X: number
  cube4Y: number
  cube4Z: number
  cube4H: number
  cube4Density: number
  // Spacing
  spacingX: number
  spacingY: number
  // Cube offsets (X and Y distances from base grid position)
  cube1OffsetX: number
  cube1OffsetY: number
  cube2OffsetX: number
  cube2OffsetY: number
  cube3OffsetX: number
  cube3OffsetY: number
  cube4OffsetX: number
  cube4OffsetY: number
  // Callbacks
  onCube1XChange: (value: number) => void
  onCube1YChange: (value: number) => void
  onCube1ZChange: (value: number) => void
  onCube1HChange: (value: number) => void
  onCube1DensityChange: (value: number) => void
  onCube2XChange: (value: number) => void
  onCube2YChange: (value: number) => void
  onCube2ZChange: (value: number) => void
  onCube2HChange: (value: number) => void
  onCube2DensityChange: (value: number) => void
  onCube3XChange: (value: number) => void
  onCube3YChange: (value: number) => void
  onCube3ZChange: (value: number) => void
  onCube3HChange: (value: number) => void
  onCube3DensityChange: (value: number) => void
  onCube4XChange: (value: number) => void
  onCube4YChange: (value: number) => void
  onCube4ZChange: (value: number) => void
  onCube4HChange: (value: number) => void
  onCube4DensityChange: (value: number) => void
  onSpacingXChange: (value: number) => void
  onSpacingYChange: (value: number) => void
  onCube1OffsetXChange: (value: number) => void
  onCube1OffsetYChange: (value: number) => void
  onCube2OffsetXChange: (value: number) => void
  onCube2OffsetYChange: (value: number) => void
  onCube3OffsetXChange: (value: number) => void
  onCube3OffsetYChange: (value: number) => void
  onCube4OffsetXChange: (value: number) => void
  onCube4OffsetYChange: (value: number) => void
  numSourcesX: number
  numSourcesY: number
  numSourcesZ: number
  onNumSourcesXChange: (value: number) => void
  onNumSourcesYChange: (value: number) => void
  onNumSourcesZChange: (value: number) => void
  sharedUnstructuredMesh?: SharedUnstructuredMeshSliders
}

function Cube({ x, y, z, h, position, renderMode }: { x: number; y: number; z: number; h: number; position: [number, number, number]; renderMode: DisplayRenderMode }) {
  const meshRef = useRef<THREE.Mesh>(null)
  
  // Coordinate mapping for unified system:
  // X (horizontal) -> Three.js X
  // Y (horizontal) -> Three.js Z
  // Z (depth)      -> Three.js Y (negative)
  // position: [X, Y, Z] - relative to center
  const cubePosition: [number, number, number] = [position[0], -h - z / 2, position[2]]

  return (
    <mesh ref={meshRef} position={cubePosition}>
      <boxGeometry args={[x, z, y]} />
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

export default function FourCubes3DView(props: FourCubes3DViewProps) {
  const [renderMode, setRenderMode] = useState<DisplayRenderMode>('python')
  const viewRef = useRef<HTMLDivElement>(null)
  const { modelType } = props
  
  // Calculate cube positions in 2x2 grid with offsets
  // Base positions:
  // Cube 1: top-left    (-spacing_x/2, -spacing_y/2)
  // Cube 2: top-right   ( spacing_x/2, -spacing_y/2)
  // Cube 3: bottom-left (-spacing_x/2,  spacing_y/2)
  // Cube 4: bottom-right( spacing_x/2,  spacing_y/2)
  // Then add individual X and Y offsets
  const cubePositions: [number, number, number][] = [
    [-props.spacingX / 2 + props.cube1OffsetX, 0, -props.spacingY / 2 + props.cube1OffsetY],  // Cube 1
    [ props.spacingX / 2 + props.cube2OffsetX, 0, -props.spacingY / 2 + props.cube2OffsetY],  // Cube 2
    [-props.spacingX / 2 + props.cube3OffsetX, 0,  props.spacingY / 2 + props.cube3OffsetY],  // Cube 3
    [ props.spacingX / 2 + props.cube4OffsetX, 0,  props.spacingY / 2 + props.cube4OffsetY]   // Cube 4
  ]
  const { exportHandleRef } = useModelViewExport()
  const viewHalfExtent = syntheticModelViewHalfExtent(props.spacingX, props.spacingY, props.surfaceBounds)

  return (
    <div className="model-3d-view">
      <div className="model-3d-canvas" ref={viewRef}>
        <SyntheticModelCanvas exportHandleRef={exportHandleRef} viewHalfExtent={viewHalfExtent}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
          <pointLight position={[-10, 10, -10]} intensity={0.5} />
          
          <SyntheticSurfaceLayer
            sizeX={props.spacingX}
            sizeY={props.spacingY}
            displayObservationPoints={props.displayObservationPoints}
            numReceiversX={props.numReceiversX}
            numReceiversY={props.numReceiversY}
            surfaceBounds={props.surfaceBounds}
          />
          
          {/* Render 4 cubes */}
          <Cube 
            x={props.cube1X} 
            y={props.cube1Y} 
            z={props.cube1Z} 
            h={props.cube1H}
            position={cubePositions[0]}
            renderMode={renderMode}
          />
          <Cube 
            x={props.cube2X} 
            y={props.cube2Y} 
            z={props.cube2Z} 
            h={props.cube2H}
            position={cubePositions[1]}
            renderMode={renderMode}
          />
          <Cube 
            x={props.cube3X} 
            y={props.cube3Y} 
            z={props.cube3Z} 
            h={props.cube3H}
            position={cubePositions[2]}
            renderMode={renderMode}
          />
          <Cube 
            x={props.cube4X} 
            y={props.cube4Y} 
            z={props.cube4Z} 
            h={props.cube4H}
            position={cubePositions[3]}
            renderMode={renderMode}
          />
          
          {/* Wireframe mesh visualization */}
          <MeshWireframe
            modelType={modelType}
            cube1X={props.cube1X}
            cube1Y={props.cube1Y}
            cube1Z={props.cube1Z}
            cube1H={props.cube1H}
            cube2X={props.cube2X}
            cube2Y={props.cube2Y}
            cube2Z={props.cube2Z}
            cube2H={props.cube2H}
            cube3X={props.cube3X}
            cube3Y={props.cube3Y}
            cube3Z={props.cube3Z}
            cube3H={props.cube3H}
            cube4X={props.cube4X}
            cube4Y={props.cube4Y}
            cube4Z={props.cube4Z}
            cube4H={props.cube4H}
            spacingX={props.spacingX}
            spacingY={props.spacingY}
            cube1OffsetX={props.cube1OffsetX}
            cube1OffsetY={props.cube1OffsetY}
            cube2OffsetX={props.cube2OffsetX}
            cube2OffsetY={props.cube2OffsetY}
            cube3OffsetX={props.cube3OffsetX}
            cube3OffsetY={props.cube3OffsetY}
            cube4OffsetX={props.cube4OffsetX}
            cube4OffsetY={props.cube4OffsetY}
            renderStyle={renderMode}
            forwardMeshSourcesX={props.numSourcesX}
            forwardMeshSourcesY={props.numSourcesY}
            forwardMeshSourcesZ={props.numSourcesZ}
          />
          
          <AxesHelper3D surfaceBounds={props.surfaceBounds} />
        </SyntheticModelCanvas>
      </div>
      <div className="model-3d-controls">
        <h3>4 Cubes Model Parameters</h3>
        <SaveModelViewButton viewRef={viewRef} exportHandleRef={exportHandleRef} filenameBase="four-cubes-model" />

        <div className="control-group">
          <label>Display mesh style:</label>
          <div className="render-style-row">
            <label className="render-style-option">
              <input type="checkbox" checked={renderMode === 'ts'} onChange={() => setRenderMode('ts')} />
              <span>Blue</span>
            </label>
            <label className="render-style-option">
              <input type="checkbox" checked={renderMode === 'python'} onChange={() => setRenderMode('python')} />
              <span>Gray</span>
            </label>
            <label className="render-style-option">
              <input type="checkbox" checked={renderMode === 'dark'} onChange={() => setRenderMode('dark')} />
              <span>Dark Gray</span>
            </label>
          </div>
        </div>

        <ObservationPointsDisplayControl
          displayObservationPoints={props.displayObservationPoints}
          onDisplayObservationPointsChange={props.onDisplayObservationPointsChange}
          numReceiversX={props.numReceiversX}
          numReceiversY={props.numReceiversY}
        />
        
        <div className="parameter-group">
          <h4>Cube 1 (Top-Left)</h4>
          <div className="input-group">
            <label>Horizontal X Dimension (m):</label>
            <input
              type="number"
              value={props.cube1X}
              onChange={(e) => props.onCube1XChange(parseFloat(e.target.value) || 0)}
              min="1"
              step="1"
            />
          </div>
          <div className="input-group">
            <label>Horizontal Y Dimension (m):</label>
            <input
              type="number"
              value={props.cube1Y}
              onChange={(e) => props.onCube1YChange(parseFloat(e.target.value) || 0)}
              min="1"
              step="1"
            />
          </div>
          <div className="input-group">
            <label>Vertical Z Dimension (Depth, m):</label>
            <input
              type="number"
              value={props.cube1Z}
              onChange={(e) => props.onCube1ZChange(parseFloat(e.target.value) || 0)}
              min="1"
              step="1"
            />
          </div>
          <div className="input-group">
            <label>Depth from Surface (h, m):</label>
            <input
              type="number"
              value={props.cube1H}
              onChange={(e) => props.onCube1HChange(parseFloat(e.target.value) || 0)}
              min="0"
              step="10"
            />
          </div>
          <div className="input-group">
            <label>Density (kg/m³):</label>
            <input
              type="number"
              value={props.cube1Density}
              onChange={(e) => props.onCube1DensityChange(parseFloat(e.target.value) || 0)}
              min="0"
              step="10"
            />
          </div>
          <div className="input-group">
            <label>Offset X (m):</label>
            <input
              type="number"
              value={props.cube1OffsetX}
              onChange={(e) => props.onCube1OffsetXChange(parseFloat(e.target.value) || 0)}
              step="1"
            />
          </div>
          <div className="input-group">
            <label>Offset Y (m):</label>
            <input
              type="number"
              value={props.cube1OffsetY}
              onChange={(e) => props.onCube1OffsetYChange(parseFloat(e.target.value) || 0)}
              step="1"
            />
          </div>
        </div>

        <div className="parameter-group">
          <h4>Cube 2 (Top-Right)</h4>
          <div className="input-group">
            <label>Horizontal X Dimension (m):</label>
            <input
              type="number"
              value={props.cube2X}
              onChange={(e) => props.onCube2XChange(parseFloat(e.target.value) || 0)}
              min="1"
              step="1"
            />
          </div>
          <div className="input-group">
            <label>Horizontal Y Dimension (m):</label>
            <input
              type="number"
              value={props.cube2Y}
              onChange={(e) => props.onCube2YChange(parseFloat(e.target.value) || 0)}
              min="1"
              step="1"
            />
          </div>
          <div className="input-group">
            <label>Vertical Z Dimension (Depth, m):</label>
            <input
              type="number"
              value={props.cube2Z}
              onChange={(e) => props.onCube2ZChange(parseFloat(e.target.value) || 0)}
              min="1"
              step="1"
            />
          </div>
          <div className="input-group">
            <label>Depth from Surface (h, m):</label>
            <input
              type="number"
              value={props.cube2H}
              onChange={(e) => props.onCube2HChange(parseFloat(e.target.value) || 0)}
              min="0"
              step="10"
            />
          </div>
          <div className="input-group">
            <label>Density (kg/m³):</label>
            <input
              type="number"
              value={props.cube2Density}
              onChange={(e) => props.onCube2DensityChange(parseFloat(e.target.value) || 0)}
              min="0"
              step="10"
            />
          </div>
          <div className="input-group">
            <label>Offset X (m):</label>
            <input
              type="number"
              value={props.cube2OffsetX}
              onChange={(e) => props.onCube2OffsetXChange(parseFloat(e.target.value) || 0)}
              step="1"
            />
          </div>
          <div className="input-group">
            <label>Offset Y (m):</label>
            <input
              type="number"
              value={props.cube2OffsetY}
              onChange={(e) => props.onCube2OffsetYChange(parseFloat(e.target.value) || 0)}
              step="1"
            />
          </div>
        </div>

        <div className="parameter-group">
          <h4>Cube 3 (Bottom-Left)</h4>
          <div className="input-group">
            <label>Horizontal X Dimension (m):</label>
            <input
              type="number"
              value={props.cube3X}
              onChange={(e) => props.onCube3XChange(parseFloat(e.target.value) || 0)}
              min="1"
              step="1"
            />
          </div>
          <div className="input-group">
            <label>Horizontal Y Dimension (m):</label>
            <input
              type="number"
              value={props.cube3Y}
              onChange={(e) => props.onCube3YChange(parseFloat(e.target.value) || 0)}
              min="1"
              step="1"
            />
          </div>
          <div className="input-group">
            <label>Vertical Z Dimension (Depth, m):</label>
            <input
              type="number"
              value={props.cube3Z}
              onChange={(e) => props.onCube3ZChange(parseFloat(e.target.value) || 0)}
              min="1"
              step="1"
            />
          </div>
          <div className="input-group">
            <label>Depth from Surface (h, m):</label>
            <input
              type="number"
              value={props.cube3H}
              onChange={(e) => props.onCube3HChange(parseFloat(e.target.value) || 0)}
              min="0"
              step="10"
            />
          </div>
          <div className="input-group">
            <label>Density (kg/m³):</label>
            <input
              type="number"
              value={props.cube3Density}
              onChange={(e) => props.onCube3DensityChange(parseFloat(e.target.value) || 0)}
              min="0"
              step="10"
            />
          </div>
          <div className="input-group">
            <label>Offset X (m):</label>
            <input
              type="number"
              value={props.cube3OffsetX}
              onChange={(e) => props.onCube3OffsetXChange(parseFloat(e.target.value) || 0)}
              step="1"
            />
          </div>
          <div className="input-group">
            <label>Offset Y (m):</label>
            <input
              type="number"
              value={props.cube3OffsetY}
              onChange={(e) => props.onCube3OffsetYChange(parseFloat(e.target.value) || 0)}
              step="1"
            />
          </div>
        </div>

        <div className="parameter-group">
          <h4>Cube 4 (Bottom-Right)</h4>
          <div className="input-group">
            <label>Horizontal X Dimension (m):</label>
            <input
              type="number"
              value={props.cube4X}
              onChange={(e) => props.onCube4XChange(parseFloat(e.target.value) || 0)}
              min="1"
              step="1"
            />
          </div>
          <div className="input-group">
            <label>Horizontal Y Dimension (m):</label>
            <input
              type="number"
              value={props.cube4Y}
              onChange={(e) => props.onCube4YChange(parseFloat(e.target.value) || 0)}
              min="1"
              step="1"
            />
          </div>
          <div className="input-group">
            <label>Vertical Z Dimension (Depth, m):</label>
            <input
              type="number"
              value={props.cube4Z}
              onChange={(e) => props.onCube4ZChange(parseFloat(e.target.value) || 0)}
              min="1"
              step="1"
            />
          </div>
          <div className="input-group">
            <label>Depth from Surface (h, m):</label>
            <input
              type="number"
              value={props.cube4H}
              onChange={(e) => props.onCube4HChange(parseFloat(e.target.value) || 0)}
              min="0"
              step="10"
            />
          </div>
          <div className="input-group">
            <label>Density (kg/m³):</label>
            <input
              type="number"
              value={props.cube4Density}
              onChange={(e) => props.onCube4DensityChange(parseFloat(e.target.value) || 0)}
              min="0"
              step="10"
            />
          </div>

          <div className="input-group">
            <label>Offset X (m):</label>
            <input
              type="number"
              value={props.cube4OffsetX}
              onChange={(e) => props.onCube4OffsetXChange(parseFloat(e.target.value) || 0)}
              step="1"
            />
          </div>
          <div className="input-group">
            <label>Offset Y (m):</label>
            <input
              type="number"
              value={props.cube4OffsetY}
              onChange={(e) => props.onCube4OffsetYChange(parseFloat(e.target.value) || 0)}
              step="1"
            />
          </div>
        </div>

        <div className="parameter-group">
          <h4>Mesh Grid</h4>
          <MeshGridSourceControls
            modelType={props.modelType}
            variant="box"
            numSourcesX={props.numSourcesX}
            numSourcesY={props.numSourcesY}
            numSourcesZ={props.numSourcesZ}
            onNumSourcesXChange={props.onNumSourcesXChange}
            onNumSourcesYChange={props.onNumSourcesYChange}
            onNumSourcesZChange={props.onNumSourcesZChange}
            sharedUnstructuredMesh={props.sharedUnstructuredMesh}
          />
        </div>

        <div className="parameter-group">
          <h4>Spacing</h4>
          <div className="input-group">
            <label>Spacing X (m):</label>
            <input
              type="number"
              value={props.spacingX}
              onChange={(e) => props.onSpacingXChange(parseFloat(e.target.value) || 0)}
              min="0"
              step="1"
            />
          </div>
          <div className="input-group">
            <label>Spacing Y (m):</label>
            <input
              type="number"
              value={props.spacingY}
              onChange={(e) => props.onSpacingYChange(parseFloat(e.target.value) || 0)}
              min="0"
              step="1"
            />
          </div>
          <div className="input-group">
            <label>Depth (all cubes, m):</label>
            <input
              type="number"
              value={(props.cube1H + props.cube2H + props.cube3H + props.cube4H) / 4}
              onChange={(e) => {
                const v = Math.max(0, parseFloat(e.target.value) || 0)
                props.onCube1HChange(v)
                props.onCube2HChange(v)
                props.onCube3HChange(v)
                props.onCube4HChange(v)
              }}
              min="0"
              step="10"
              title="Sets depth from surface (h) for all 4 cubes at once"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
