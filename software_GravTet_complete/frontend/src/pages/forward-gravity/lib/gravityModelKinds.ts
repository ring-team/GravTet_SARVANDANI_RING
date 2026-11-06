/**
 * Gravity forward-model labels from the UI (e.g. "Rectangular Prism (Cuboid) - Tetrahedral").
 * Keep in sync with `baseModel` logic in `surfaceBounds.ts` and `App.tsx` cuboid checks.
 */

/** True for any "Rectangular Prism (Cuboid) - …" mesh/discretization variant. */
export function isRectangularPrismGravityModel(modelType: string | null | undefined): boolean {
  const base = modelType?.split(' - ')[0]?.trim() ?? ''
  return base === 'Rectangular Prism (Cuboid)'
}
