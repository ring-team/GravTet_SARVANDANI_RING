/**
 * `useForwardModelControls`: owns the shared forward-gravity observation grid and mesh
 * controls that every solver view consumes, so `App` stays a thin composition layer.
 *
 * Encapsulates:
 *  - source/receiver grid counts + "display observation points" toggle
 *  - unstructured (gmsh) mesh sizing sliders + live source-count preview
 *  - catalog-driven defaults applied when the active model identity changes
 *  - the derived `forwardGravityModel` geometry (via `useForwardGravityModel`)
 *  - `forwardMethodBaseProps`: the single model + grid props object spread into each view
 *  - per-method `forwardRunMeta` (timing/labels) keyed by view
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ViewKey } from '../../../types/view'
import type { ForwardRunMeta } from '../lib/forwardRunMeta'
import { getDefaultForwardSourceCounts } from '../../synthetic-gravity/default_data/defaultSources'
import {
  cubeUnstructuredDefaults,
  getProxyMeshSliderDefaults,
} from '../../synthetic-gravity/mesh/unstructuredMeshSliderDefaults'
import type { GmshMeshBuildStats } from '../../synthetic-gravity/lib/gmshMeshSupport'
import { useGmshMeshSourceCountPreview } from '../../synthetic-gravity/lib/useGmshMeshSourceCountPreview'
import { isGmshTetrahedralModel } from '../../synthetic-gravity/lib/gmshMeshSupport'
import { gravityViews } from '../../../routes/gravityViews'
import { useForwardGravityModel, type SyntheticParameters } from './useForwardGravityModel'

export interface UseForwardModelControlsArgs {
  view: ViewKey
  gravityModel: string | null
  params: SyntheticParameters
}

export function useForwardModelControls({ view, gravityModel, params }: UseForwardModelControlsArgs) {
  // --- Shared source / receiver grid counts (same for all methods) ---
  const [forwardNumSourcesX, setForwardNumSourcesX] = useState(40)
  const [forwardNumSourcesY, setForwardNumSourcesY] = useState(40)
  const [forwardNumSourcesZ, setForwardNumSourcesZ] = useState(20)
  const [forwardNumReceiversX, setForwardNumReceiversX] = useState(100)
  const [forwardNumReceiversY, setForwardNumReceiversY] = useState(100)
  const [displayObservationPoints, setDisplayObservationPoints] = useState(false)

  // --- Unstructured (gmsh) mesh sizing controls + live source-count preview ---
  const unstructuredMeshDefaults = cubeUnstructuredDefaults.tetra
  const [forwardUnstructuredTargetElementSize, setForwardUnstructuredTargetElementSize] = useState(
    unstructuredMeshDefaults.targetElementSize,
  )
  const [forwardUnstructuredSurfaceRefinement, setForwardUnstructuredSurfaceRefinement] = useState(
    unstructuredMeshDefaults.surfaceRefinement,
  )
  const [forwardUnstructuredLocalRefinementNearEdges, setForwardUnstructuredLocalRefinementNearEdges] = useState(
    unstructuredMeshDefaults.localRefinementNearEdges,
  )
  const [gmshLastBuildStats, setGmshLastBuildStats] = useState<GmshMeshBuildStats | null>(null)
  const [gmshPreviewLoading, setGmshPreviewLoading] = useState(false)
  // Start false for Gmsh models; useGmshMeshSourceCountPreview sets true once server reports calculateReady.
  const [gmshMeshCalculateReady, setGmshMeshCalculateReady] = useState(false)

  const gmshMeshSizingProps = useMemo(
    () => ({
      gmshTargetElementSize: forwardUnstructuredTargetElementSize,
      gmshSurfaceRefinement: forwardUnstructuredSurfaceRefinement,
      gmshLocalRefinementNearEdges: forwardUnstructuredLocalRefinementNearEdges,
    }),
    [
      forwardUnstructuredTargetElementSize,
      forwardUnstructuredSurfaceRefinement,
      forwardUnstructuredLocalRefinementNearEdges,
    ],
  )

  // --- Per-method forward run metadata (timing/labels), keyed by view ---
  const [forwardRunMetaByKey, setForwardRunMetaByKey] = useState<Record<string, ForwardRunMeta>>({})
  const onForwardRunMetaSet = useCallback((key: string, meta: ForwardRunMeta) => {
    setForwardRunMetaByKey((prev) => ({ ...prev, [key]: meta }))
  }, [])
  const resetForwardRunMeta = useCallback(() => setForwardRunMetaByKey({}), [])

  // --- Catalog-driven defaults: apply when the active model identity changes (not every render) ---
  /** Active gravity catalog model driving catalog mesh defaults for the shared X/Y/Z triple. */
  const meshCatalogModel = useMemo(() => {
    if (view === 'initial_model_gravity') return null
    if (gravityModel && gravityViews.includes(view)) return gravityModel
    return null
  }, [view, gravityModel])

  useEffect(() => {
    if (!meshCatalogModel) return
    const d = getDefaultForwardSourceCounts(meshCatalogModel)
    setForwardNumSourcesX(d.numSourcesX)
    setForwardNumSourcesY(d.numSourcesY)
    setForwardNumSourcesZ(d.numSourcesZ)
    const proxySliders = getProxyMeshSliderDefaults(meshCatalogModel)
    if (proxySliders) {
      setForwardUnstructuredTargetElementSize(proxySliders.targetElementSize)
      setForwardUnstructuredSurfaceRefinement(proxySliders.surfaceRefinement)
      setForwardUnstructuredLocalRefinementNearEdges(proxySliders.localRefinementNearEdges)
    }
  }, [meshCatalogModel])

  // --- Derived geometry shared by every solver view ---
  const { forwardSurfaceBounds, forwardGravityModel } = useForwardGravityModel(
    gravityModel,
    params,
    gmshMeshSizingProps,
  )

  const allowGmshPreviewNetwork = gravityViews.includes(view) && view !== 'initial_model_gravity'

  useGmshMeshSourceCountPreview({
    model: forwardGravityModel,
    numSourcesX: forwardNumSourcesX,
    numSourcesY: forwardNumSourcesY,
    numSourcesZ: forwardNumSourcesZ,
    allowNetwork: allowGmshPreviewNetwork,
    onStats: setGmshLastBuildStats,
    onLoadingChange: setGmshPreviewLoading,
    onCalculateReadyChange: setGmshMeshCalculateReady,
  })

  const sharedUnstructuredMesh = useMemo(
    () => ({
      targetElementSize: forwardUnstructuredTargetElementSize,
      surfaceRefinement: forwardUnstructuredSurfaceRefinement,
      localRefinementNearEdges: forwardUnstructuredLocalRefinementNearEdges,
      setTargetElementSize: setForwardUnstructuredTargetElementSize,
      setSurfaceRefinement: setForwardUnstructuredSurfaceRefinement,
      setLocalRefinementNearEdges: setForwardUnstructuredLocalRefinementNearEdges,
      gmshLastBuildStats,
      gmshPreviewLoading,
    }),
    [
      forwardUnstructuredTargetElementSize,
      forwardUnstructuredSurfaceRefinement,
      forwardUnstructuredLocalRefinementNearEdges,
      gmshLastBuildStats,
      gmshPreviewLoading,
    ],
  )

  // Single shared model+grid props object for every forward solver view.
  // Per-method run wiring (results, timing, last receivers) is supplied separately via `gravityRuns`.
  const forwardMethodBaseProps = useMemo(
    () => ({
      ...forwardGravityModel,
      numSourcesX: forwardNumSourcesX,
      numSourcesY: forwardNumSourcesY,
      numSourcesZ: forwardNumSourcesZ,
      numReceiversX: forwardNumReceiversX,
      numReceiversY: forwardNumReceiversY,
      onNumSourcesXChange: setForwardNumSourcesX,
      onNumSourcesYChange: setForwardNumSourcesY,
      onNumSourcesZChange: setForwardNumSourcesZ,
      onNumReceiversXChange: setForwardNumReceiversX,
      onNumReceiversYChange: setForwardNumReceiversY,
      forwardSurfaceBounds,
      cube1H: params.cube1H,
      cube1Density: params.cube1Density,
      cube2H: params.cube2H,
      cube2Density: params.cube2Density,
      cube3H: params.cube3H,
      cube3Density: params.cube3Density,
      cube4H: params.cube4H,
      cube4Density: params.cube4Density,
      cube1OffsetX: params.cube1OffsetX,
      cube1OffsetY: params.cube1OffsetY,
      cube2OffsetX: params.cube2OffsetX,
      cube2OffsetY: params.cube2OffsetY,
      cube3OffsetX: params.cube3OffsetX,
      cube3OffsetY: params.cube3OffsetY,
      cube4OffsetX: params.cube4OffsetX,
      cube4OffsetY: params.cube4OffsetY,
      gmshCachedElementCount: gmshLastBuildStats?.numElements ?? null,
      gmshPreviewLoading,
      gmshMeshCalculateReady,
    }),
    [
      forwardGravityModel,
      forwardNumSourcesX,
      forwardNumSourcesY,
      forwardNumSourcesZ,
      forwardNumReceiversX,
      forwardNumReceiversY,
      forwardSurfaceBounds,
      params.cube1H,
      params.cube1Density,
      params.cube2H,
      params.cube2Density,
      params.cube3H,
      params.cube3Density,
      params.cube4H,
      params.cube4Density,
      params.cube1OffsetX,
      params.cube1OffsetY,
      params.cube2OffsetX,
      params.cube2OffsetY,
      params.cube3OffsetX,
      params.cube3OffsetY,
      params.cube4OffsetX,
      params.cube4OffsetY,
      gmshLastBuildStats?.numElements,
      gmshPreviewLoading,
      gmshMeshCalculateReady,
    ],
  )

  // Grid/mesh fields spread into the synthetic + forward page prop bags.
  const forwardGridProps = {
    forwardNumSourcesX,
    forwardNumSourcesY,
    forwardNumSourcesZ,
    setForwardNumSourcesX,
    setForwardNumSourcesY,
    setForwardNumSourcesZ,
    forwardNumReceiversX,
    forwardNumReceiversY,
    forwardSurfaceBounds,
    displayObservationPoints,
    setDisplayObservationPoints,
    sharedUnstructuredMesh,
  }

  return {
    forwardGridProps,
    forwardMethodBaseProps,
    forwardRunMetaByKey,
    onForwardRunMetaSet,
    resetForwardRunMeta,
  }
}
