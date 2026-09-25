#include "quadrature_second_order_detail.h"
#include "quadrature_const.h"

#include <thread>

namespace quadrature_second_order {
namespace detail {

std::vector<double> forward_quadrature_simd_threads_mode(const std::vector<Receiver>& receivers,
                                                         const std::vector<PreparedTetra>& prepared,
                                                         int num_threads_requested,
                                                         int receiver_block_size,
                                                         int source_block_size, int simd_lanes) {
    const std::size_t n_rec = receivers.size();
    const std::size_t n_cells = prepared.size();
    std::vector<double> gz(n_rec, 0.0);

    const std::size_t RECEIVER_BLOCK =
        resolve_block_size(receiver_block_size, n_rec, DEFAULT_RECEIVER_BLOCK);
    const std::size_t CELL_BLOCK =
        resolve_block_size(source_block_size, n_cells, DEFAULT_CELL_BLOCK);

    const bool use_blocks = (n_rec > RECEIVER_BLOCK || n_cells > CELL_BLOCK) && n_cells > 0;

    unsigned int n_threads = 0;
    if (num_threads_requested > 0) {
        n_threads = static_cast<unsigned int>(num_threads_requested);
        const unsigned int hw = std::thread::hardware_concurrency();
        if (hw > 0 && n_threads > hw) n_threads = hw;
    } else {
        n_threads = std::thread::hardware_concurrency();
    }
    if (n_threads == 0) n_threads = 1;

    if (!use_blocks) {
        if (n_rec < 2 || n_threads < 2) {
            for (std::size_t i = 0; i < n_rec; ++i) {
                gz[i] = receiver_gz_dispatch(receivers[i], prepared, 0, n_cells, simd_lanes);
            }
            return gz;
        }

        std::size_t work_per = (n_rec + n_threads - 1) / n_threads;
        if (work_per < 1) {
            work_per = 1;
        }
        n_threads = static_cast<unsigned int>((n_rec + work_per - 1) / work_per);

        std::vector<std::thread> threads;
        threads.reserve(n_threads);
        for (unsigned int t = 0; t < n_threads; ++t) {
            const std::size_t i0 = static_cast<std::size_t>(t) * work_per;
            std::size_t i1 = static_cast<std::size_t>(t + 1) * work_per;
            if (i1 > n_rec) {
                i1 = n_rec;
            }
            if (i0 >= n_rec) {
                break;
            }
            threads.emplace_back([&receivers, &prepared, &gz, i0, i1, n_cells, simd_lanes]() {
                for (std::size_t i = i0; i < i1; ++i) {
                    gz[i] = receiver_gz_dispatch(receivers[i], prepared, 0, n_cells, simd_lanes);
                }
            });
        }

        for (auto& th : threads) {
            th.join();
        }
        return gz;
    }

    const std::size_t n_rb = (n_rec + RECEIVER_BLOCK - 1) / RECEIVER_BLOCK;
    const std::size_t n_cb = (n_cells + CELL_BLOCK - 1) / CELL_BLOCK;

    if (n_rb < 2 || n_threads < 2) {
        for (std::size_t br = 0; br < n_rb; ++br) {
            const std::size_t r0 = br * RECEIVER_BLOCK;
            const std::size_t r1 = (r0 + RECEIVER_BLOCK > n_rec) ? n_rec : (r0 + RECEIVER_BLOCK);
            for (std::size_t bc = 0; bc < n_cb; ++bc) {
                const std::size_t c0 = bc * CELL_BLOCK;
                const std::size_t c1 = (c0 + CELL_BLOCK > n_cells) ? n_cells : (c0 + CELL_BLOCK);
                for (std::size_t i = r0; i < r1; ++i) {
                    gz[i] += receiver_gz_dispatch(receivers[i], prepared, c0, c1, simd_lanes);
                }
            }
        }
        return gz;
    }

    std::vector<std::thread> threads;
    threads.reserve(n_threads);
    for (unsigned int t = 0; t < n_threads; ++t) {
        threads.emplace_back([&, RECEIVER_BLOCK, CELL_BLOCK, n_rb, n_cb, n_threads, t]() {
            for (std::size_t br = t; br < n_rb; br += n_threads) {
                const std::size_t r0 = br * RECEIVER_BLOCK;
                const std::size_t r1 = (r0 + RECEIVER_BLOCK > n_rec) ? n_rec : (r0 + RECEIVER_BLOCK);
                for (std::size_t bc = 0; bc < n_cb; ++bc) {
                    const std::size_t c0 = bc * CELL_BLOCK;
                    const std::size_t c1 = (c0 + CELL_BLOCK > n_cells) ? n_cells : (c0 + CELL_BLOCK);
                    for (std::size_t i = r0; i < r1; ++i) {
                        gz[i] += receiver_gz_dispatch(receivers[i], prepared, c0, c1, simd_lanes);
                    }
                }
            }
        });
    }

    for (auto& th : threads) {
        th.join();
    }
    return gz;
}

} // namespace detail
} // namespace quadrature_second_order
