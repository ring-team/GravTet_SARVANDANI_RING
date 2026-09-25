/**
 * Step 09 — Direct Newton all-receivers orchestration (public API).
 *
 * Optimization steps:
 *   step10_direct_newton_reference.cpp   — pure scalar reference baseline
 *   step11_direct_newton_reference_tiled.cpp — scalar tiled single-thread path
 *   step12_direct_newton_simd.cpp        — SIMD (AVX2 / NEON) kernel
 *   step13_direct_newton_simd_tiled.cpp  — single-thread SIMD+tiled orchestration
 *   step14_direct_newton_simd_threading_tiled.cpp — SIMD multithreading+tiled orchestration
 */

#include "step01_direct_newton_continuous_gravity.h"
#include "direct_newton_detail.h"

std::vector<double> forward_gravity(const std::vector<Receiver>& receivers,
                                      const std::vector<Source>& sources) {
    // Step 9: compute gravity for all receivers (default execution mode).
    return forward_gravity_with_mode(
        receivers,
        sources,
        DirectNewtonExecutionMode::SIMDTiledThreading,
        /*num_threads_requested=*/0,
        /*receiver_block_size=*/0,
        /*source_block_size=*/0
    );
}

std::vector<double> forward_gravity_with_mode(const std::vector<Receiver>& receivers,
                                              const std::vector<Source>& sources,
                                              DirectNewtonExecutionMode mode,
                                              int num_threads_requested,
                                              int receiver_block_size,
                                              int source_block_size) {
    using direct_newton::detail::forward_gravity_reference_tiled_mode;
    using direct_newton::detail::forward_gravity_simd_tiled_mode;
    using direct_newton::detail::forward_gravity_simd_threads_tiled_mode;
    using direct_newton::detail::forward_gravity_reference_mode;

    switch (mode) {
        case DirectNewtonExecutionMode::Reference:
            return forward_gravity_reference_mode(receivers, sources);
        case DirectNewtonExecutionMode::Tiled:
            return forward_gravity_reference_tiled_mode(
                receivers, sources, receiver_block_size, source_block_size);
        case DirectNewtonExecutionMode::SIMDTiled:
            return forward_gravity_simd_tiled_mode(
                receivers, sources, receiver_block_size, source_block_size);
        case DirectNewtonExecutionMode::SIMDTiledThreading:
        default:
            return forward_gravity_simd_threads_tiled_mode(
                receivers, sources, num_threads_requested, receiver_block_size, source_block_size);
    }
}

double compute_gz(const Receiver& receiver, const std::vector<Source>& sources) {
    return direct_newton::detail::receiver_gz_dispatch(receiver, sources);
}

double to_mGal(double g_si) {
    return g_si * 1e5;
}
