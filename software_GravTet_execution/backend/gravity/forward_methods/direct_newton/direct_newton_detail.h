// direct_newton_detail.h: direct Newton — pairwise gz kernels / tuning.
#pragma once

/**
 * Internal API for splitting Direct Newton forward modeling into steps:
 *   step06 — per-receiver dispatch (distance/kernel routing)
 *   step08 — scalar source summation kernel
 *   step10 — SIMD (AVX2 / NEON)
 *   step11 — multithreading over receiver tiles
 *   step12 — blocked / tiled loops over receivers × sources
 *
 * Public declarations come from step01_direct_newton_continuous_gravity.h.
 */

#include "step01_direct_newton_continuous_gravity.h"
#include <cstddef>
#include <vector>

namespace direct_newton {
namespace detail {

// --- step08: scalar ----------------------------------------------------------

double gz_scalar_loop(double rx, double ry, double rz, const Source* __restrict__ sources, std::size_t n);

double gz_scalar_one(const Receiver& r, const std::vector<Source>& sources);

double gz_scalar_range(const Receiver& r, const std::vector<Source>& sources, std::size_t start, std::size_t end);

// --- step10: SIMD (optional; scalar fallback when unavailable) ---------------

/** Sum vertical gz for n sources at (rx,ry,rz); uses SIMD where compiled, else scalar loop. */
double gz_simd_accumulate_sources(double rx, double ry, double rz, const Source* __restrict__ sources, std::size_t n);

// --- step06: dispatch (one receiver or source subrange) -----------------------

double receiver_gz_dispatch(const Receiver& r, const std::vector<Source>& sources);

double receiver_gz_from_range_dispatch(const Receiver& r, const std::vector<Source>& sources,
                                       std::size_t start, std::size_t end);

// --- step11/step12: full-grid orchestration -----------------------------------

std::vector<double> forward_gravity_reference_tiled_mode(const std::vector<Receiver>& receivers,
                                                         const std::vector<Source>& sources,
                                                         int receiver_block_size = 0,
                                                         int source_block_size = 0);

std::vector<double> forward_gravity_simd_tiled_mode(const std::vector<Receiver>& receivers,
                                                    const std::vector<Source>& sources,
                                                    int receiver_block_size = 0,
                                                    int source_block_size = 0);

std::vector<double> forward_gravity_simd_threads_tiled_mode(const std::vector<Receiver>& receivers,
                                                            const std::vector<Source>& sources,
                                                            int num_threads_requested,
                                                            int receiver_block_size = 0,
                                                            int source_block_size = 0);

// Pure reference path: no tiling, no SIMD, no multithreading.
std::vector<double> forward_gravity_reference_mode(const std::vector<Receiver>& receivers,
                                                   const std::vector<Source>& sources);

} // namespace detail
} // namespace direct_newton
