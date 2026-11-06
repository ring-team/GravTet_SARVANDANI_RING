/**
 * Valley–mountain model: Gaussian relief for 3D preview and forward mesh (same geometry).
 * Sine relief remains available for legacy C++ sine-topography mode.
 */

/** App default geometry / density fallbacks when model fields are unset (m, kg/m³). */
export const VALLEY_MOUNTAIN_DEFAULTS = {
  blockX: 400,
  blockY: 140,
  blockZ: 90,
  mountainHeight: 50,
  valleyDepth: 50,
  /** Dense crystalline half-space / basement (~2.85 g/cm³). */
  halfSpaceDensity: 2850,
  /** Lighter sedimentary or weathered fill in the topography block (~2.55 g/cm³). */
  mountainValleyDensity: 2550,
  burialH: 100,
  /** Half-space padding around topography block. */
  halfSpacePadX: 100,
  halfSpacePadY: 50,
  halfSpacePadZ: 30,
} as const

export type ValleyMountainParams = {
  blockX: number
  blockY: number
  blockZ: number
  mountainHeight: number
  valleyDepth: number
  wavelength: number
  halfSpaceDensity: number
  mountainValleyDensity: number
  halfSpaceX: number
  halfSpaceY: number
  halfSpaceZ: number
}

export function resolveValleyMountainParams(model: {
  cubeX?: number
  cubeY?: number
  cubeZ?: number
  valleyMountainX?: number
  valleyMountainY?: number
  valleyMountainZ?: number
  valleyMountainHeight?: number
  valleyMountainDepth?: number
  valleyMountainAmplitude?: number
  valleyMountainWavelength?: number
  valleyMountainHalfSpaceDensity?: number
  valleyMountainMountainDensity?: number
  valleyMountainValleyDensity?: number
  density?: number
}): ValleyMountainParams {
  const s = VALLEY_MOUNTAIN_DEFAULTS
  const blockX = Math.max(1e-6, model.valleyMountainX ?? model.cubeX ?? s.blockX)
  const blockY = Math.max(1e-6, model.valleyMountainY ?? model.cubeY ?? s.blockY)
  const blockZ = Math.max(1e-6, model.valleyMountainZ ?? model.cubeZ ?? s.blockZ)
  const mountainHeight = Math.max(0, model.valleyMountainHeight ?? model.valleyMountainAmplitude ?? s.mountainHeight)
  const valleyDepth = Math.max(0, model.valleyMountainDepth ?? model.valleyMountainAmplitude ?? s.valleyDepth)
  const wavelength = Math.max(1e-6, model.valleyMountainWavelength ?? blockX)
  return {
    blockX,
    blockY,
    blockZ,
    mountainHeight,
    valleyDepth,
    wavelength,
    halfSpaceDensity: model.valleyMountainHalfSpaceDensity ?? model.valleyMountainValleyDensity ?? s.halfSpaceDensity,
    mountainValleyDensity: model.valleyMountainMountainDensity ?? model.density ?? s.mountainValleyDensity,
    halfSpaceX: blockX + s.halfSpacePadX * 2,
    halfSpaceY: blockY + s.halfSpacePadY * 2,
    halfSpaceZ: blockZ + s.halfSpacePadZ,
  }
}

/** Forward mesh: sinusoidal top z_top(x) = A sin(2πx/λ), A = (mountainHeight + valleyDepth) / 2. */
export function valleyMountainTopReliefX(
  x: number,
  mountainHeight: number,
  valleyDepth: number,
  wavelength: number,
): number {
  const amp = 0.5 * (mountainHeight + valleyDepth)
  if (amp <= 0 || wavelength <= 1e-9) return 0
  return amp * Math.sin((2 * Math.PI * x) / wavelength)
}

/** 3D preview only — original Gaussian mountain / valley bumps. */
export function valleyMountainDisplayReliefX(
  x: number,
  sizeX: number,
  mountainHeight: number,
  valleyDepth: number,
): number {
  const mountainCenter = -0.22 * sizeX
  const valleyCenter = 0.24 * sizeX
  const mountainSigma = 0.16 * sizeX
  const valleySigma = 0.17 * sizeX
  const mountain = mountainHeight * Math.exp(-((x - mountainCenter) ** 2) / (2 * mountainSigma * mountainSigma))
  const valley = valleyDepth * Math.exp(-((x - valleyCenter) ** 2) / (2 * valleySigma * valleySigma))
  return mountain - valley
}

export function valleyMountainDensityInAnomaly(
  x: number,
  mountainHeight: number,
  valleyDepth: number,
  wavelength: number,
  halfSpaceDensity: number,
  mountainValleyDensity: number,
): number {
  const relief = valleyMountainTopReliefX(x, mountainHeight, valleyDepth, wavelength)
  return relief >= 0 ? mountainValleyDensity : halfSpaceDensity
}
