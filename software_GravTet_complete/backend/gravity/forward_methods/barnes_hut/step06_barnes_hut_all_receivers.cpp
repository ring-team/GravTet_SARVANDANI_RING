// Step 06 — Barnes-Hut all-receiver orchestration.
// Pipeline:
//   Step 02 (far-field setup: octree build)
//   Step 03 (far-field setup: moments)
//   Step 05 (far-field MAC traversal) + Step 04 (near-field direct at leaves)
#include "step01_barnes_hut_types_and_api.h"
#include <thread>

namespace {
constexpr size_t RECEIVER_BLOCK = 64;
}

std::vector<double> forward_gravity_barnes_hut(
    const std::vector<Receiver>& receivers,
    const std::vector<Source>& sources,
    double theta0,
    size_t max_sources_per_leaf,
    size_t max_depth
) {
    const size_t n_rec = receivers.size();
    std::vector<double> gz(n_rec, 0.0);
    if (sources.empty()) return gz;

    auto root = build_octree(sources, max_sources_per_leaf, max_depth);
    if (!root) return gz;
    compute_moments(root.get(), sources);

    unsigned int n_threads = std::thread::hardware_concurrency();
    if (n_threads == 0) n_threads = 1;
    if (n_rec < 2 || n_threads < 2) {
        for (size_t i = 0; i < n_rec; i++) {
            gz[i] = compute_gz_barnes_hut(receivers[i], root.get(), sources, theta0);
        }
        return gz;
    }

    size_t work_per = (n_rec + n_threads - 1) / n_threads;
    if (work_per < 1) work_per = 1;
    work_per = ((work_per + RECEIVER_BLOCK - 1) / RECEIVER_BLOCK) * RECEIVER_BLOCK;
    n_threads = static_cast<unsigned int>((n_rec + work_per - 1) / work_per);
    if (n_threads < 2) {
        for (size_t i = 0; i < n_rec; i++) {
            gz[i] = compute_gz_barnes_hut(receivers[i], root.get(), sources, theta0);
        }
        return gz;
    }

    std::vector<std::thread> threads;
    threads.reserve(n_threads);
    const OctreeNode* root_ptr = root.get();
    for (unsigned int t = 0; t < n_threads; t++) {
        size_t i0 = t * work_per;
        size_t i1 = (t + 1) * work_per;
        if (i1 > n_rec) i1 = n_rec;
        if (i0 >= n_rec) break;
        threads.emplace_back([&receivers, &sources, &gz, root_ptr, theta0, i0, i1]() {
            for (size_t i = i0; i < i1; i++) {
                gz[i] = compute_gz_barnes_hut(receivers[i], root_ptr, sources, theta0);
            }
        });
    }

    for (auto& th : threads) th.join();
    return gz;
}
