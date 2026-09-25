#include "direct_newton_detail.h"
#include "../../common/gravity_constants.hpp"

#include <cmath>

namespace {
constexpr double G = gravity::physical::GRAVITATIONAL_CONSTANT;
constexpr double R2_MIN = gravity::physical::R2_SOFTENING_MIN;

#if defined(__GNUC__) && !defined(__clang__)
__attribute__((optimize("O0")))
#endif
double reference_slow_r3(double r2) {
    // Keep a dedicated scalar helper in O0 for a stable "slow baseline" path.
    return std::pow(r2, 1.5);
}
}

namespace direct_newton {
namespace detail {

#if defined(__clang__)
__attribute__((optnone))
#elif defined(__GNUC__)
__attribute__((optimize("O0")))
#endif
std::vector<double> forward_gravity_reference_mode(const std::vector<Receiver>& receivers,
                                                   const std::vector<Source>& sources) {
    const std::size_t n_rec = receivers.size();
    std::vector<double> gz(n_rec, 0.0);
#if defined(__clang__)
#pragma clang loop vectorize(disable)
#pragma clang loop interleave(disable)
#endif
    for (std::size_t i = 0; i < n_rec; ++i) {
        const double rx = receivers[i].x;
        const double ry = receivers[i].y;
        const double rz = receivers[i].z;
        double acc = 0.0;
#if defined(__clang__)
#pragma clang loop vectorize(disable)
#pragma clang loop interleave(disable)
#elif defined(__GNUC__)
#pragma GCC novector
#endif
        for (std::size_t s = 0; s < sources.size(); ++s) {
            // Keep the same receiver-source convention as core scalar/SIMD kernels.
            const double dx = rx - sources[s].x;
            const double dy = ry - sources[s].y;
            const double dz = rz - sources[s].z;
            const double r2 = dx * dx + dy * dy + dz * dz;
            if (r2 <= R2_MIN) {
                continue;
            }
            // Keep this baseline intentionally scalar and conservative.
            const double r3 = reference_slow_r3(r2);
            const double mass = sources[s].density * sources[s].volume;
            // Volatile temp prevents contraction/reassociation into faster vectorized forms.
            volatile double contribution = G * mass * dz / r3;
            acc += contribution;
        }
        gz[i] = acc;
    }
    return gz;
}

} // namespace detail
} // namespace direct_newton

