/**
 * Synthetic-model **preview wireframe** (Three.js `BufferGeometry` of line segments).
 *
 * Picks the right builder from `modelType` (cube, sphere, ellipsoid, cylinders, 4 cubes),
 * merges forward-model source counts from props, and applies style tweaks (e.g. gray / unstructured).
 *
 * **Does not** run physics; it only visualizes discretization density for the selected shape + mesh mode.
 * Blue / Gray / Dark Gray all show mesh lines on the solid model (no source markers).
 */
import { useMemo } from 'react'
import { isTetrahedralModel } from '../lib/gmshMeshSupport'
import { getCubeWireStyle, getDefaultCounts, mergeMeshCounts } from '../default_data/defaultSources'
import type { CountSet } from '../default_data/defaultSources'
import { createCubeWireframe } from './cubeMesh'
import { createCuboidWireframe } from './cuboidMesh'
import { createSphereWireframe } from './sphereMesh'
import { createEllipsoidWireframe } from './ellipsoidMesh'
import { createFourCubesWireframe } from './fourCubesMesh'
import { createCylinderVerticalWireframe } from './cylinderVerticalMesh'
import { createCylinderHorizontalWireframe } from './cylinderHorizontalMesh'
import { createFaultedBlockWireframe } from './faultedBlockMesh'
import { createValleyMountainWireframe } from './valleyMountainMesh'

type WireframeRenderStyle = 'ts' | 'python' | 'dark'

const MAX_PREVIEW_AXIS_SAMPLES = 220
const MAX_PREVIEW_TOTAL_SAMPLES = 220_000

function capPreviewCounts(counts: CountSet): CountSet {
  const keys: (keyof CountSet)[] = [
    'numSourcesX',
    'numSourcesY',
    'numSourcesZ',
    'numSourcesRadial',
    'numSourcesTheta',
    'numSourcesPhi',
    'numSourcesLength',
  ]

  const bounded: CountSet = {}
  for (const key of keys) {
    const raw = counts[key]
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
      bounded[key] = Math.max(1, Math.min(MAX_PREVIEW_AXIS_SAMPLES, Math.floor(raw)))
    }
  }

  const x = bounded.numSourcesX ?? bounded.numSourcesRadial ?? 1
  const y = bounded.numSourcesY ?? bounded.numSourcesTheta ?? 1
  const z = bounded.numSourcesZ ?? bounded.numSourcesPhi ?? bounded.numSourcesLength ?? 1
  const total = x * y * z
  if (total <= MAX_PREVIEW_TOTAL_SAMPLES) return bounded

  const scale = Math.cbrt(MAX_PREVIEW_TOTAL_SAMPLES / total)
  for (const key of keys) {
    const v = bounded[key]
    if (typeof v === 'number') {
      bounded[key] = Math.max(1, Math.floor(v * scale))
    }
  }
  return bounded
}

interface MeshWireframeProps {
  modelType: string | null
  x?: number
  y?: number
  z?: number
  radius?: number
  a?: number
  b?: number
  c?: number
  cylinderRadius?: number
  cylinderHeight?: number
  cylinderLength?: number
  valleyMountainHeight?: number
  valleyMountainDepth?: number
  cube1X?: number
  cube1Y?: number
  cube1Z?: number
  cube1H?: number
  cube2X?: number
  cube2Y?: number
  cube2Z?: number
  cube2H?: number
  cube3X?: number
  cube3Y?: number
  cube3Z?: number
  cube3H?: number
  cube4X?: number
  cube4Y?: number
  cube4Z?: number
  cube4H?: number
  spacingX?: number
  spacingY?: number
  cube1OffsetX?: number
  cube1OffsetY?: number
  cube2OffsetX?: number
  cube2OffsetY?: number
  cube3OffsetX?: number
  cube3OffsetY?: number
  cube4OffsetX?: number
  cube4OffsetY?: number
  position?: [number, number, number]
  rotation?: [number, number, number]
  renderStyle?: WireframeRenderStyle
  /** Forward-model source grid (same as API); merged per body type so the wireframe matches calculation density. */
  forwardMeshSourcesX?: number
  forwardMeshSourcesY?: number
  forwardMeshSourcesZ?: number
}

export function MeshWireframe({
  modelType,
  x,
  y,
  z,
  radius,
  a,
  b,
  c,
  cylinderRadius,
  cylinderHeight,
  cylinderLength,
  valleyMountainHeight = 50,
  valleyMountainDepth = 50,
  cube1X,
  cube1Y,
  cube1Z,
  cube1H,
  cube2X,
  cube2Y,
  cube2Z,
  cube2H,
  cube3X,
  cube3Y,
  cube3Z,
  cube3H,
  cube4X,
  cube4Y,
  cube4Z,
  cube4H,
  spacingX,
  spacingY,
  cube1OffsetX = 0,
  cube1OffsetY = 0,
  cube2OffsetX = 0,
  cube2OffsetY = 0,
  cube3OffsetX = 0,
  cube3OffsetY = 0,
  cube4OffsetX = 0,
  cube4OffsetY = 0,
  position = [0, 0, 0],
  rotation,
  renderStyle = 'ts',
  forwardMeshSourcesX,
  forwardMeshSourcesY,
  forwardMeshSourcesZ,
}: MeshWireframeProps) {
  const { mode } = getDefaultCounts(modelType || undefined)
  const counts = useMemo(() => {
    if (
      forwardMeshSourcesX === undefined &&
      forwardMeshSourcesY === undefined &&
      forwardMeshSourcesZ === undefined
    ) {
      return mergeMeshCounts(modelType, undefined)
    }
    return mergeMeshCounts(modelType, {
      numSourcesX: forwardMeshSourcesX,
      numSourcesY: forwardMeshSourcesY,
      numSourcesZ: forwardMeshSourcesZ,
    })
  }, [modelType, forwardMeshSourcesX, forwardMeshSourcesY, forwardMeshSourcesZ])
  const previewCounts = useMemo(() => capPreviewCounts(counts), [counts])
  const isTetra = true // tetrahedral only for this release
  const isPythonStyle = renderStyle === 'python'
  const isDarkStyle = renderStyle === 'dark'
  // All display styles (Blue / Gray / Dark Gray) show mesh lines on the solid only — no source markers.
  const isSolidStyle = true
  const baseModel = (modelType || '').split(' - ')[0]
  const unstructuredTetra = isTetrahedralModel(modelType)
  const sphereUnstructuredTetra = baseModel === 'Sphere' && unstructuredTetra
  const ellipsoidUnstructuredTetra = baseModel === 'Ellipsoid' && unstructuredTetra
  const fourCubesWireStyle = 'unstructuredTetra'
  const faultedBlockWireStyle = 'unstructuredTetra'
  const valleyMountainWireStyle = 'unstructuredTetra'
  const isCylinderBase =
    baseModel === 'Vertical Cylinder' || baseModel === 'Horizontal Cylinder'
  const cuboidGray =
    isSolidStyle && (baseModel === 'Cube' || baseModel === 'Rectangular Prism (Cuboid)')
  const sphereGray = isSolidStyle && baseModel === 'Sphere'
  const ellipsoidGray = isSolidStyle && baseModel === 'Ellipsoid'
  const cylinderGray =
    isSolidStyle && (baseModel === 'Vertical Cylinder' || baseModel === 'Horizontal Cylinder')
  // Sphere: slight uniform radial inflation in Gray reduces z-fight vs analytic solid.
  // Ellipsoid structured modes should sit on the surface (no visual gap).
  // Cylinder (all mesh modes): keep boost at 1 so wireframe matches solid.
  const lineRadiusBoost =
    sphereUnstructuredTetra || ellipsoidUnstructuredTetra ? 1
    : isCylinderBase ? 1
    : sphereGray ? 1.01
    : ellipsoidGray ? 1
    : 1

  const wireframeGeometry = useMemo(() => {
    if (!modelType) return null
    const baseModel = modelType.split(' - ')[0]
    switch (baseModel) {
      case 'Cube': {
        const ws = getCubeWireStyle(modelType || '')
        const wireStyle = ws ?? 'unstructuredTetra'
        return createCubeWireframe(x || 100, y || 100, z || 100, previewCounts, wireStyle, false)
      }
      case 'Rectangular Prism (Cuboid)': {
        const ws = getCubeWireStyle(modelType || '')
        const wireStyle = ws ?? 'unstructuredTetra'
        return createCuboidWireframe(x || 100, y || 100, z || 100, previewCounts, wireStyle, false)
      }
      case 'Faulted Block Model':
        return createFaultedBlockWireframe(
          x || 100,
          y || 100,
          z || 100,
          previewCounts,
          faultedBlockWireStyle,
          false
        )
      case 'Valley-Mountain Model':
        return createValleyMountainWireframe(
          x || 200,
          y || 50,
          z || 90,
          valleyMountainHeight,
          valleyMountainDepth,
          previewCounts,
          valleyMountainWireStyle
        )
      case 'Sphere':
        return createSphereWireframe(radius || 100, previewCounts, isTetra, false, lineRadiusBoost, unstructuredTetra, false)
      case 'Ellipsoid':
        return createEllipsoidWireframe(a || 100, b || 100, c || 150, previewCounts, isTetra, false, lineRadiusBoost, unstructuredTetra, false)
      case 'Vertical Cylinder':
        return createCylinderVerticalWireframe(cylinderRadius || 50, cylinderHeight || 100, previewCounts, isTetra, false, lineRadiusBoost, unstructuredTetra, false)
      case 'Horizontal Cylinder':
        return createCylinderHorizontalWireframe(cylinderRadius || 50, cylinderLength || 100, previewCounts, isTetra, false, lineRadiusBoost, unstructuredTetra, false)
      case '4 Cubes':
        return createFourCubesWireframe(
          cube1X || 20, cube1Y || 20, cube1Z || 20, cube1H || 2,
          cube2X || 20, cube2Y || 20, cube2Z || 20, cube2H || 2,
          cube3X || 20, cube3Y || 20, cube3Z || 20, cube3H || 2,
          cube4X || 20, cube4Y || 20, cube4Z || 20, cube4H || 2,
          spacingX || 30, spacingY || 30,
          cube1OffsetX, cube1OffsetY, cube2OffsetX, cube2OffsetY, cube3OffsetX, cube3OffsetY, cube4OffsetX, cube4OffsetY,
          previewCounts, fourCubesWireStyle, false
        )
      default:
        return null
    }
  }, [
    modelType, x, y, z, radius, a, b, c, cylinderRadius, cylinderHeight, cylinderLength, valleyMountainHeight, valleyMountainDepth,
    cube1X, cube1Y, cube1Z, cube1H, cube2X, cube2Y, cube2Z, cube2H, cube3X, cube3Y, cube3Z, cube3H, cube4X, cube4Y, cube4Z, cube4H,
    spacingX, spacingY, cube1OffsetX, cube1OffsetY, cube2OffsetX, cube2OffsetY, cube3OffsetX, cube3OffsetY, cube4OffsetX, cube4OffsetY,
    previewCounts, isTetra, isPythonStyle, isDarkStyle, lineRadiusBoost, renderStyle, fourCubesWireStyle, faultedBlockWireStyle, valleyMountainWireStyle
  ])

  if (!wireframeGeometry) return null

  const wireframeVertexColors = !!wireframeGeometry.getAttribute('color')

  // Gray + depthTest: curved surfaces are coplanar with lines → z-fight unless we bias lines forward.
  const curvedSolid =
    isSolidStyle &&
    (baseModel === 'Sphere' ||
      baseModel === 'Ellipsoid' ||
      baseModel === 'Vertical Cylinder' ||
      baseModel === 'Horizontal Cylinder')
  const lineScale = curvedSolid
    ? (
        sphereUnstructuredTetra ? 1
        : ellipsoidUnstructuredTetra ? 1
        : isCylinderBase ? 1
        : sphereGray ? 1.003
        : ellipsoidGray ? 1
        : 1.002
      )
    : cuboidGray ? 1 : 1.0008
  const linePolyFactor = isSolidStyle
    ? (cylinderGray ? -20 : baseModel === 'Sphere' || baseModel === 'Ellipsoid' ? -10 : cuboidGray ? -8 : -4)
    : 0
  const linePolyUnits = isSolidStyle
    ? (cylinderGray ? -20 : baseModel === 'Sphere' || baseModel === 'Ellipsoid' ? -10 : cuboidGray ? -8 : -4)
    : 0

  // Force a new THREE.LineSegments when counts change — R3F can otherwise keep the first BufferGeometry attached.
  const wireframeInstanceKey = `${modelType ?? ''}|${previewCounts.numSourcesX ?? previewCounts.numSourcesRadial ?? ''}|${previewCounts.numSourcesY ?? previewCounts.numSourcesTheta ?? ''}|${previewCounts.numSourcesZ ?? previewCounts.numSourcesPhi ?? previewCounts.numSourcesLength ?? ''}`

  return (
    <group position={position} rotation={rotation}>
      <lineSegments
        key={wireframeInstanceKey}
        geometry={wireframeGeometry}
        scale={[lineScale, lineScale, lineScale]}
        renderOrder={100}
      >
        <lineBasicMaterial
          color={
            wireframeVertexColors
              ? '#ffffff'
              : isDarkStyle
                ? '#ffffff'
                : isPythonStyle
                  ? '#111827'
                  : '#000000'
          }
          vertexColors={wireframeVertexColors}
          linewidth={1}
          depthTest={isSolidStyle}
          depthWrite={false}
          transparent={isSolidStyle}
          opacity={isSolidStyle ? 0.95 : 1}
          polygonOffset={isSolidStyle}
          polygonOffsetFactor={linePolyFactor}
          polygonOffsetUnits={linePolyUnits}
        />
      </lineSegments>
    </group>
  )
}
