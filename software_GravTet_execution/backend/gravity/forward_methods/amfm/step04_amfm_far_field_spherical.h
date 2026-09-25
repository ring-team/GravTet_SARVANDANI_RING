// step04_amfm_far_field_spherical.h: adaptive multilevel fast multipole (AMFM) gravity.
#ifndef AMFM_SPHERICAL_H
#define AMFM_SPHERICAL_H

// ============================================================================
// Adaptive Multilevel Fast Multipole (amfm) Workflow - Phase 3: Spherical Harmonics
// Step 3.1: R_nm and S_nm (Eq. 7) — regular and singular solid harmonics
// ============================================================================
// Paper Eq. (7): (r, θ, φ) spherical coordinates of x:
//   R_nm(x) = [1/(n+m)!] P_n^m(cos θ) e^{imφ} r^n
//   S_nm(x) = (n−m)! P_n^m(cos θ) e^{imφ} 1/r^{n+1}
// P_n^m = associated Legendre (Ferrers). Truncation order P (e.g. 7).
// ============================================================================

#include "step01_amfm_types.h"
#include <complex>
#include <vector>

namespace AMFMSpherical {

/** Maximum truncation order supported (n, m in range). */
constexpr int MAX_ORDER = 32;

/**
 * Convert Cartesian (x, y, z) to spherical (r, theta, phi).
 * theta = colatitude (0 at +z, π at -z), phi = azimuth (atan2(y,x)).
 * r = sqrt(x^2+y^2+z^2), cos(theta) = z/r.
 */
void cartesian_to_spherical(double x, double y, double z,
                            double& r, double& theta_rad, double& phi_rad);

/**
 * Regular solid harmonic R_nm(x). Paper Eq. (7).
 * R_nm = [1/(n+m)!] P_n^m(cos θ) e^{imφ} r^n.
 * Input: Cartesian vector (x,y,z) relative to expansion center.
 * Returns complex value. For r=0: R_00=1, R_nm=0 for n>0.
 */
std::complex<double> R_nm(int n, int m, double x, double y, double z);

/**
 * Singular solid harmonic S_nm(x). Paper Eq. (7).
 * S_nm = (n−m)! P_n^m(cos θ) e^{imφ} / r^{n+1}.
 * Input: Cartesian (x,y,z). Do not call at r=0 (singular).
 */
std::complex<double> S_nm(int n, int m, double x, double y, double z);

/**
 * Same R_nm with spherical input (r, theta, phi) in radians.
 */
std::complex<double> R_nm_spherical(int n, int m, double r, double cos_theta, double sin_theta, double phi_rad);

/**
 * Same S_nm with spherical input.
 */
std::complex<double> S_nm_spherical(int n, int m, double r, double cos_theta, double sin_theta, double phi_rad);

/** Precompute factorials 0!..n! for n up to 2*MAX_ORDER. Call once before using R_nm/S_nm. */
void ensure_factorials(int max_n);

/**
 * Cartesian gradient of R_nm: (∂R_nm/∂x, ∂R_nm/∂y, ∂R_nm/∂z).
 * Input (x,y,z) is the Cartesian vector r − r^c_c. Paper Eq. (18): g_far = G Σ ∇R_nm L_nm.
 * Implemented via central finite differences. Outputs (ddx, ddy, ddz) as complex.
 */
void gradient_R_nm(int n, int m, double x, double y, double z,
                  std::complex<double>& ddx, std::complex<double>& ddy, std::complex<double>& ddz);

} // namespace AMFMSpherical

#endif // AMFM_SPHERICAL_H
