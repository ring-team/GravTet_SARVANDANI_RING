/**
 * Barrel exports for synthetic gravity catalog 3D previews (cube, sphere, ellipsoid, cylinders, etc.).
 *
 * Import from here (not `gravity/index`) so the scope is clearly “synthetic 3D editors” only.
 */

// --- Primitives (box / sphere / ellipsoid) ---

export { default as Cube3DView } from '../shapes/Cube3DView'
export { default as Cuboid3DView } from '../shapes/Cuboid3DView'
export { default as Sphere3DView } from '../shapes/Sphere3DView'
export { default as Ellipsoid3DView } from '../shapes/Ellipsoid3DView'

// --- Cylinders ---

export { default as VerticalCylinder3DView } from '../shapes/VerticalCylinder3DView'
export { default as HorizontalCylinder3DView } from '../shapes/HorizontalCylinder3DView'

// --- Multi-body / structural ---

export { default as FourCubes3DView } from '../shapes/FourCubes3DView'
export { default as FaultedBlockModel3DView } from '../shapes/FaultedBlockModel3DView'
export { default as ValleyMountainModel3DView } from '../shapes/ValleyMountainModel3DView'
