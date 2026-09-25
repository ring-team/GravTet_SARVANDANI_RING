/**
 * Builds the direct Newton (pairwise summation) API request from model params, execution mode, and observation grid.
 *
 * Uses shared forward model-shape params; adds SIMD / threaded execution flags for the backend.
 */
import type { SurfaceBounds } from '../../shared/GravityMapView'
import type { ForwardModelParams } from '../../lib/forwardModelParams'
import { getModelCenterForForwardGravity, getModelDepthAndDensityForForwardGravity } from '../../lib/forwardGravityModelCenter'
import { estimateForwardSourceCount } from '../../lib/forwardSourceEstimate'

// --- Types ---

export type DirectNewtonModelParams = ForwardModelParams

export interface DirectNewtonBuildRequestInput {
  model: DirectNewtonModelParams
  executionMode: 'reference' | 'tiled' | 'simd_tiled' | 'simd_tiled_threading'
  /** Optional thread count override used by the simd_tiled_threading execution mode. */
  numThreads?: number
  /** Cache-blocking Br (0 = default). */
  receiverBlockSize?: number
  /** Cache-blocking Bs (0 = default). */
  sourceBlockSize?: number
  numSourcesX: number
  numSourcesY: number
  numSourcesZ: number
  numReceiversX: number
  numReceiversY: number
  surfaceBounds: SurfaceBounds
}

// --- Source count (mesh family multipliers) ---

export function directNewtonEstimateSourceCount(modelType: string | null, numSourcesX: number, numSourcesY: number, numSourcesZ: number) {
  return estimateForwardSourceCount(modelType, numSourcesX, numSourcesY, numSourcesZ)
}

// --- Flatten to API body (execution mode + shape fields) ---

export function directNewtonBuildRequest(input: DirectNewtonBuildRequestInput) {
  const {
    model,
    executionMode,
    numThreads,
    receiverBlockSize,
    sourceBlockSize,
    numSourcesX,
    numSourcesY,
    numSourcesZ,
    numReceiversX,
    numReceiversY,
    surfaceBounds,
  } = input
  const center = getModelCenterForForwardGravity(model)
  const { h, density } = getModelDepthAndDensityForForwardGravity(model)
  return {
    executionMode,
    modelType: model.modelType,
    numThreads: typeof numThreads === 'number' ? numThreads : 0,
    receiverBlockSize: typeof receiverBlockSize === 'number' ? receiverBlockSize : 0,
    sourceBlockSize: typeof sourceBlockSize === 'number' ? sourceBlockSize : 0,
    centerX: center.centerX,
    centerY: center.centerY,
    centerZ: center.centerZ,
    h,
    density,
    numSourcesX,
    numSourcesY,
    numSourcesZ,
    numReceiversX,
    numReceiversY,
    surfaceXMin: surfaceBounds.xMin,
    surfaceXMax: surfaceBounds.xMax,
    surfaceYMin: surfaceBounds.yMin,
    surfaceYMax: surfaceBounds.yMax,
    surfaceZ: 0,
    cubeX: model.cubeX,
    cubeY: model.cubeY,
    cubeZ: model.cubeZ,
    sphereRadius: model.sphereRadius,
    ellipsoidA: model.ellipsoidA,
    ellipsoidB: model.ellipsoidB,
    ellipsoidC: model.ellipsoidC,
    verticalCylinderRadius: model.verticalCylinderRadius,
    verticalCylinderHeight: model.verticalCylinderHeight,
    horizontalCylinderRadius: model.horizontalCylinderRadius,
    horizontalCylinderLength: model.horizontalCylinderLength,
    faultedBlockX: model.faultedBlockX,
    faultedBlockY: model.faultedBlockY,
    faultedBlockZ: model.faultedBlockZ,
    faultedBlockFaultOffset: model.faultedBlockFaultOffset,
    layeredBasinX: model.layeredBasinX,
    layeredBasinY: model.layeredBasinY,
    layeredBasinLayer1Thickness: model.layeredBasinLayer1Thickness,
    layeredBasinLayer2Thickness: model.layeredBasinLayer2Thickness,
    layeredBasinLayer3Thickness: model.layeredBasinLayer3Thickness,
    layeredBasinLayer1Density: model.layeredBasinLayer1Density,
    layeredBasinLayer2Density: model.layeredBasinLayer2Density,
    layeredBasinLayer3Density: model.layeredBasinLayer3Density,
    voxelModelX: model.voxelModelX,
    voxelModelY: model.voxelModelY,
    voxelModelZ: model.voxelModelZ,
    voxelModelVoxelSize: model.voxelModelVoxelSize,
    cube1X: model.cube1X,
    cube1Y: model.cube1Y,
    cube1Z: model.cube1Z,
    cube1H: model.cube1H,
    cube1Density: model.cube1Density,
    cube2X: model.cube2X,
    cube2Y: model.cube2Y,
    cube2Z: model.cube2Z,
    cube2H: model.cube2H,
    cube2Density: model.cube2Density,
    cube3X: model.cube3X,
    cube3Y: model.cube3Y,
    cube3Z: model.cube3Z,
    cube3H: model.cube3H,
    cube3Density: model.cube3Density,
    cube4X: model.cube4X,
    cube4Y: model.cube4Y,
    cube4Z: model.cube4Z,
    cube4H: model.cube4H,
    cube4Density: model.cube4Density,
    spacingX: model.spacingX,
    spacingY: model.spacingY,
    cube1OffsetX: model.cube1OffsetX,
    cube1OffsetY: model.cube1OffsetY,
    cube2OffsetX: model.cube2OffsetX,
    cube2OffsetY: model.cube2OffsetY,
    cube3OffsetX: model.cube3OffsetX,
    cube3OffsetY: model.cube3OffsetY,
    cube4OffsetX: model.cube4OffsetX,
    cube4OffsetY: model.cube4OffsetY,
    valleyMountainX: model.valleyMountainX,
    valleyMountainY: model.valleyMountainY,
    valleyMountainZ: model.valleyMountainZ,
    valleyMountainHeight: model.valleyMountainHeight ?? model.valleyMountainAmplitude,
    valleyMountainDepth: model.valleyMountainDepth ?? model.valleyMountainWavelength,
    valleyMountainAmplitude: model.valleyMountainAmplitude ?? model.valleyMountainHeight,
    valleyMountainWavelength: model.valleyMountainWavelength ?? model.valleyMountainDepth,
    valleyMountainMountainDensity: model.valleyMountainMountainDensity,
    valleyMountainValleyDensity: model.valleyMountainValleyDensity,
    valleyMountainDensity: model.density,
  }
}
