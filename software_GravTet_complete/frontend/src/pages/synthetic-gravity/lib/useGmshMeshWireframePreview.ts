import { useEffect, useRef, useState } from 'react'
import { api } from '../../../services/api'
import type { ForwardModelParams } from '../../forward-gravity/lib/forwardModelParams'
import { buildGmshMeshPreviewBody, gmshMeshCountPreviewCacheKey } from '../../forward-gravity/lib/forwardGravityMeshRequest'
import type { GmshBuiltMeshPreview } from './gmshMeshSupport'
import { isGmshMeshBuildSupported, isGmshTetrahedralModel } from './gmshMeshSupport'

const GMSH_WIREFRAME_DEBOUNCE_MS = 600
/** Coarser Gmsh build for 3D preview only (forward uses the finer mesh). */
const WIREFRAME_PREVIEW_SIZE_FACTOR = 2.5
const wireframeCache = new Map<string, GmshBuiltMeshPreview>()

export function useGmshMeshWireframePreview(input: {
  model: ForwardModelParams
  numSourcesX: number
  numSourcesY: number
  numSourcesZ: number
  enabled?: boolean
}): { preview: GmshBuiltMeshPreview | null; loading: boolean } {
  const { model, numSourcesX, numSourcesY, numSourcesZ, enabled = true } = input
  const [preview, setPreview] = useState<GmshBuiltMeshPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const requestGenRef = useRef(0)

  useEffect(() => {
    const modelType = model.modelType ?? null
    const active =
      enabled && isGmshTetrahedralModel(modelType) && isGmshMeshBuildSupported(modelType)
    if (!active) {
      setPreview(null)
      setLoading(false)
      return
    }

    const body = buildGmshMeshPreviewBody({
      model,
      numSourcesX,
      numSourcesY,
      numSourcesZ,
    })
    const previewBody = {
      ...body,
      targetElementSize:
        Math.max(0.5, (body.targetElementSize as number) * WIREFRAME_PREVIEW_SIZE_FACTOR),
      wireframePreview: true,
    }
    const cacheKey = `${gmshMeshCountPreviewCacheKey(previewBody)}|wireframe`
    const cached = wireframeCache.get(cacheKey)
    if (cached) {
      setPreview(cached)
      setLoading(false)
      return
    }

    setLoading(true)
    const requestGen = ++requestGenRef.current
    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const built = await api.buildGmshTetraMesh(previewBody)
          if (cancelled || requestGen !== requestGenRef.current) return
          const nodes = built.mesh?.nodes ?? []
          const elements = built.mesh?.elements ?? built.mesh?.tets ?? []
          if (!nodes.length || !elements.length) {
            setPreview(null)
            return
          }
          const next: GmshBuiltMeshPreview = {
            nodes,
            elements,
            stats: {
              numNodes: built.numNodes,
              numElements: built.numElements,
              buildMs: built.buildMs ?? 0,
            },
          }
          wireframeCache.set(cacheKey, next)
          setPreview(next)
        } catch {
          if (!cancelled && requestGen === requestGenRef.current) {
            setPreview(null)
          }
        } finally {
          if (!cancelled && requestGen === requestGenRef.current) {
            setLoading(false)
          }
        }
      })()
    }, GMSH_WIREFRAME_DEBOUNCE_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    enabled,
    model.modelType,
    model.gmshTargetElementSize,
    model.gmshSurfaceRefinement,
    model.gmshLocalRefinementNearEdges,
    model.h,
    model.density,
    model.cubeX,
    model.cubeY,
    model.cubeZ,
    model.sphereRadius,
    model.ellipsoidA,
    model.ellipsoidB,
    model.ellipsoidC,
    model.verticalCylinderRadius,
    model.verticalCylinderHeight,
    model.horizontalCylinderRadius,
    model.horizontalCylinderLength,
    model.faultedBlockX,
    model.faultedBlockY,
    model.faultedBlockZ,
    model.faultedBlockFaultOffset,
    model.valleyMountainX,
    model.valleyMountainY,
    model.valleyMountainZ,
    model.valleyMountainHeight,
    model.valleyMountainDepth,
    model.valleyMountainMountainDensity,
    model.valleyMountainValleyDensity,
    model.valleyMountainHalfSpaceDensity,
    model.cube1X,
    model.cube1Y,
    model.cube1Z,
    model.cube2X,
    model.cube2Y,
    model.cube2Z,
    model.cube3X,
    model.cube3Y,
    model.cube3Z,
    model.cube4X,
    model.cube4Y,
    model.cube4Z,
    model.spacingX,
    model.spacingY,
    numSourcesX,
    numSourcesY,
    numSourcesZ,
  ])

  return { preview, loading }
}
