/**
 * Step 08 — Scalar summation over discretized cells (vertical gz kernel).
 * No SIMD; used as fallback tail and for DirectNewtonExecutionMode::Tiled.
 */

#include "direct_newton_detail.h"
#include "direct_newton_const.h"
#include <cmath>

namespace direct_newton {
namespace detail {

using namespace consts;

double gz_scalar_loop(double rx, double ry, double rz, const Source* __restrict__ sources, std::size_t n) {
    double gz = 0.0;
    for (std::size_t i = 0; i < n; i++) {
        const Source& s = sources[i];
        // Step 6a: build distance vector receiver - source.
        double dx = rx - s.x;
        double dy = ry - s.y;
        double dz = rz - s.z;
        // Step 6b: evaluate squared distance and r^-3 kernel denominator.
        double r2 = dx * dx + dy * dy + dz * dz;
        if (r2 < R2_MIN) continue;
        double r3 = std::pow(r2, 1.5);
        // Step 7: one-cell contribution uses mass = density * volume.
        double mass = s.density * s.volume;
        // Step 8: accumulate contribution into receiver gz sum.
        gz += G * mass * dz / r3;
    }
    return gz;
}

double gz_scalar_one(const Receiver& r, const std::vector<Source>& sources) {
    if (sources.empty()) return 0.0;
    return gz_scalar_loop(r.x, r.y, r.z, sources.data(), sources.size());
}

double gz_scalar_range(const Receiver& r, const std::vector<Source>& sources, std::size_t start, std::size_t end) {
    if (start >= end) return 0.0;
    return gz_scalar_loop(r.x, r.y, r.z, sources.data() + start, end - start);
}

} // namespace detail
} // namespace direct_newton

