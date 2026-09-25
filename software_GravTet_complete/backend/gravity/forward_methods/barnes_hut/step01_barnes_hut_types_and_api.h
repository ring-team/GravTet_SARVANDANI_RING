// Step 01 — Barnes-Hut shared types and public API.
#ifndef STEP01_BARNES_HUT_TYPES_AND_API_H
#define STEP01_BARNES_HUT_TYPES_AND_API_H

#include <array>
#include <cstddef>
#include <functional>
#include <memory>
#include <vector>

// Shared source/receiver layout used across forward solvers (fields match
// backend/gravity/forward_methods/direct_newton/step01_direct_newton_continuous_gravity.h,
// declared independently here so Barnes–Hut does not depend on that header).
struct Source {
    double x, y, z;     // position (m)
    double density;     // kg/m^3
    double volume;      // m^3
};

struct Receiver {
    double x, y, z;      // position (m)
};

/** Axis-aligned cube: center (cx, cy, cz) and half-width (same in x,y,z). */
struct Box {
    double cx, cy, cz;
    double half_width;
};

/**
 * Octree node over sources. Either an internal node with 8 children or a leaf
 * holding source indices into the original std::vector<Source>.
 * After compute_moments(), mass and (com_x, com_y, com_z) are set for all nodes.
 */
struct OctreeNode {
    Box box;
    bool is_leaf = true;
    // If is_leaf: indices into the sources array used in build_octree
    std::vector<size_t> source_indices;
    // If !is_leaf: up to 8 children (nullptr if octant empty)
    std::array<std::unique_ptr<OctreeNode>, 8> children{};

    // Step 2: cell moments (set by compute_moments)
    double mass = 0;       // total mass in this cell (kg)
    double com_x = 0, com_y = 0, com_z = 0;  // center of mass (m)

    OctreeNode() = default;
    OctreeNode(double cx, double cy, double cz, double half_width)
        : box{cx, cy, cz, half_width}, is_leaf(true) {}
};

/**
 * Build an octree over the given sources.
 * Subdivides until each leaf has at most max_sources_per_leaf sources or
 * max_depth is reached.
 *
 * @param sources   All source points (positions used for spatial split).
 * @param max_sources_per_leaf  Max sources per leaf (e.g. 4--16).
 * @param max_depth Maximum tree depth (e.g. 20--30).
 * @return Root of the octree, or nullptr if sources is empty.
 */
std::unique_ptr<OctreeNode> build_octree(
    const std::vector<Source>& sources,
    size_t max_sources_per_leaf = 8,
    size_t max_depth = 32
);

/**
 * Traverse the tree in pre-order; the callback is invoked for every node
 * (including internal nodes and leaves).
 */
void traverse_preorder(
    const OctreeNode* node,
    std::function<void(const OctreeNode&)> visit
);

/**
 * Visit only leaf nodes.
 */
void visit_leaves(
    const OctreeNode* node,
    std::function<void(const OctreeNode&)> visit
);

/**
 * Step 2: Compute total mass and center of mass for every node (upward pass).
 * Call after build_octree(). Leaves: from source masses; internal nodes: from children.
 * @param node   Root of the tree (modified in place).
 * @param sources The same vector passed to build_octree (for leaf source_indices).
 */
void compute_moments(OctreeNode* node, const std::vector<Source>& sources);

/**
 * Step 3: Vertical gravity g_z at one receiver via Barnes–Hut traverse.
 * Tree must have been built and compute_moments() called.
 * @return g_z in m/s^2 (same units as Direct Newton).
 */
double compute_gz_barnes_hut(
    const Receiver& receiver,
    const OctreeNode* root,
    const std::vector<Source>& sources,
    double theta0 = 0.5
);

/**
 * Step 3: g_z for all receivers. Builds octree once, computes moments, then
 * traverses for each receiver. Same output order as receivers.
 * @return Vector of g_z in m/s^2.
 */
std::vector<double> forward_gravity_barnes_hut(
    const std::vector<Receiver>& receivers,
    const std::vector<Source>& sources,
    double theta0 = 0.5,
    size_t max_sources_per_leaf = 8,
    size_t max_depth = 32
);

#endif // STEP01_BARNES_HUT_TYPES_AND_API_H
