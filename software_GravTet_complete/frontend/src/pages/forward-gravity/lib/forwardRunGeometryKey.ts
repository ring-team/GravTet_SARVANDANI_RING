import type { ForwardModelParams } from './forwardModelParams'
import { getModelCenterForForwardGravity } from './forwardGravityModelCenter'
import type { SurfaceBounds } from '../shared/GravityMapView'
import { syntheticShapeParametersOnly } from './syntheticPersistSubset'

/** Fingerprint of model geometry + mesh grid used for the last forward run. */
export function forwardRunGeometryKey(
  model: ForwardModelParams,
  numSourcesX: number,
  numSourcesY: number,
  numSourcesZ: number,
  surfaceBounds: SurfaceBounds,
): string {
  const center = getModelCenterForForwardGravity(model)
  return JSON.stringify({
    modelType: model.modelType,
    shape: syntheticShapeParametersOnly(model.modelType, model),
    centerZ: center.centerZ,
    numSourcesX,
    numSourcesY,
    numSourcesZ,
    bounds: surfaceBounds,
  })
}
