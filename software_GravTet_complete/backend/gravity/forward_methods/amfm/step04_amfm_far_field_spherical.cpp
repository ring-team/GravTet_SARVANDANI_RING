// ============================================================================
// AMFM Workflow - Phase 3: Spherical harmonics
// Step 3.1: R_nm, S_nm (Eq. 7) — regular and singular solid harmonics
// ============================================================================
// Paper Eq. (7):
//   R_nm(x) = [1/(n+m)!] P_n^m(cos θ) e^{imφ} r^n
//   S_nm(x) = (n−m)! P_n^m(cos θ) e^{imφ} 1/r^{n+1}
// P_n^m = associated Legendre (Ferrers convention).
// ============================================================================

#include "step04_amfm_far_field_spherical.h"
#include <cmath>
#include <vector>

namespace AMFMSpherical {

namespace {
    std::vector<double> s_factorial;
    bool s_factorials_done = false;

    double factorial(int k) {
        if (k < 0) return 0;
        if (k >= static_cast<int>(s_factorial.size())) return 0;
        return s_factorial[k];
    }

    /**
     * Associated Legendre P_n^m(cos theta), Ferrers normalization, 0 <= m <= n only.
     * x = cos(theta), sin_theta = sin(theta).
     */
    double legendre_P_nm(int n, int m, double x, double sin_theta) {
        if (m > n || n < 0 || m < 0) return 0;
        if (sin_theta < 1e-15) {
            if (m == 0) {
                if (n == 0) return 1.0;
                if (n == 1) return x;
                if (n == 2) return 0.5 * (3 * x * x - 1);
                if (x >= 1.0 - 1e-10) return 1.0;
                if (x <= -1.0 + 1e-10) return (n % 2 == 0 ? 1.0 : -1.0);
                double P0 = 1.0, P1 = x;
                for (int k = 1; k < n; k++) {
                    double P2 = ((2 * k + 1) * x * P1 - k * P0) / (k + 1);
                    P0 = P1;
                    P1 = P2;
                }
                return P1;
            }
            return 0;
        }
        double u = std::sqrt(1 - x * x);
        if (u < 1e-15) u = 1e-15;
        std::vector<double> P_mm(n + 1);
        P_mm[m] = 1.0;
        for (int i = 0; i < m; i++)
            P_mm[m] *= -((2 * i + 1) * u);
        if (n == m) return P_mm[m];
        P_mm[m + 1] = (2 * m + 1) * x * P_mm[m];
        if (n == m + 1) return P_mm[m + 1];
        for (int nn = m + 2; nn <= n; nn++)
            P_mm[nn] = ((2 * nn - 1) * x * P_mm[nn - 1] - (nn + m - 1) * P_mm[nn - 2]) /
                       static_cast<double>(nn - m);
        return P_mm[n];
    }
} // anonymous namespace

void ensure_factorials(int max_n) {
    if (s_factorials_done && max_n < static_cast<int>(s_factorial.size())) return;
    int N = std::max(max_n * 2, 64);
    s_factorial.resize(N + 1);
    s_factorial[0] = 1.0;
    for (int k = 1; k <= N; k++)
        s_factorial[k] = s_factorial[k - 1] * k;
    s_factorials_done = true;
}

void cartesian_to_spherical(double x, double y, double z,
                            double& r, double& theta_rad, double& phi_rad) {
    r = std::sqrt(x * x + y * y + z * z);
    if (r < 1e-20) {
        theta_rad = 0;
        phi_rad = 0;
        return;
    }
    double cos_theta = z / r;
    if (cos_theta > 1.0) cos_theta = 1.0;
    if (cos_theta < -1.0) cos_theta = -1.0;
    theta_rad = std::acos(cos_theta);
    phi_rad = std::atan2(y, x);
}

std::complex<double> R_nm_spherical(int n, int m, double r, double cos_theta,
                                    double sin_theta, double phi_rad) {
    if (n < 0 || m < -n || m > n) return 0;
    int m_abs = (m >= 0 ? m : -m);
    ensure_factorials(n + m_abs);
    double P = legendre_P_nm(n, m_abs, cos_theta, sin_theta);
    if (m < 0)
        P = ((m_abs % 2 == 0) ? 1 : -1) * factorial(n - m_abs) / factorial(n + m_abs) * P;
    double fac = 1.0 / factorial(n + m_abs);
    double rn = (n == 0 && r == 0) ? 1.0 : std::pow(r, n);
    std::complex<double> eim(std::cos(m * phi_rad), std::sin(m * phi_rad));
    return fac * P * eim * rn;
}

std::complex<double> S_nm_spherical(int n, int m, double r, double cos_theta,
                                    double sin_theta, double phi_rad) {
    if (n < 0 || m < -n || m > n) return 0;
    if (r < 1e-20) return 0;
    int m_abs = (m >= 0 ? m : -m);
    ensure_factorials(n + m_abs);
    double P = legendre_P_nm(n, m_abs, cos_theta, sin_theta);
    if (m < 0)
        P = ((m_abs % 2 == 0) ? 1 : -1) * factorial(n - m_abs) / factorial(n + m_abs) * P;
    double fac = factorial(n - m_abs);
    std::complex<double> eim(std::cos(m * phi_rad), std::sin(m * phi_rad));
    return fac * P * eim / std::pow(r, n + 1);
}

std::complex<double> R_nm(int n, int m, double x, double y, double z) {
    double r, theta, phi;
    cartesian_to_spherical(x, y, z, r, theta, phi);
    double cos_theta = std::cos(theta);
    double sin_theta = std::sin(theta);
    if (r < 1e-20) {
        if (n == 0 && m == 0) return 1.0;
        return 0.0;
    }
    return R_nm_spherical(n, m, r, cos_theta, sin_theta, phi);
}

std::complex<double> S_nm(int n, int m, double x, double y, double z) {
    double r, theta, phi;
    cartesian_to_spherical(x, y, z, r, theta, phi);
    if (r < 1e-20) return 0.0;
    double cos_theta = std::cos(theta);
    double sin_theta = std::sin(theta);
    return S_nm_spherical(n, m, r, cos_theta, sin_theta, phi);
}

static const double GRAD_H = 1e-7;

void gradient_R_nm(int n, int m, double x, double y, double z,
                  std::complex<double>& ddx, std::complex<double>& ddy, std::complex<double>& ddz) {
    double scale = std::max({1.0, std::abs(x), std::abs(y), std::abs(z)});
    double h = GRAD_H * scale;
    if (h < 1e-15) h = 1e-15;
    ddx = (R_nm(n, m, x + h, y, z) - R_nm(n, m, x - h, y, z)) / (2.0 * h);
    ddy = (R_nm(n, m, x, y + h, z) - R_nm(n, m, x, y - h, z)) / (2.0 * h);
    ddz = (R_nm(n, m, x, y, z + h) - R_nm(n, m, x, y, z - h)) / (2.0 * h);
}

} // namespace AMFMSpherical
