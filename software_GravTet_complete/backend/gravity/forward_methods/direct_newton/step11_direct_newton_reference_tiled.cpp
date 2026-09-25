/**
 * Step 11 — Reference-tiled single-thread orchestration.
 * Improves cache locality for large receiver grids and/or large source lists.
 * Used by execution mode:
 *   - Scalar (mapped to reference-tiled path)
 */

#include "direct_newton_detail.h"
#include "direct_newton_const.h"
#include <vector>

namespace direct_newton {
namespace detail {

std::vector<double> forward_gravity_reference_tiled_mode(const std::vector<Receiver>& receivers,
                                                         const std::vector<Source>& sources,
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
    if (!use_blocks) {
        for (std::size_t i = 0; i < n_rec; ++i) gz[i] = gz_scalar_one(receivers[i], sources);
        return gz;
    }

    const std::size_t num_r_blocks = (n_rec + RECEIVER_BLOCK - 1) / RECEIVER_BLOCK;
    const std::size_t num_s_blocks = (n_src + SOURCE_BLOCK - 1) / SOURCE_BLOCK;
    for (std::size_t br = 0; br < num_r_blocks; ++br) {
        const std::size_t r0 = br * RECEIVER_BLOCK;
        const std::size_t r1 = (r0 + RECEIVER_BLOCK > n_rec) ? n_rec : (r0 + RECEIVER_BLOCK);
        for (std::size_t bs = 0; bs < num_s_blocks; ++bs) {
            const std::size_t s0 = bs * SOURCE_BLOCK;
            const std::size_t s1 = (s0 + SOURCE_BLOCK > n_src) ? n_src : (s0 + SOURCE_BLOCK);
            for (std::size_t i = r0; i < r1; ++i) gz[i] += gz_scalar_range(receivers[i], sources, s0, s1);
        }
    }
    return gz;
}

} // namespace detail
} // namespace direct_newton
