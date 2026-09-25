/**
 * Burial depth → model center Z for all forward gravity APIs (Direct Newton, AMFM, Barnes–Hut, quadrature).
 * Must stay identical to Direct Newton: approximate methods discretize the same body geometry.
 */
import type { ForwardModelParams } from './forwardModelParams'

export function getModelDepthAndDensityForForwardGravity(model: ForwardModelParams) {
  const baseModel = model.modelType?.split(' - ')[0] || ''
  switch (baseModel) {
    case 'Cube':
    case 'Rectangular Prism (Cuboid)':
      return { h: model.h, density: model.density }
    case 'Sphere':
      return { h: model.sphereH ?? model.h, density: model.sphereDensity ?? model.density }
    case 'Ellipsoid':
      return { h: model.ellipsoidH ?? model.h, density: model.ellipsoidDensity ?? model.density }
    case 'Vertical Cylinder':
      return { h: model.verticalCylinderH ?? model.h, density: model.verticalCylinderDensity ?? model.density }
    case 'Horizontal Cylinder':
      return { h: model.horizontalCylinderH ?? model.h, density: model.horizontalCylinderDensity ?? model.density }
    case 'Faulted Block Model':
      return { h: model.faultedBlockH ?? model.h, density: model.faultedBlockDensity ?? model.density }
    case 'Valley-Mountain Model':
      return { h: model.h, density: model.density }
    case '4 Cubes':
      return { h: model.h, density: model.density }
    default:
      return { h: model.h, density: model.density }
  }
}

export function getModelCenterForForwardGravity(model: ForwardModelParams) {
  const centerX = 0
  const centerY = 0
  let centerZ = 0
  const baseModel = model.modelType?.split(' - ')[0] || ''
  const { h } = getModelDepthAndDensityForForwardGravity(model)
  switch (baseModel) {
    case 'Cube':
      centerZ = -h - (model.cubeZ || 100) / 2
      break
    case 'Rectangular Prism (Cuboid)':
      centerZ = -h - (model.cubeZ || 150) / 2
      break
    case 'Sphere':
      centerZ = -h - (model.sphereRadius || 100)
      break
    case 'Ellipsoid':
      centerZ = -h - (model.ellipsoidC || 150)
      break
    case 'Vertical Cylinder':
      centerZ = -h - (model.verticalCylinderHeight || 100) / 2
      break
    case 'Horizontal Cylinder':
      centerZ = -h - (model.horizontalCylinderRadius || 50)
      break
    case '4 Cubes':
      centerZ = -h - (model.cube1Z || 20) / 2
      break
    case 'Faulted Block Model':
      centerZ = -h - (model.faultedBlockZ || 100) / 2
      break
    case 'Valley-Mountain Model':
      centerZ = -h - (model.valleyMountainZ ?? model.cubeZ ?? 90) / 2
      break
    case 'Voxel-Based Density Model':
      centerZ = -h - (model.voxelModelZ || 100) / 2
      break
    default:
      centerZ = -h - 50
  }
  return { centerX, centerY, centerZ }
}
