/**
 * Step 14 — Multithreading + tiled blocking orchestration.
 *
 * Behavior:
 * 1) Small workloads: split contiguous receiver ranges across threads (no explicit tiling).
 * 2) Large workloads: tile over receiver blocks × source blocks and distribute receiver-block
 *    stripes across threads.
 *
 * This keeps writes disjoint per thread (no locks/atomics) and improves cache locality in the
 * large-workload branch.
 */

#include "direct_newton_detail.h"
#include "direct_newton_const.h"
#include <thread>
#include <vector>

namespace direct_newton {
namespace detail {

std::vector<double> forward_gravity_simd_threads_tiled_mode(const std::vector<Receiver>& receivers,
                                                            const std::vector<Source>& sources,
                                                            int num_threads_requested,
                                                            int receiver_block_size,
                                                            int source_block_size) {
    const std::size_t n_rec = receivers.size();
    const std::size_t n_src = sources.size();
    std::vector<double> gz(n_rec, 0.0);

    const std::size_t RECEIVER_BLOCK =
        consts::resolve_block_size(receiver_block_size, n_rec, consts::RECEIVER_BLOCK);
    const std::size_t SOURCE_BLOCK =
        consts::resolve_block_size(source_block_size, n_src, consts::SOURCE_BLOCK);

    const bool use_blocks = (n_src > SOURCE_BLOCK || n_rec > RECEIVER_BLOCK) && n_src > 0;

    // Small problem: thread over contiguous receiver ranges.
    if (!use_blocks) {
        unsigned int n_threads = 0;
        const unsigned int hw = std::thread::hardware_concurrency();
        if (num_threads_requested > 0) {
            n_threads = static_cast<unsigned int>(num_threads_requested);
            if (hw > 0 && n_threads > hw) n_threads = hw;
        } else {
            n_threads = hw;
        }
        if (n_threads == 0) n_threads = 1;
        if (n_rec < 2 || n_threads < 2) {
            for (std::size_t i = 0; i < n_rec; ++i) gz[i] = receiver_gz_dispatch(receivers[i], sources);
            return gz;
        }
        std::size_t work_per = (n_rec + n_threads - 1) / n_threads;
        if (work_per < 1) work_per = 1;
        n_threads = static_cast<unsigned int>((n_rec + work_per - 1) / work_per);
        if (n_threads < 2) {
            for (std::size_t i = 0; i < n_rec; ++i) gz[i] = receiver_gz_dispatch(receivers[i], sources);
            return gz;
        }
        std::vector<std::thread> threads;
        threads.reserve(n_threads);
        for (unsigned int t = 0; t < n_threads; ++t) {
            std::size_t i0 = t * work_per;
            std::size_t i1 = (t + 1) * work_per;
            if (i1 > n_rec) i1 = n_rec;
            if (i0 >= n_rec) break;
            threads.emplace_back([&receivers, &sources, &gz, i0, i1]() {
                for (std::size_t i = i0; i < i1; ++i) gz[i] = receiver_gz_dispatch(receivers[i], sources);
            });
        }
        for (auto& th : threads) th.join();
        return gz;
    }

    // Large problem: explicit receiver/source tiling.
    const std::size_t num_r_blocks = (n_rec + RECEIVER_BLOCK - 1) / RECEIVER_BLOCK;
    const std::size_t num_s_blocks = (n_src + SOURCE_BLOCK - 1) / SOURCE_BLOCK;

    unsigned int n_threads = 0;
    const unsigned int hw = std::thread::hardware_concurrency();
    if (num_threads_requested > 0) {
        n_threads = static_cast<unsigned int>(num_threads_requested);
        if (hw > 0 && n_threads > hw) n_threads = hw;
    } else {
        n_threads = hw;
    }
    if (n_threads == 0) n_threads = 1;
    if (num_r_blocks < 2 || n_threads < 2) {
        for (std::size_t br = 0; br < num_r_blocks; ++br) {
            const std::size_t r0 = br * RECEIVER_BLOCK;
            const std::size_t r1 = (r0 + RECEIVER_BLOCK > n_rec) ? n_rec : (r0 + RECEIVER_BLOCK);
            for (std::size_t bs = 0; bs < num_s_blocks; ++bs) {
                const std::size_t s0 = bs * SOURCE_BLOCK;
                const std::size_t s1 = (s0 + SOURCE_BLOCK > n_src) ? n_src : (s0 + SOURCE_BLOCK);
                for (std::size_t i = r0; i < r1; ++i)
                    gz[i] += receiver_gz_from_range_dispatch(receivers[i], sources, s0, s1);
            }
        }
        return gz;
    }

    std::vector<std::thread> threads;
    threads.reserve(n_threads);
    for (unsigned int t = 0; t < n_threads; ++t) {
        threads.emplace_back([&, RECEIVER_BLOCK, SOURCE_BLOCK, num_r_blocks, num_s_blocks, n_threads, t]() {
            for (std::size_t br = t; br < num_r_blocks; br += n_threads) {
                const std::size_t r0 = br * RECEIVER_BLOCK;
                const std::size_t r1 = (r0 + RECEIVER_BLOCK > n_rec) ? n_rec : (r0 + RECEIVER_BLOCK);
                for (std::size_t bs = 0; bs < num_s_blocks; ++bs) {
                    const std::size_t s0 = bs * SOURCE_BLOCK;
                    const std::size_t s1 = (s0 + SOURCE_BLOCK > n_src) ? n_src : (s0 + SOURCE_BLOCK);
                    for (std::size_t i = r0; i < r1; ++i)
                        gz[i] += receiver_gz_from_range_dispatch(receivers[i], sources, s0, s1);
                }
            }
        });
    }
    for (auto& th : threads) th.join();

    return gz;
}

} // namespace detail
} // namespace direct_newton
