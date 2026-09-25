import { isAnalyticalClosedFormModelSupported } from './analyticalClosedFormSupport'

export const FIELD_ONLY_ANALYSIS_BASE_MODELS = [
  '4 Cubes',
  'Faulted Block Model',
  'Valley-Mountain Model',
] as const

export type FieldOnlyAnalysisBaseModel = (typeof FIELD_ONLY_ANALYSIS_BASE_MODELS)[number]

export function fieldOnlyAnalysisBaseModel(modelType: string | null): FieldOnlyAnalysisBaseModel | null {
  if (!modelType) return null
  const base = modelType.split(' - ')[0].trim()
  return (FIELD_ONLY_ANALYSIS_BASE_MODELS as readonly string[]).includes(base)
    ? (base as FieldOnlyAnalysisBaseModel)
    : null
}

/** Composite models: analysis shows the computed field only (no closed-form reference). */
export function isFieldOnlyAnalysisSupported(modelType: string | null): boolean {
  return fieldOnlyAnalysisBaseModel(modelType) != null
}

/** Models that can use forward Analysis (closed-form compare or field-only map view). */
export function isForwardAnalysisSupported(modelType: string | null): boolean {
  return isAnalyticalClosedFormModelSupported(modelType) || isFieldOnlyAnalysisSupported(modelType)
}

export const FORWARD_ANALYSIS_UNSUPPORTED_MESSAGE =
  'Forward modeling analysis is available for catalog shapes with analytical reference ' +
  '(Cube, Cuboid, Sphere, Ellipsoid, cylinders) and composite models ' +
  '(4 Cubes, Faulted Block, Valley-Mountain).'
