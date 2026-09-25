#include "quadrature_second_order_detail.h"
#include "../../common/gravity_constants.hpp"
#include <cmath>

namespace {
constexpr double G = gravity::physical::GRAVITATIONAL_CONSTANT;
constexpr double R2_MIN = gravity::physical::R2_SOFTENING_MIN;

#if defined(__GNUC__) && !defined(__clang__)
__attribute__((optimize("O0")))
#endif
double reference_slow_r3(double r2) {
    // Keep this baseline helper in O0 to avoid aggressive compiler shortcuts.
    return std::pow(r2, 1.5);
}
}

namespace quadrature_second_order {
namespace detail {

#if defined(__clang__)
__attribute__((optnone))
#elif defined(__GNUC__)
__attribute__((optimize("O0")))
#endif
std::vector<double> forward_quadrature_reference_mode(const std::vector<Receiver>& receivers,
                                                      const std::vector<PreparedTetra>& prepared) {
    const std::size_t n_rec = receivers.size();
    std::vector<double> gz(n_rec, 0.0);
#if defined(__clang__)
#pragma clang loop vectorize(disable)
#pragma clang loop interleave(disable)
#endif
    for (std::size_t i = 0; i < n_rec; ++i) {
        double acc = 0.0;
        const Receiver& r = receivers[i];
#if defined(__clang__)
#pragma clang loop vectorize(disable)
#pragma clang loop interleave(disable)
#endif
        for (std::size_t j = 0; j < prepared.size(); ++j) {
            const PreparedTetra& t = prepared[j];
#if defined(__clang__)
#pragma clang loop vectorize(disable)
#pragma clang loop interleave(disable)
#endif
            for (int m = 0; m < 4; ++m) {
                const double dx = r.x - t.qx[m];
                const double dy = r.y - t.qy[m];
                const double dz = r.z - t.qz[m];
                const double r2 = dx * dx + dy * dy + dz * dz;
                if (r2 <= R2_MIN) {
                    continue;
                }
                const double r3 = reference_slow_r3(r2);
                volatile double contribution = G * t.rho_w[m] * (dz / r3);
                acc += contribution;
            }
        }
        gz[i] = acc;
    }
    return gz;
}

#if defined(__clang__)
__attribute__((optnone))
#elif defined(__GNUC__)
__attribute__((optimize("O0")))
#endif
std::vector<double> forward_quadrature_reference_unprepared_mode(const std::vector<Receiver>& receivers,
                                                                 const std::vector<TetraCell>& cells) {
    const std::size_t n_rec = receivers.size();
    std::vector<double> gz(n_rec, 0.0);
#if defined(__clang__)
#pragma clang loop vectorize(disable)
#pragma clang loop interleave(disable)
#endif
    for (std::size_t i = 0; i < n_rec; ++i) {
        double acc = 0.0;
        const Receiver& r = receivers[i];
#if defined(__clang__)
#pragma clang loop vectorize(disable)
#pragma clang loop interleave(disable)
#endif
        for (std::size_t j = 0; j < cells.size(); ++j) {
            QuadPoint q[4];
            tetra_quadrature_points(cells[j], q);
#if defined(__clang__)
#pragma clang loop vectorize(disable)
#pragma clang loop interleave(disable)
#endif
            for (int m = 0; m < 4; ++m) {
                const double dx = r.x - q[m].x;
                const double dy = r.y - q[m].y;
                const double dz = r.z - q[m].z;
                const double r2 = dx * dx + dy * dy + dz * dz;
                if (r2 <= R2_MIN) {
                    continue;
                }
                const double r3 = reference_slow_r3(r2);
                volatile double contribution = G * cells[j].density * q[m].weight * (dz / r3);
                acc += contribution;
            }
        }
        gz[i] = acc;
    }
    return gz;
}

} // namespace detail
} // namespace quadrature_second_order

