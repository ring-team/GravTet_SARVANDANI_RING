#pragma once

#include <cstddef>

namespace quadrature_second_order {
namespace detail {

constexpr std::size_t DEFAULT_RECEIVER_BLOCK = 64;
constexpr std::size_t DEFAULT_CELL_BLOCK = 128;

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

} // namespace detail
} // namespace quadrature_second_order
