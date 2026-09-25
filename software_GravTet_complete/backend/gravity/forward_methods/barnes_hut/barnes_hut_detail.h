// Internal Barnes-Hut helpers for near/far split kernels.
#pragma once

#include "step01_barnes_hut_types_and_api.h"

namespace barnes_hut {
namespace detail {

// Step 04 (near field): direct source summation at leaf nodes.
double compute_gz_near_field_leaf(
    double rx,
    double ry,
    double rz,
    const OctreeNode* leaf,
    const std::vector<Source>& sources
);

// Step 05 (far field + recursion): MAC and monopole handling.
double compute_gz_far_near_recursive(
    double rx,
    double ry,
    double rz,
    const OctreeNode* node,
    const std::vector<Source>& sources,
    double theta0
);

} // namespace detail
} // namespace barnes_hut
