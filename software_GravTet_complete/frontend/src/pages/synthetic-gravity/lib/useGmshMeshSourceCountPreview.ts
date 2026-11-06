import { useEffect, useRef } from 'react'
import { api } from '../../../services/api'
import type { ForwardModelParams } from '../../forward-gravity/lib/forwardModelParams'
import { buildGmshMeshCountPreviewBody } from '../../forward-gravity/lib/forwardGravityMeshRequest'
import type { GmshMeshBuildStats } from './gmshMeshSupport'
import { isGmshMeshBuildSupported, isGmshTetrahedralModel } from './gmshMeshSupport'
import {
  applyGmshMeshWarmReadiness,
  clearGmshMeshServerWarmed,
  getGmshMeshPreviewStats,
  gmshMeshPreviewCacheKey,
  isGmshMeshCalculateReady,
  setGmshMeshPreviewStats,
} from './gmshMeshPreviewCache'

/** Debounce so proxy numSources settle before warming the server-side Gmsh mesh cache. */
const GMSH_PREVIEW_DEBOUNCE_MS = 400

export function useGmshMeshSourceCountPreview(input: {
  model: ForwardModelParams
  numSourcesX: number
  numSourcesY: number
  numSourcesZ: number
  /** When true, warm the server-side Gmsh cache in the background for this mesh key. */
  allowNetwork: boolean
  onStats: (stats: GmshMeshBuildStats | null) => void
  onLoadingChange: (loading: boolean) => void
  onCalculateReadyChange?: (ready: boolean) => void
}): void {
  const { model, numSourcesX, numSourcesY, numSourcesZ, allowNetwork, onStats, onLoadingChange, onCalculateReadyChange } =
    input
  const onStatsRef = useRef(onStats)
  const onLoadingRef = useRef(onLoadingChange)
  const onCalculateReadyRef = useRef(onCalculateReadyChange)
  const lastCacheKeyRef = useRef<string | null>(null)
  const requestGenRef = useRef(0)
  onStatsRef.current = onStats
  onLoadingRef.current = onLoadingChange
  onCalculateReadyRef.current = onCalculateReadyChange

  useEffect(() => {
    const modelType = model.modelType ?? null
    const enabled = isGmshTetrahedralModel(modelType) && isGmshMeshBuildSupported(modelType)
    if (!enabled) {
      lastCacheKeyRef.current = null
      onStatsRef.current(null)
      onLoadingRef.current(false)
      onCalculateReadyRef.current?.(true)
      return
    }

    const cacheKey = gmshMeshPreviewCacheKey(model, numSourcesX, numSourcesY, numSourcesZ)
    const cached = getGmshMeshPreviewStats(cacheKey)
    const alreadyReady = isGmshMeshCalculateReady(cacheKey)
    const shouldWarmServer = allowNetwork && !alreadyReady

    lastCacheKeyRef.current = cacheKey
    onCalculateReadyRef.current?.(alreadyReady)

    if (cached) {
      onStatsRef.current(cached)
    } else if (!allowNetwork) {
      onStatsRef.current(null)
      onLoadingRef.current(false)
      return
    }

    if (!shouldWarmServer) {
      onLoadingRef.current(false)
      return
    }

    onLoadingRef.current(true)

    const requestGen = ++requestGenRef.current
    let cancelled = false
    const body = buildGmshMeshCountPreviewBody({
      model,
      numSourcesX,
      numSourcesY,
      numSourcesZ,
    })
    const timer = window.setTimeout(() => {
      void (async () => {
        let calculateReady = false
        try {
          const built = await api.buildGmshTetraMesh(body)
          if (cancelled || requestGen !== requestGenRef.current) return
          const stats: GmshMeshBuildStats = {
            numNodes: built.numNodes,
            numElements: built.numElements,
            buildMs: built.buildMs ?? 0,
          }
          setGmshMeshPreviewStats(cacheKey, stats)
          calculateReady = applyGmshMeshWarmReadiness(cacheKey, built)
          onStatsRef.current(stats)
          onCalculateReadyRef.current?.(calculateReady)
        } catch {
          if (!cancelled && requestGen === requestGenRef.current) {
            clearGmshMeshServerWarmed(cacheKey)
            onCalculateReadyRef.current?.(false)
            if (!cached) {
              onStatsRef.current(null)
            }
          }
        } finally {
          if (!cancelled && requestGen === requestGenRef.current) {
            onLoadingRef.current(!calculateReady)
          }
        }
      })()
    }, GMSH_PREVIEW_DEBOUNCE_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    allowNetwork,
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
    model.sphereDensity,
    model.ellipsoidA,
    model.ellipsoidB,
    model.ellipsoidC,
    model.ellipsoidDensity,
    model.verticalCylinderRadius,
    model.verticalCylinderHeight,
    model.verticalCylinderDensity,
    model.horizontalCylinderRadius,
    model.horizontalCylinderLength,
    model.horizontalCylinderDensity,
    model.faultedBlockX,
    model.faultedBlockY,
    model.faultedBlockZ,
    model.faultedBlockFaultOffset,
    model.valleyMountainHalfSpaceDensity,
    model.valleyMountainMountainDensity,
    model.valleyMountainValleyDensity,
    model.valleyMountainX,
    model.valleyMountainY,
    model.valleyMountainZ,
    model.valleyMountainHeight,
    model.valleyMountainDepth,
    model.cube1X,
    model.cube1Y,
    model.cube1Z,
    model.cube1Density,
    model.cube2X,
    model.cube2Y,
    model.cube2Z,
    model.cube2Density,
    model.cube3X,
    model.cube3Y,
    model.cube3Z,
    model.cube3Density,
    model.cube4X,
    model.cube4Y,
    model.cube4Z,
    model.cube4Density,
    model.spacingX,
    model.spacingY,
    numSourcesX,
    numSourcesY,
    numSourcesZ,
  ])
}
