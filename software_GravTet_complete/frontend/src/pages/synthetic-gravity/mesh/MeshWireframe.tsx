/**
 * Synthetic-model **preview wireframe** (Three.js `BufferGeometry` of line segments).
 * Cube, sphere, and valley–mountain models only.
 */
import { useMemo } from 'react'
import { isTetrahedralModel } from '../lib/gmshMeshSupport'
import { getCubeWireStyle, mergeMeshCounts } from '../default_data/defaultSources'
import type { CountSet } from '../default_data/defaultSources'
import { createCubeWireframe } from './cubeMesh'
import { createSphereWireframe } from './sphereMesh'
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
  valleyMountainHeight?: number
  valleyMountainDepth?: number
  position?: [number, number, number]
  rotation?: [number, number, number]
  renderStyle?: WireframeRenderStyle
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
  valleyMountainHeight = 50,
  valleyMountainDepth = 50,
  position = [0, 0, 0],
  rotation,
  renderStyle = 'ts',
  forwardMeshSourcesX,
  forwardMeshSourcesY,
  forwardMeshSourcesZ,
}: MeshWireframeProps) {
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
  const isSolidStyle = true
  const baseModel = (modelType || '').split(' - ')[0]
  const unstructuredTetra = isTetrahedralModel(modelType)
  const sphereUnstructuredTetra = baseModel === 'Sphere' && unstructuredTetra
  const valleyMountainWireStyle = 'unstructuredTetra'
  const lineRadiusBoost = sphereUnstructuredTetra ? 1 : baseModel === 'Sphere' ? 1.01 : 1

  const wireframeGeometry = useMemo(() => {
    if (!modelType) return null
    const bm = modelType.split(' - ')[0]
    switch (bm) {
      case 'Cube': {
        const ws = getCubeWireStyle(modelType || '')
        const wireStyle = ws ?? 'unstructuredTetra'
        return createCubeWireframe(x || 100, y || 100, z || 100, previewCounts, wireStyle, false)
      }
      case 'Valley-Mountain Model':
        return createValleyMountainWireframe(
          x || 200,
          y || 50,
          z || 90,
          valleyMountainHeight,
          valleyMountainDepth,
          previewCounts,
          valleyMountainWireStyle,
        )
      case 'Sphere':
        return createSphereWireframe(
          radius || 100,
          previewCounts,
          isTetra,
          false,
          lineRadiusBoost,
          unstructuredTetra,
          false,
        )
      default:
        return null
    }
  }, [
    modelType,
    x,
    y,
    z,
    radius,
    valleyMountainHeight,
    valleyMountainDepth,
    previewCounts,
    isTetra,
    lineRadiusBoost,
    unstructuredTetra,
    valleyMountainWireStyle,
  ])

  if (!wireframeGeometry) return null

  const wireframeVertexColors = !!wireframeGeometry.getAttribute('color')

  const sphereGray = isSolidStyle && baseModel === 'Sphere'
  const cubeGray = isSolidStyle && baseModel === 'Cube'
  const curvedSolid = isSolidStyle && baseModel === 'Sphere'
  const lineScale = curvedSolid ? (sphereUnstructuredTetra ? 1 : sphereGray ? 1.003 : 1) : cubeGray ? 1 : 1.0008
  const linePolyFactor = isSolidStyle ? (baseModel === 'Sphere' ? -10 : cubeGray ? -8 : -4) : 0
  const linePolyUnits = linePolyFactor

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
