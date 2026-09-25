// Step 05 — Barnes-Hut FAR-FIELD MAC traversal and monopole acceptance.
#include "../../common/gravity_constants.hpp"
#include "barnes_hut_detail.h"
#include <cmath>

namespace {
constexpr double G = gravity::physical::GRAVITATIONAL_CONSTANT;
constexpr double R2_MIN = gravity::physical::R2_SOFTENING_MIN;
}

namespace barnes_hut {
namespace detail {

double compute_gz_far_near_recursive(
    double rx,
    double ry,
    double rz,
    const OctreeNode* node,
    const std::vector<Source>& sources,
    double theta0
) {
    if (!node || node->mass <= 0) return 0;

    if (node->is_leaf) {
        return compute_gz_near_field_leaf(rx, ry, rz, node, sources);
    }

    double dx = rx - node->com_x;
    double dy = ry - node->com_y;
    double dz = rz - node->com_z;
    double r2 = dx * dx + dy * dy + dz * dz;

    if (r2 < R2_MIN) {
        double gz = 0;
        for (const auto& child : node->children) {
            if (child) gz += compute_gz_far_near_recursive(rx, ry, rz, child.get(), sources, theta0);
        }
        return gz;
    }

    const double r = std::sqrt(r2);
    const double theta = (2.0 * node->box.half_width) / r;

    // Far field: accepted cell contributes as one monopole term.
    if (theta < theta0) {
        return G * node->mass * dz / (r2 * r);
    }

    // Near field: descend to children, eventually leaf-direct summation.
    double gz = 0;
    for (const auto& child : node->children) {
        if (child) gz += compute_gz_far_near_recursive(rx, ry, rz, child.get(), sources, theta0);
    }
    return gz;
}

} // namespace detail
} // namespace barnes_hut

double compute_gz_barnes_hut(
    const Receiver& receiver,
    const OctreeNode* root,
    const std::vector<Source>& sources,
    double theta0
) {
    if (!root) return 0;
    return barnes_hut::detail::compute_gz_far_near_recursive(
        receiver.x, receiver.y, receiver.z, root, sources, theta0
    );
}
