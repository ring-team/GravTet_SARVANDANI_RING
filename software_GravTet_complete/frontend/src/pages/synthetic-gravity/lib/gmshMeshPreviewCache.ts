import type { ForwardModelParams } from '../../forward-gravity/lib/forwardModelParams'
import {
  buildGmshMeshCountPreviewBody,
  gmshMeshCountPreviewCacheKey,
} from '../../forward-gravity/lib/forwardGravityMeshRequest'
import type { GmshMeshBuildStats } from './gmshMeshSupport'

/** Client-side cache for Gmsh source-count previews (survives route changes within one session). */
const previewStatsByKey = new Map<string, GmshMeshBuildStats>()

/** Keys for which a warmCacheOnly build already populated the server-side mesh cache. */
const serverWarmedKeys = new Set<string>()

/** Keys for which server mesh + ctypes geometry are ready for forward calculate. */
const calculateReadyKeys = new Set<string>()

export function gmshMeshPreviewCacheKey(
  model: ForwardModelParams,
  numSourcesX: number,
  numSourcesY: number,
  numSourcesZ: number,
): string {
  const body = buildGmshMeshCountPreviewBody({ model, numSourcesX, numSourcesY, numSourcesZ })
  return gmshMeshCountPreviewCacheKey(body)
}

export function getGmshMeshPreviewStats(cacheKey: string): GmshMeshBuildStats | undefined {
  return previewStatsByKey.get(cacheKey)
}

export function setGmshMeshPreviewStats(cacheKey: string, stats: GmshMeshBuildStats): void {
  previewStatsByKey.set(cacheKey, stats)
}

export function isGmshMeshServerWarmed(cacheKey: string): boolean {
  return serverWarmedKeys.has(cacheKey)
}

export function markGmshMeshServerWarmed(cacheKey: string): void {
  serverWarmedKeys.add(cacheKey)
  calculateReadyKeys.add(cacheKey)
}

export function isGmshMeshCalculateReady(cacheKey: string): boolean {
  return calculateReadyKeys.has(cacheKey)
}

export function markGmshMeshCalculateReady(cacheKey: string): void {
  calculateReadyKeys.add(cacheKey)
}

/** Apply server warm response flags; returns true when forward calculate can run without mesh prep. */
export function applyGmshMeshWarmReadiness(
  cacheKey: string,
  built: {
    calculateReady?: boolean
    geometryReady?: boolean
    depthShiftReady?: boolean
  },
): boolean {
  const ready =
    built.calculateReady === true ||
    (built.geometryReady === true && built.depthShiftReady === true)
  if (ready) {
    markGmshMeshServerWarmed(cacheKey)
    return true
  }
  clearGmshMeshServerWarmed(cacheKey)
  return false
}

export function clearGmshMeshServerWarmed(cacheKey: string): void {
  serverWarmedKeys.delete(cacheKey)
  calculateReadyKeys.delete(cacheKey)
}
