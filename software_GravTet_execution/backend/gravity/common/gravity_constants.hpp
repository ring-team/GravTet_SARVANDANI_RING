#pragma once

/**
 * Shared physical constants for gravity solvers (Direct Newton, AMFM, Barnes–Hut, quadrature).
 * Keep in sync with `direct_newton_const.h` consumers and kernel softening in each method.
 */
namespace gravity {
namespace physical {

/** Newton's gravitational constant G (m³ kg⁻¹ s⁻²). */
inline constexpr double GRAVITATIONAL_CONSTANT = 6.67430e-11;

/** Minimum squared distance (m²) used to avoid division by zero in 1/r³ kernels. */
inline constexpr double R2_SOFTENING_MIN = 1e-10;

} // namespace physical
} // namespace gravity
