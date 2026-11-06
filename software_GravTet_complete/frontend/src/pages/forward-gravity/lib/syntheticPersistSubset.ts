/**
 * Persist only geometry fields that belong to the active synthetic catalog model,
 * instead of mirroring the full multi-shape API payload.
 */
import type { ForwardModelParams } from './forwardModelParams'

export type PersistShapeSource = ForwardModelParams & {
  valleyMountainHeight?: number
  valleyMountainDepth?: number
  valleyMountainMountainDensity?: number
  valleyMountainValleyDensity?: number
}

/** Text after ``"Shape - "`` in catalog labels (e.g. ``Unstructured Tetrahedral``). */
export function meshDiscretizationFromCatalogModelType(modelType: string | null): string | null {
  if (!modelType || !modelType.includes(' - ')) return null
  const rest = modelType.split(' - ').slice(1).join(' - ').trim()
  return rest || null
}

function pick<T extends PersistShapeSource>(ctx: T, keys: (keyof T)[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of keys) {
    const v = ctx[k]
    if (v !== undefined && v !== null) out[String(k)] = v
  }
  return out
}

/**
 * Shape parameters for the selected ``modelType`` only (plus shared ``density`` / ``h`` when present).
 */
export function syntheticShapeParametersOnly(modelType: string | null, ctx: PersistShapeSource): Record<string, unknown> {
  const base = (modelType || '').split(' - ')[0]?.trim() ?? ''
  let shape: Record<string, unknown> = {}

  switch (base) {
    case 'Cube':
    case 'Rectangular Prism (Cuboid)':
      shape = pick(ctx, ['cubeX', 'cubeY', 'cubeZ'])
      break
    case 'Sphere':
      shape = pick(ctx, ['sphereRadius'])
      break
    case 'Ellipsoid':
      shape = pick(ctx, ['ellipsoidA', 'ellipsoidB', 'ellipsoidC'])
      break
    case 'Vertical Cylinder':
      shape = pick(ctx, ['verticalCylinderRadius', 'verticalCylinderHeight'])
      break
    case 'Horizontal Cylinder':
      shape = pick(ctx, ['horizontalCylinderRadius', 'horizontalCylinderLength'])
      break
    case '4 Cubes':
      shape = pick(ctx, [
        'cube1X',
        'cube1Y',
        'cube1Z',
        'cube1H',
        'cube1Density',
        'cube2X',
        'cube2Y',
        'cube2Z',
        'cube2H',
        'cube2Density',
        'cube3X',
        'cube3Y',
        'cube3Z',
        'cube3H',
        'cube3Density',
        'cube4X',
        'cube4Y',
        'cube4Z',
        'cube4H',
        'cube4Density',
        'spacingX',
        'spacingY',
        'cube1OffsetX',
        'cube1OffsetY',
        'cube2OffsetX',
        'cube2OffsetY',
        'cube3OffsetX',
        'cube3OffsetY',
        'cube4OffsetX',
        'cube4OffsetY',
      ])
      break
    case 'Faulted Block Model':
      shape = pick(ctx, ['faultedBlockX', 'faultedBlockY', 'faultedBlockZ', 'faultedBlockFaultOffset'])
      break
    case 'Valley-Mountain Model':
      shape = {
        valleyMountainX: ctx.valleyMountainX ?? ctx.cubeX,
        valleyMountainY: ctx.valleyMountainY ?? ctx.cubeY,
        valleyMountainZ: ctx.valleyMountainZ ?? ctx.cubeZ,
        ...pick(ctx, [
          'valleyMountainHeight',
          'valleyMountainDepth',
          'valleyMountainMountainDensity',
          'valleyMountainValleyDensity',
        ]),
      }
      break
    default:
      shape = {}
  }

  const common = pick(ctx, ['density', 'h'])
  return { ...shape, ...common }
}
