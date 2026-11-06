import type { SurfaceBounds } from '../shared/GravityMapView'
import { analyticalClosedFormBaseModel } from './analyticalClosedFormSupport'
import { getModelCenterForForwardGravity } from './forwardGravityModelCenter'
import type { ForwardModelParams } from './forwardModelParams'

/** POST body for `/api/compute_gravity_analytical` from current forward-model geometry. */
export function buildAnalyticalReferenceRequest(
  model: ForwardModelParams & { modelType?: string | null },
  surfaceBounds: SurfaceBounds,
  numReceiversX: number,
  numReceiversY: number,
): Record<string, unknown> | null {
  const modelType = model.modelType ?? null
  if (!analyticalClosedFormBaseModel(modelType)) return null
  const center = getModelCenterForForwardGravity(model)
  return {
    modelType,
    centerX: center.centerX,
    centerY: center.centerY,
    centerZ: center.centerZ,
    density: model.density,
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
  }
}
