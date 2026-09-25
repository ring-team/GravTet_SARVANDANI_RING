/**
 * `useForwardGravityModel`: derives the shared forward-gravity geometry from the
 * selected catalog model + synthetic slider params.
 *
 * Centralizes the three memoized values that previously bloated `App.tsx`:
 *  - `forwardSurfaceBounds`: single source of truth for the map extent (same for all methods)
 *  - `forwardGravityShape`: per-shape burial depth `h` + density + cube dimensions
 *  - `forwardGravityModel`: the flat `ForwardModelParams` shared by every solver view
 */
import { useMemo } from 'react'
import { computeSurfaceBoundsFromModel, type SurfaceBounds } from '../../synthetic-gravity/lib/surfaceBounds'
import type { ForwardModelParams } from '../lib/forwardModelParams'
import type useSyntheticParametersFn from '../../synthetic-gravity/hooks/useSyntheticParameters'

export type SyntheticParameters = ReturnType<typeof useSyntheticParametersFn>

export interface GmshMeshSizingProps {
  gmshTargetElementSize: number
  gmshSurfaceRefinement: number
  gmshLocalRefinementNearEdges: number
}

export interface ForwardGravityShape {
  cubeX: number
  cubeY: number
  cubeZ: number
  h: number
  density: number
}

export interface ForwardGravityModelResult {
  forwardSurfaceBounds: SurfaceBounds
  forwardGravityShape: ForwardGravityShape
  forwardGravityModel: ForwardModelParams
}

export function useForwardGravityModel(
  gravityModel: string | null,
  params: SyntheticParameters,
  gmshMeshSizingProps: GmshMeshSizingProps,
): ForwardGravityModelResult {
  // Single source of truth for map extent: same for all forward methods so extent
  // never changes when switching method or observation points.
  const forwardSurfaceBounds: SurfaceBounds = useMemo(
    () =>
      computeSurfaceBoundsFromModel({
        modelType: gravityModel,
        cubeX: gravityModel?.startsWith('Rectangular Prism') ? params.cuboidX : params.cubeX,
        cubeY: gravityModel?.startsWith('Rectangular Prism') ? params.cuboidY : params.cubeY,
        cubeZ: gravityModel?.startsWith('Rectangular Prism') ? params.cuboidZ : params.cubeZ,
        sphereRadius: params.sphereRadius,
        ellipsoidA: params.ellipsoidA,
        ellipsoidB: params.ellipsoidB,
        ellipsoidC: params.ellipsoidC,
        verticalCylinderRadius: params.verticalCylinderRadius,
        verticalCylinderHeight: params.verticalCylinderHeight,
        horizontalCylinderRadius: params.horizontalCylinderRadius,
        horizontalCylinderLength: params.horizontalCylinderLength,
        faultedBlockX: params.faultedBlockX,
        faultedBlockY: params.faultedBlockY,
        faultedBlockZ: params.faultedBlockZ,
        faultedBlockFaultOffset: params.faultedBlockFaultOffset,
        valleyMountainX: params.valleyMountainX,
        valleyMountainY: params.valleyMountainY,
        valleyMountainZ: params.valleyMountainZ,
        cube1X: params.cube1X,
        cube1Y: params.cube1Y,
        cube1Z: params.cube1Z,
        cube2X: params.cube2X,
        cube2Y: params.cube2Y,
        cube2Z: params.cube2Z,
        cube3X: params.cube3X,
        cube3Y: params.cube3Y,
        cube3Z: params.cube3Z,
        cube4X: params.cube4X,
        cube4Y: params.cube4Y,
        cube4Z: params.cube4Z,
        spacingX: params.spacingX,
        spacingY: params.spacingY,
        cube1OffsetX: params.cube1OffsetX,
        cube1OffsetY: params.cube1OffsetY,
        cube2OffsetX: params.cube2OffsetX,
        cube2OffsetY: params.cube2OffsetY,
        cube3OffsetX: params.cube3OffsetX,
        cube3OffsetY: params.cube3OffsetY,
        cube4OffsetX: params.cube4OffsetX,
        cube4OffsetY: params.cube4OffsetY,
      }),
    [
      gravityModel,
      params.cubeX, params.cubeY, params.cubeZ,
      params.cuboidX, params.cuboidY, params.cuboidZ,
      params.sphereRadius,
      params.ellipsoidA, params.ellipsoidB, params.ellipsoidC,
      params.verticalCylinderRadius, params.verticalCylinderHeight,
      params.horizontalCylinderRadius, params.horizontalCylinderLength,
      params.faultedBlockX, params.faultedBlockY, params.faultedBlockZ, params.faultedBlockFaultOffset,
      params.valleyMountainX, params.valleyMountainY, params.valleyMountainZ,
      params.cube1X, params.cube1Y, params.cube1Z, params.cube2X, params.cube2Y, params.cube2Z, params.cube3X, params.cube3Y, params.cube3Z, params.cube4X, params.cube4Y, params.cube4Z,
      params.spacingX, params.spacingY,
      params.cube1OffsetX, params.cube1OffsetY, params.cube2OffsetX, params.cube2OffsetY, params.cube3OffsetX, params.cube3OffsetY, params.cube4OffsetX, params.cube4OffsetY,
    ],
  )

  // Prism uses cuboid X/Y/Z, burial h, and density from the cuboid panel; other
  // shapes use cube (or shape-specific) params. Keeps Direct / Barnes–Hut / AMFM /
  // quadrature identical to each other and aligned with the 3D preview.
  const forwardGravityShape = useMemo<ForwardGravityShape>(() => {
    const baseModel = gravityModel?.split(' - ')[0] || ''
    const prism = baseModel === 'Rectangular Prism (Cuboid)'
    const h =
      baseModel === 'Sphere' ? params.sphereH :
      baseModel === 'Ellipsoid' ? params.ellipsoidH :
      baseModel === 'Vertical Cylinder' ? params.verticalCylinderH :
      baseModel === 'Horizontal Cylinder' ? params.horizontalCylinderH :
      baseModel === 'Faulted Block Model' ? params.faultedBlockH :
      baseModel === 'Valley-Mountain Model' ? params.valleyMountainH :
      prism ? params.cuboidH : params.cubeH
    const density =
      baseModel === 'Sphere' ? params.sphereDensity :
      baseModel === 'Ellipsoid' ? params.ellipsoidDensity :
      baseModel === 'Vertical Cylinder' ? params.verticalCylinderDensity :
      baseModel === 'Horizontal Cylinder' ? params.horizontalCylinderDensity :
      baseModel === 'Faulted Block Model' ? params.faultedBlockDensity :
      baseModel === 'Valley-Mountain Model' ? params.valleyMountainValleyDensity :
      prism ? params.cuboidDensity : params.cubeDensity
    return {
      cubeX: baseModel === 'Valley-Mountain Model' ? params.valleyMountainX : (prism ? params.cuboidX : params.cubeX),
      cubeY: baseModel === 'Valley-Mountain Model' ? params.valleyMountainY : (prism ? params.cuboidY : params.cubeY),
      cubeZ: baseModel === 'Valley-Mountain Model' ? params.valleyMountainZ : (prism ? params.cuboidZ : params.cubeZ),
      h,
      density,
    }
  }, [
    gravityModel,
    params.cubeX, params.cubeY, params.cubeZ, params.cubeH, params.cubeDensity,
    params.cuboidX, params.cuboidY, params.cuboidZ, params.cuboidH, params.cuboidDensity,
    params.sphereH, params.sphereDensity,
    params.ellipsoidH, params.ellipsoidDensity,
    params.verticalCylinderH, params.verticalCylinderDensity,
    params.horizontalCylinderH, params.horizontalCylinderDensity,
    params.faultedBlockH, params.faultedBlockDensity,
    params.valleyMountainH, params.valleyMountainDensity,
    params.valleyMountainMountainDensity, params.valleyMountainValleyDensity,
    params.valleyMountainHeight, params.valleyMountainDepth,
    params.valleyMountainX, params.valleyMountainY, params.valleyMountainZ,
  ])

  const forwardGravityModel = useMemo<ForwardModelParams>(
    () => ({
      modelType: gravityModel,
      ...gmshMeshSizingProps,
      cubeX: forwardGravityShape.cubeX,
      cubeY: forwardGravityShape.cubeY,
      cubeZ: forwardGravityShape.cubeZ,
      sphereRadius: params.sphereRadius,
      ellipsoidA: params.ellipsoidA,
      ellipsoidB: params.ellipsoidB,
      ellipsoidC: params.ellipsoidC,
      verticalCylinderRadius: params.verticalCylinderRadius,
      verticalCylinderHeight: params.verticalCylinderHeight,
      horizontalCylinderRadius: params.horizontalCylinderRadius,
      horizontalCylinderLength: params.horizontalCylinderLength,
      faultedBlockX: params.faultedBlockX,
      faultedBlockY: params.faultedBlockY,
      faultedBlockZ: params.faultedBlockZ,
      faultedBlockFaultOffset: params.faultedBlockFaultOffset,
      valleyMountainHeight: params.valleyMountainHeight,
      valleyMountainDepth: params.valleyMountainDepth,
      valleyMountainMountainDensity: params.valleyMountainMountainDensity,
      valleyMountainValleyDensity: params.valleyMountainValleyDensity,
      valleyMountainX: params.valleyMountainX,
      valleyMountainY: params.valleyMountainY,
      valleyMountainZ: params.valleyMountainZ,
      cube1X: params.cube1X,
      cube1Y: params.cube1Y,
      cube1Z: params.cube1Z,
      cube2X: params.cube2X,
      cube2Y: params.cube2Y,
      cube2Z: params.cube2Z,
      cube3X: params.cube3X,
      cube3Y: params.cube3Y,
      cube3Z: params.cube3Z,
      cube4X: params.cube4X,
      cube4Y: params.cube4Y,
      cube4Z: params.cube4Z,
      spacingX: params.spacingX,
      spacingY: params.spacingY,
      h: forwardGravityShape.h,
      density: forwardGravityShape.density,
    }),
    [
      gravityModel,
      gmshMeshSizingProps,
      forwardGravityShape,
      params.sphereRadius,
      params.ellipsoidA, params.ellipsoidB, params.ellipsoidC,
      params.verticalCylinderRadius, params.verticalCylinderHeight,
      params.horizontalCylinderRadius, params.horizontalCylinderLength,
      params.faultedBlockX, params.faultedBlockY, params.faultedBlockZ, params.faultedBlockFaultOffset,
      params.valleyMountainHeight, params.valleyMountainDepth,
      params.valleyMountainMountainDensity, params.valleyMountainValleyDensity,
      params.valleyMountainX, params.valleyMountainY, params.valleyMountainZ,
      params.cube1X, params.cube1Y, params.cube1Z,
      params.cube2X, params.cube2Y, params.cube2Z,
      params.cube3X, params.cube3Y, params.cube3Z,
      params.cube4X, params.cube4Y, params.cube4Z,
      params.spacingX, params.spacingY,
    ],
  )

  return { forwardSurfaceBounds, forwardGravityShape, forwardGravityModel }
}
