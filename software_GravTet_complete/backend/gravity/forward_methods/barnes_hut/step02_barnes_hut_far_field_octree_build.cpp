// Step 02 — Barnes-Hut FAR-FIELD setup: build octree over source elements.
#include "../../common/gravity_constants.hpp"
#include "step01_barnes_hut_types_and_api.h"
#include <algorithm>
#include <limits>

namespace {

constexpr double BOX_PAD = 1e-12;  // small padding so points on boundary fall inside
/** Compute axis-aligned bounding box of sources; return center and half-width (cube). */
void compute_bbox(
    const std::vector<Source>& sources,
    const std::vector<size_t>& indices,
    double& cx, double& cy, double& cz,
    double& half_width
) {
    double min_x = std::numeric_limits<double>::max();
    double min_y = std::numeric_limits<double>::max();
    double min_z = std::numeric_limits<double>::max();
    double max_x = -std::numeric_limits<double>::max();
    double max_y = -std::numeric_limits<double>::max();
    double max_z = -std::numeric_limits<double>::max();

    for (size_t i : indices) {
        const Source& s = sources[i];
        min_x = std::min(min_x, s.x);
        min_y = std::min(min_y, s.y);
        min_z = std::min(min_z, s.z);
        max_x = std::max(max_x, s.x);
        max_y = std::max(max_y, s.y);
        max_z = std::max(max_z, s.z);
    }

    cx = (min_x + max_x) * 0.5;
    cy = (min_y + max_y) * 0.5;
    cz = (min_z + max_z) * 0.5;
    double hx = (max_x - min_x) * 0.5 + BOX_PAD;
    double hy = (max_y - min_y) * 0.5 + BOX_PAD;
    double hz = (max_z - min_z) * 0.5 + BOX_PAD;
    half_width = std::max({hx, hy, hz});
}

/** Octant index 0..7: (x >= cx ? 4 : 0) | (y >= cy ? 2 : 0) | (z >= cz ? 1 : 0) */
inline int octant(double x, double y, double z, double cx, double cy, double cz) {
    int o = 0;
    if (x >= cx) o |= 4;
    if (y >= cy) o |= 2;
    if (z >= cz) o |= 1;
    return o;
}

/** Recursive split: assign indices to octants, create children, recurse. */
void split(
    OctreeNode* node,
    const std::vector<Source>& sources,
    std::vector<size_t> indices,
    size_t max_sources_per_leaf,
    size_t max_depth,
    size_t depth
) {
    const double cx = node->box.cx;
    const double cy = node->box.cy;
    const double cz = node->box.cz;
    const double h = node->box.half_width;

    if (indices.size() <= max_sources_per_leaf || depth >= max_depth) {
        node->is_leaf = true;
        node->source_indices = std::move(indices);
        return;
    }

    node->is_leaf = false;
    node->source_indices.clear();
    std::array<std::vector<size_t>, 8> child_indices;

    for (size_t i : indices) {
        const Source& s = sources[i];
        int k = octant(s.x, s.y, s.z, cx, cy, cz);
        child_indices[k].push_back(i);
    }

    const double child_half = h * 0.5;
    static const int dx[] = {-1, -1, -1, -1, 1, 1, 1, 1};
    static const int dy[] = {-1, -1, 1, 1, -1, -1, 1, 1};
    static const int dz[] = {-1, 1, -1, 1, -1, 1, -1, 1};

    for (int k = 0; k < 8; k++) {
        if (child_indices[k].empty()) continue;
        double ccx = cx + dx[k] * child_half;
        double ccy = cy + dy[k] * child_half;
        double ccz = cz + dz[k] * child_half;
        node->children[k] = std::make_unique<OctreeNode>(ccx, ccy, ccz, child_half);
        split(
            node->children[k].get(),
            sources,
            std::move(child_indices[k]),
            max_sources_per_leaf,
            max_depth,
            depth + 1
        );
    }
}

} // namespace

std::unique_ptr<OctreeNode> build_octree(
    const std::vector<Source>& sources,
    size_t max_sources_per_leaf,
    size_t max_depth
) {
    if (sources.empty()) return nullptr;

    std::vector<size_t> all(sources.size());
    for (size_t i = 0; i < sources.size(); i++) all[i] = i;

    double cx, cy, cz, half_width;
    compute_bbox(sources, all, cx, cy, cz, half_width);

    auto root = std::make_unique<OctreeNode>(cx, cy, cz, half_width);
    split(root.get(), sources, std::move(all), max_sources_per_leaf, max_depth, 0);
    return root;
}

void traverse_preorder(
    const OctreeNode* node,
    std::function<void(const OctreeNode&)> visit
) {
    if (!node) return;
    visit(*node);
    if (!node->is_leaf) {
        for (const auto& child : node->children) {
            if (child) traverse_preorder(child.get(), visit);
        }
    }
}

void visit_leaves(
    const OctreeNode* node,
    std::function<void(const OctreeNode&)> visit
) {
    if (!node) return;
    if (node->is_leaf) {
        visit(*node);
        return;
    }
    for (const auto& child : node->children) {
        if (child) visit_leaves(child.get(), visit);
    }
}
