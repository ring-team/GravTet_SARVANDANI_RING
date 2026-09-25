// direct_newton_const.h: direct Newton — pairwise gz kernels / tuning.
#pragma once

#include "../../common/gravity_constants.hpp"
#include <cstddef>

namespace direct_newton {
namespace consts {

inline constexpr double G = gravity::physical::GRAVITATIONAL_CONSTANT;
inline constexpr double R2_MIN = gravity::physical::R2_SOFTENING_MIN;

/** Block sizes for cache-friendly receiver × source tiling (L2/L3 reuse). */
inline constexpr std::size_t RECEIVER_BLOCK = 64;
inline constexpr std::size_t SOURCE_BLOCK = 128;

/** Resolve a requested block size: 0/negative => default, then clamp to [1, n]. */
inline std::size_t resolve_block_size(int requested, std::size_t n, std::size_t default_v) {
    if (n == 0) {
        return 1;
    }
    std::size_t b = (requested > 0) ? static_cast<std::size_t>(requested) : default_v;
    if (b < 1) {
        b = 1;
    }
    if (b > n) {
        b = n;
    }
    return b;
}

} // namespace consts
} // namespace direct_newton
