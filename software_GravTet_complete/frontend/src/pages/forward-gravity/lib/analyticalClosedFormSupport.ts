/** Shapes with analytical closed-form kernels (mesh discretization does not affect the solution). */

export const ANALYTICAL_CLOSED_FORM_BASE_MODELS = [
  'Cube',
  'Rectangular Prism (Cuboid)',
  'Sphere',
  'Ellipsoid',
  'Vertical Cylinder',
  'Horizontal Cylinder',
] as const

export type AnalyticalClosedFormBaseModel = (typeof ANALYTICAL_CLOSED_FORM_BASE_MODELS)[number]

export function analyticalClosedFormBaseModel(modelType: string | null): AnalyticalClosedFormBaseModel | null {
  if (!modelType) return null
  const base = modelType.split(' - ')[0].trim()
  return (ANALYTICAL_CLOSED_FORM_BASE_MODELS as readonly string[]).includes(base)
    ? (base as AnalyticalClosedFormBaseModel)
    : null
}

export function isAnalyticalClosedFormModelSupported(modelType: string | null): boolean {
  return analyticalClosedFormBaseModel(modelType) != null
}
