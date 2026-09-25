/**
 * Labeled axes + optional bounding box for synthetic 3D previews (ticks, color-coded X/Y/Z semantics).
 *
 * Maps UI “depth” to Three.js Y (green); horizontal plane uses X (red) and Z (blue) per inline prop docs.
 */
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import type { SurfaceBounds } from '../lib/surfaceBounds'
import { horizontalHalfExtentsFromSurfaceBounds } from '../lib/surfaceBounds'

// --- Props: axis lengths mirror model extents (Y = depth in scene) ---

interface AxesHelper3DProps {
  sizeX?: number      // Model X dimension
  sizeY?: number      // Model Y dimension
  sizeZ?: number      // Model Z dimension (depth)
  depthFromSurface?: number  // Depth from surface (h) - adds to Z axis extent
  /** When false, hides the large wireframe cube (axes + ticks still shown). */
  showBoundingBox?: boolean
  /** Smaller tick/label sizes (world units) so labels do not dominate the view. */
  compact?: boolean
  /** Light text on dark canvas (e.g. initial model scene). */
  darkTheme?: boolean
  /** When set, horizontal X/Y axis length matches the forward observation map (same as red dots). */
  surfaceBounds?: SurfaceBounds
}

// --- Tick labels + optional bounding box (X/Z horizontal, Y depth) ---

export function AxesHelper3D({ 
  sizeX = 200, 
  sizeY = 200, 
  sizeZ = 200,
  depthFromSurface = 0,
  showBoundingBox = true,
  compact = false,
  darkTheme = false,
  surfaceBounds,
}: AxesHelper3DProps) {
  const tickFs = compact ? 8 : 12
  const nameFs = compact ? 10 : 16
  const nameFsZ = compact ? 9 : 14
  const tickOff = compact ? 10 : 15
  const nameOff = compact ? 14 : 25
  const tickColor = darkTheme ? '#e8eaef' : '#000000'
  const tickOutline = darkTheme ? '#111827' : '#ffffff'
  const nameOutline = darkTheme ? '#0f172a' : '#000000'
  const mapHalf = surfaceBounds ? horizontalHalfExtentsFromSurfaceBounds(surfaceBounds) : null
  // Horizontal axes: use forward map half-extent when available, else 1.5× model size.
  const extentX = mapHalf ? mapHalf.halfX : sizeX * 1.5
  const extentY = mapHalf ? mapHalf.halfY : sizeY * 1.5
  const extentZ = (sizeZ + depthFromSurface) * 1.5
  const zPositiveMax = 200
  const zNegativeMin = -Math.max(200, extentZ)
  
  // Calculate tick spacing for each axis independently based on axis size
  // Adaptive step sizes: < 100: step 20, < 500: step 50, < 1000: step 100, etc.
  const calculateTickSpacing = (extent: number): number => {
    const maxValue = extent * 2 // Total range from -extent to +extent
    if (maxValue < 100) return 20
    if (maxValue < 500) return 50
    if (maxValue < 1000) return 100
    if (maxValue < 2000) return 200
    if (maxValue < 5000) return 500
    if (maxValue < 10000) return 1000
    if (maxValue < 20000) return 2000
    if (maxValue < 50000) return 5000
    return 10000
  }
  
  const tickSpacingX = calculateTickSpacing(extentX)
  const tickSpacingY = calculateTickSpacing(extentY)
  const tickSpacingZ = tickSpacingX
  
  // Generate tick values for each axis
  const tickValuesX: number[] = []
  for (let i = Math.ceil(-extentX / tickSpacingX); i <= Math.floor(extentX / tickSpacingX); i++) {
    tickValuesX.push(i * tickSpacingX)
  }
  
  const tickValuesY: number[] = []
  for (let i = Math.ceil(-extentY / tickSpacingY); i <= Math.floor(extentY / tickSpacingY); i++) {
    tickValuesY.push(i * tickSpacingY)
  }
  
  const tickValuesZ: number[] = []
  for (let i = Math.ceil(zNegativeMin / tickSpacingZ); i <= Math.floor(zPositiveMax / tickSpacingZ); i++) {
    tickValuesZ.push(i * tickSpacingZ)
  }
  
  // Wireframe box: X/Y match horizontal axes; depth (Three.js Y) from surface (0) down only.
  const boxWidth = extentX * 2
  const boxDepth = extentY * 2
  const boxHeight = -zNegativeMin
  const boxGeometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth)
  const edges = new THREE.EdgesGeometry(boxGeometry)
  const boxCenterY = zNegativeMin / 2
  
  return (
    <group>
      {showBoundingBox && (
        <group position={[0, boxCenterY, 0]}>
          <lineSegments geometry={edges}>
            <lineBasicMaterial color="#888888" opacity={0.5} transparent />
          </lineSegments>
        </group>
      )}
      
      {/* X Axis (Red) - Horizontal X - scales independently with sizeX */}
      <group>
        <mesh rotation={[0, 0, -Math.PI / 2]}>
          <cylinderGeometry args={[1, 1, extentX * 2, 8]} />
          <meshStandardMaterial color="#ff4444" />
        </mesh>
        <mesh position={[extentX, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[6, 15, 8]} />
          <meshStandardMaterial color="#ff4444" />
        </mesh>
        {tickValuesX.map((value) => (
          <group key={`x-tick-${value}`}>
            <mesh position={[value, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <boxGeometry args={[1, 10, 1]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            <Text
              position={[value, tickOff, 0]}
              fontSize={tickFs}
              color={tickColor}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.2}
              outlineColor={tickOutline}
            >
              {value.toFixed(0)}
            </Text>
          </group>
        ))}
        <Text
          position={[extentX + nameOff, 0, 0]}
          fontSize={nameFs}
          color="#ff4444"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.5}
          outlineColor={nameOutline}
        >
          X (m)
        </Text>
      </group>

      {/* Z Axis (Green) - Depth (vertical in 3D, but represents depth downward) - scales independently with sizeZ + depthFromSurface */}
      <group>
        <mesh position={[0, (zPositiveMax + zNegativeMin) / 2, 0]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[1, 1, zPositiveMax - zNegativeMin, 8]} />
          <meshStandardMaterial color="#44ff44" />
        </mesh>
        <mesh position={[0, zPositiveMax, 0]} rotation={[0, 0, 0]}>
          <coneGeometry args={[6, 15, 8]} />
          <meshStandardMaterial color="#44ff44" />
        </mesh>
        {tickValuesZ.map((value) => (
          <group key={`z-tick-${value}`}>
            <mesh position={[0, value, 0]}>
              <boxGeometry args={[1, 10, 1]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            <Text
              position={[tickOff, value, 0]}
              fontSize={tickFs}
              color={tickColor}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.2}
              outlineColor={tickOutline}
            >
              {value.toFixed(0)}
            </Text>
          </group>
        ))}
        <Text
          position={[0, zPositiveMax + nameOff, 0]}
          fontSize={nameFsZ}
          color="#44ff44"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.5}
          outlineColor={nameOutline}
        >
          Z (m)
        </Text>
      </group>

      {/* Y Axis (Blue) - Horizontal Y - scales independently with sizeY */}
      <group>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[1, 1, extentY * 2, 8]} />
          <meshStandardMaterial color="#4444ff" />
        </mesh>
        <mesh position={[0, 0, extentY]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[6, 15, 8]} />
          <meshStandardMaterial color="#4444ff" />
        </mesh>
        {tickValuesY.map((value) => (
          <group key={`y-tick-${value}`}>
            <mesh position={[0, 0, value]} rotation={[Math.PI / 2, 0, 0]}>
              <boxGeometry args={[1, 10, 1]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            <Text
              position={[0, 0, value + tickOff]}
              fontSize={tickFs}
              color={tickColor}
              anchorX="center"
              anchorY="middle"
              rotation={[-Math.PI / 2, 0, 0]}
              outlineWidth={0.2}
              outlineColor={tickOutline}
            >
              {value.toFixed(0)}
            </Text>
          </group>
        ))}
        <Text
          position={[0, 0, extentY + nameOff]}
          fontSize={nameFs}
          color="#4444ff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.5}
          outlineColor={nameOutline}
        >
          Y (m)
        </Text>
      </group>
    </group>
  )
}
