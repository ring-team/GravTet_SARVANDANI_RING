#include "quadrature_second_order_detail.h"
#include "quadrature_const.h"

namespace quadrature_second_order {
namespace detail {

std::vector<double> forward_quadrature_simd_mode(const std::vector<Receiver>& receivers,
                                                 const std::vector<PreparedTetra>& prepared,
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
    if (!use_blocks) {
        for (std::size_t i = 0; i < n_rec; ++i) {
            gz[i] = receiver_gz_dispatch(receivers[i], prepared, 0, n_cells, simd_lanes);
        }
        return gz;
    }

    const std::size_t n_rb = (n_rec + RECEIVER_BLOCK - 1) / RECEIVER_BLOCK;
    const std::size_t n_cb = (n_cells + CELL_BLOCK - 1) / CELL_BLOCK;
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

} // namespace detail
} // namespace quadrature_second_order
