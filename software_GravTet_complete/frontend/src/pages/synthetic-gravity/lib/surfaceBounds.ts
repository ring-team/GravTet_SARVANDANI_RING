/**
 * Single source of truth for forward-gravity map extent.
 * Used by App to compute bounds from current model; all forward methods use the same bounds so extent never changes when switching method or observation points.
 */

// --- Types ---

export interface SurfaceBounds {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
  tickStep?: number
}

export interface ModelDimensionParams {
  modelType: string | null
  cubeX?: number
  cubeY?: number
  cubeZ?: number
  sphereRadius?: number
  ellipsoidA?: number
  ellipsoidB?: number
  ellipsoidC?: number
  verticalCylinderRadius?: number
  verticalCylinderHeight?: number
  horizontalCylinderRadius?: number
  horizontalCylinderLength?: number
  faultedBlockX?: number
  faultedBlockY?: number
  faultedBlockZ?: number
  faultedBlockFaultOffset?: number
  valleyMountainX?: number
  valleyMountainY?: number
  valleyMountainZ?: number
  voxelModelX?: number
  voxelModelY?: number
  voxelModelZ?: number
  voxelModelVoxelSize?: number
  cube1X?: number
  cube1Y?: number
  cube1Z?: number
  cube2X?: number
  cube2Y?: number
  cube2Z?: number
  cube3X?: number
  cube3Y?: number
  cube3Z?: number
  cube4X?: number
  cube4Y?: number
  cube4Z?: number
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
}

// --- Infer XY extent from selected synthetic shape + padding ---

export function computeSurfaceBoundsFromModel(p: ModelDimensionParams): SurfaceBounds {
  let modelSizeX = 100
  let modelSizeY = 100
  const baseModel = p.modelType?.split(' - ')[0] || ''

  switch (baseModel) {
    case 'Cube':
      modelSizeX = p.cubeX ?? 100
      modelSizeY = p.cubeY ?? 100
      break
    case 'Rectangular Prism (Cuboid)': {
      // Match Cube/Sphere-style maps: square XY window from the larger horizontal extent so the
      // forward map fills the panel like other synthetics (elongated X/Y only shrank the plot).
      const sx = p.cubeX ?? 400
      const sy = p.cubeY ?? 100
      const extent = Math.max(sx, sy)
      modelSizeX = extent
      modelSizeY = extent
      break
    }
    case 'Sphere':
      modelSizeX = (p.sphereRadius ?? 100) * 2
      modelSizeY = (p.sphereRadius ?? 100) * 2
      break
    case 'Ellipsoid':
      {
        // UI uses ellipsoid A/B controls as the user's horizontal size knobs.
        // For consistent map framing with prism controls, avoid implicit *2 scaling here.
        const sx = p.ellipsoidA ?? 200
        const sy = p.ellipsoidB ?? 100
        const extent = Math.max(sx, sy)
        modelSizeX = extent
        modelSizeY = extent
      }
      break
    case 'Vertical Cylinder':
      modelSizeX = (p.verticalCylinderRadius ?? 50) * 2
      modelSizeY = (p.verticalCylinderRadius ?? 50) * 2
      break
    case 'Horizontal Cylinder':
      modelSizeX = p.horizontalCylinderLength ?? 100
      modelSizeY = (p.horizontalCylinderRadius ?? 50) * 2
      break
    case 'Faulted Block Model':
      modelSizeX = p.faultedBlockX ?? 100
      modelSizeY = p.faultedBlockY ?? 100
      break
    case 'Valley-Mountain Model':
      modelSizeX = p.valleyMountainX ?? 400
      modelSizeY = p.valleyMountainY ?? 140
      break
    case '4 Cubes': {
      const spacingX = p.spacingX ?? 30
      const spacingY = p.spacingY ?? 30
      const c1ox = p.cube1OffsetX ?? 0
      const c1oy = p.cube1OffsetY ?? 0
      const c2ox = p.cube2OffsetX ?? 0
      const c2oy = p.cube2OffsetY ?? 0
      const c3ox = p.cube3OffsetX ?? 0
      const c3oy = p.cube3OffsetY ?? 0
      const c4ox = p.cube4OffsetX ?? 0
      const c4oy = p.cube4OffsetY ?? 0
      const cube1X = -spacingX / 2 + c1ox
      const cube1Y = -spacingY / 2 + c1oy
      const cube2X = spacingX / 2 + c2ox
      const cube2Y = -spacingY / 2 + c2oy
      const cube3X = -spacingX / 2 + c3ox
      const cube3Y = spacingY / 2 + c3oy
      const cube4X = spacingX / 2 + c4ox
      const cube4Y = spacingY / 2 + c4oy
      const c1x = p.cube1X ?? 20
      const c2x = p.cube2X ?? 20
      const c3x = p.cube3X ?? 20
      const c4x = p.cube4X ?? 20
      const c1y = p.cube1Y ?? 20
      const c2y = p.cube2Y ?? 20
      const c3y = p.cube3Y ?? 20
      const c4y = p.cube4Y ?? 20
      const minX = Math.min(cube1X - c1x / 2, cube2X - c2x / 2, cube3X - c3x / 2, cube4X - c4x / 2)
      const maxX = Math.max(cube1X + c1x / 2, cube2X + c2x / 2, cube3X + c3x / 2, cube4X + c4x / 2)
      const minY = Math.min(cube1Y - c1y / 2, cube2Y - c2y / 2, cube3Y - c3y / 2, cube4Y - c4y / 2)
      const maxY = Math.max(cube1Y + c1y / 2, cube2Y + c2y / 2, cube3Y + c3y / 2, cube4Y + c4y / 2)
      modelSizeX = maxX - minX
      modelSizeY = maxY - minY
      break
    }
    default:
      break
  }

  // Apply smart padding: much less for very wide/tall models to avoid excessive empty space
  const aspectRatio = modelSizeX / modelSizeY

  // Square observation window only for Cube with equal X/Y, or Sphere — not other shapes
  // that happen to have equal framing sizes (cuboid max-extent, vertical cylinder, …).
  const cubeX = p.cubeX ?? 100
  const cubeY = p.cubeY ?? 100
  const forceSquareWindow =
    (baseModel === 'Cube' && Math.abs(cubeX - cubeY) <= 1e-9 * Math.max(cubeX, cubeY, 1)) ||
    baseModel === 'Sphere'
  if (forceSquareWindow) {
    // Half-extent of the observation window (was 1.5× body size).
    const half = Math.max(modelSizeX, modelSizeY) * 1.7
    return {
      xMin: -half,
      xMax: half,
      yMin: -half,
      yMax: half,
      tickStep: Math.max(1, Math.min(modelSizeX, modelSizeY)),
    }
  }

  // Aggressive reduction for very elongated shapes like Rectangular Prism (400×100)
  const paddingFactorX = aspectRatio > 3 ? 1.1 : aspectRatio > 2 ? 1.15 : 1.5
  const paddingFactorY = aspectRatio < 0.33 ? 1.1 : aspectRatio < 0.5 ? 1.15 : 1.5

  const surfaceHalfX = modelSizeX * paddingFactorX * 1.1  // Subtle X bias for readability
  const surfaceHalfY = modelSizeY * paddingFactorY
  return {
    xMin: -surfaceHalfX,
    xMax: surfaceHalfX,
    yMin: -surfaceHalfY,
    yMax: surfaceHalfY,
    tickStep: Math.max(1, Math.min(modelSizeX, modelSizeY)),
  }
}

/** Half-width of the forward observation map in backend X / Y (matches receiver grid edges). */
export function horizontalHalfExtentsFromSurfaceBounds(bounds: SurfaceBounds): { halfX: number; halfY: number } {
  return {
    halfX: Math.max(0.5, (bounds.xMax - bounds.xMin) * 0.5),
    halfY: Math.max(0.5, (bounds.yMax - bounds.yMin) * 0.5),
  }
}
