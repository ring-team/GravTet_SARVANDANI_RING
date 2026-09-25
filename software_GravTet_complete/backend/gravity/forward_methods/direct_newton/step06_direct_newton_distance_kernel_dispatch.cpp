/**
 * Step 06/07 — Per-receiver distance-kernel dispatch and one-cell contribution routing.
 * Chooses scalar-only vs SIMD path (same as former compute_gz / compute_gz_from_range).
 */

#include "direct_newton_detail.h"
#include <vector>

namespace direct_newton {
namespace detail {

// --- Single receiver: full source list or contiguous subrange ---

double receiver_gz_dispatch(const Receiver& r, const std::vector<Source>& sources) {
    if (sources.empty()) return 0.0;
    const double rx = r.x, ry = r.y, rz = r.z;
#if defined(DIRECT_NEWTON_SCALAR_ONLY)
    return gz_scalar_loop(rx, ry, rz, sources.data(), sources.size());
#else
    return gz_simd_accumulate_sources(rx, ry, rz, sources.data(), sources.size());
#endif
}

double receiver_gz_from_range_dispatch(const Receiver& r, const std::vector<Source>& sources,
                                       std::size_t start, std::size_t end) {
    if (start >= end) return 0.0;
    const std::size_t n = end - start;
    const double rx = r.x, ry = r.y, rz = r.z;
    const Source* ptr = sources.data() + start;
#if defined(DIRECT_NEWTON_SCALAR_ONLY)
    return gz_scalar_loop(rx, ry, rz, ptr, n);
#else
    return gz_simd_accumulate_sources(rx, ry, rz, ptr, n);
#endif
}

} // namespace detail
} // namespace direct_newton
