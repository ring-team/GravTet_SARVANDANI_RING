/**
 * Shared minimal 3D shape preview (React Three Fiber canvas only): grid, orbit controls, optional solid mesh.
 *
 * Consumed by Synthetic Magnetic and similar modules so previews stay visually aligned with gravity synthetic views.
 */
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import { AxesHelper3D } from '../scene/AxesHelper3D'
import { EarthSurfacePlane } from '../scene/EarthSurfacePlane'

// --- Params mirror synthetic gravity sliders (subset) ---

export interface ShapePreviewParams {
  modelType: string | null
  cubeX?: number
  cubeY?: number
  cubeZ?: number
  cuboidX?: number
  cuboidY?: number
  cuboidZ?: number
  h?: number
  sphereRadius?: number
  ellipsoidA?: number
  ellipsoidB?: number
  ellipsoidC?: number
  verticalCylinderRadius?: number
  verticalCylinderHeight?: number
  horizontalCylinderRadius?: number
  horizontalCylinderLength?: number
}

// --- Minimal R3F preview (magnetic + gravity catalog) ---

export function ShapePreview(params: ShapePreviewParams) {
  const baseModel = params.modelType?.split(' - ')[0] ?? 'Cube'
  const h = params.h ?? 2
  const x = params.cubeX ?? params.cuboidX ?? 100
  const y = params.cubeY ?? params.cuboidY ?? 100
  const z = params.cubeZ ?? params.cuboidZ ?? 100
  const radius = params.sphereRadius ?? 50
  const cylR = params.verticalCylinderRadius ?? 50
  const cylH = params.verticalCylinderHeight ?? 100
  const hcylR = params.horizontalCylinderRadius ?? 50
  const hcylL = params.horizontalCylinderLength ?? 100

  const positionCube: [number, number, number] = [0, -h - z / 2, 0]
  const positionSphere: [number, number, number] = [0, -h - radius, 0]
  const positionCyl: [number, number, number] = [0, -h - cylH / 2, 0]
  const positionHCyl: [number, number, number] = [0, -h - hcylR, 0]

  const axesX = baseModel === 'Sphere' ? radius * 2 : baseModel === 'Vertical Cylinder' ? cylR * 2 : baseModel === 'Horizontal Cylinder' ? hcylL : x
  const axesY = baseModel === 'Sphere' ? radius * 2 : baseModel === 'Vertical Cylinder' ? cylR * 2 : baseModel === 'Horizontal Cylinder' ? hcylR * 2 : y
  const axesZ = baseModel === 'Sphere' ? radius * 2 : baseModel === 'Vertical Cylinder' ? cylH : baseModel === 'Horizontal Cylinder' ? hcylR * 2 : z

  const material = (
    <meshStandardMaterial
      color="#2563eb"
      metalness={0.3}
      roughness={0.1}
      emissive="#1e40af"
      emissiveIntensity={0.2}
    />
  )

  return (
    <div className="cube-3d-view">
      <Canvas camera={{ position: [400, 400, 400], fov: 50, far: 2000000, near: 0.1 }}>
        <ambientLight intensity={1.0} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} />
        <directionalLight position={[-10, -5, -10]} intensity={0.6} />
        <pointLight position={[0, 0, -500]} intensity={1.5} color="#60a5fa" />
        <EarthSurfacePlane sizeX={axesX} sizeY={axesY} />
        <Grid
          args={[1000, 1000, 50, 50]}
          cellColor="#000000"
          sectionColor="#000000"
          position={[0, 0.01, 0]}
          rotation={[0, 0, 0]}
          renderOrder={1}
        />
        <AxesHelper3D sizeX={axesX} sizeY={axesY} sizeZ={axesZ} depthFromSurface={h} />

        {baseModel === 'Cube' || baseModel === 'Rectangular Prism (Cuboid)' ? (
          <mesh position={positionCube}>
            <boxGeometry args={[x, z, y]} />
            {material}
          </mesh>
        ) : baseModel === 'Sphere' ? (
          <mesh position={positionSphere}>
            <sphereGeometry args={[radius, 32, 32]} />
            {material}
          </mesh>
        ) : baseModel === 'Vertical Cylinder' ? (
          <mesh position={positionCyl} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[cylR, cylR, cylH, 32]} />
            {material}
          </mesh>
        ) : baseModel === 'Horizontal Cylinder' ? (
          <mesh position={positionHCyl} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[hcylR, hcylR, hcylL, 32]} />
            {material}
          </mesh>
        ) : (
          <mesh position={positionCube}>
            <boxGeometry args={[x, z, y]} />
            {material}
          </mesh>
        )}

        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          minDistance={10}
          maxDistance={2000000}
        />
      </Canvas>
    </div>
  )
}
