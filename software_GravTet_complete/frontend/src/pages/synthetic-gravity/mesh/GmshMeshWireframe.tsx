import { useMemo } from 'react'
import type { ForwardModelParams } from '../../forward-gravity/lib/forwardModelParams'
import { useGmshMeshWireframePreview } from '../lib/useGmshMeshWireframePreview'
import { isGmshMeshBuildSupported, isGmshTetrahedralModel } from '../lib/gmshMeshSupport'
import { buildGmshTetWireframeGeometry } from './gmshTetWireframeGeometry'

type WireframeRenderStyle = 'ts' | 'python' | 'dark'

export function GmshMeshWireframe({
  modelType,
  gmshPreviewModel,
  numSourcesX,
  numSourcesY,
  numSourcesZ,
  renderStyle = 'ts',
}: {
  modelType: string | null
  gmshPreviewModel: ForwardModelParams
  numSourcesX: number
  numSourcesY: number
  numSourcesZ: number
  renderStyle?: WireframeRenderStyle
}) {
  const enabled =
    isGmshTetrahedralModel(modelType) && isGmshMeshBuildSupported(modelType)
  const { preview } = useGmshMeshWireframePreview({
    model: gmshPreviewModel,
    numSourcesX,
    numSourcesY,
    numSourcesZ,
    enabled,
  })

  const geometry = useMemo(() => {
    if (!preview) return null
    return buildGmshTetWireframeGeometry(preview.nodes, preview.elements)
  }, [preview])

  if (!enabled || !geometry) return null

  const isPythonStyle = renderStyle === 'python'
  const isDarkStyle = renderStyle === 'dark'
  const isSolidStyle = true

  return (
    <lineSegments geometry={geometry} renderOrder={100}>
      <lineBasicMaterial
        color={isDarkStyle ? '#e5e7eb' : isPythonStyle ? '#4b5563' : '#000000'}
        linewidth={1}
        depthTest={isSolidStyle}
        depthWrite={false}
        transparent
        opacity={isSolidStyle ? 0.75 : 0.9}
        polygonOffset={isSolidStyle}
        polygonOffsetFactor={isSolidStyle ? -4 : 0}
        polygonOffsetUnits={isSolidStyle ? -4 : 0}
      />
    </lineSegments>
  )
}
