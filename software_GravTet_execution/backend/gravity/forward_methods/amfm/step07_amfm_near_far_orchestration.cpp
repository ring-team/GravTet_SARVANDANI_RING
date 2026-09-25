// ============================================================================
// Adaptive Multilevel Fast Multipole (amfm) Workflow - Phase 4: Main Algorithm
// Step 4.1: Main Adaptive Multilevel Fast Multipole (amfm) Core Implementation
// ============================================================================
// This file implements the AMFMCore class methods, combining near-field and
// far-field calculations to perform efficient large-scale gravity forward modeling.
// ============================================================================

#include "step07_amfm_near_far_orchestration.h"
#include "step05_amfm_near_field.h"
#include "step06_amfm_far_field.h"
#include "step02_amfm_utils.h"
#include <algorithm>
#include <map>
#include <memory>
#include <cmath>

// ============================================================================
// SECTION 1: Constructor and Step 5.1 params
// ============================================================================

AMFMCore::AMFMCore(const AMFMAlgorithmParams& params)
    : params_(params),
      critical_distance_factor_(2.5)
{
}

AMFMCore::AMFMCore(double critical_distance_factor,
                   int max_depth,
                   int max_sources_per_node)
    : critical_distance_factor_(critical_distance_factor)
{
    params_.P = 3;             // 3 = fast (16 coeffs); trade accuracy for speed vs Newton
    params_.lambda_min = 10.0; // fewer far-field pairs = faster
    params_.max_depth = max_depth;
    params_.max_sources_per_node = max_sources_per_node;
    params_.max_positions_per_node = max_sources_per_node;
    params_.min_cell_size = 1.0;
}

// ============================================================================
// SECTION 2: Main Computation Functions
// ============================================================================

// Step 5.5: Full AMFM pipeline — build octrees → M2M → M2L+L2L → near+far → mGal (Eq. 29).
std::vector<double> AMFMCore::compute_gravity(
    const std::vector<AMFMSource>& sources,
    const std::vector<AMFMReceiver>& receivers) {

    if (sources.empty() || receivers.empty()) {
        return std::vector<double>(receivers.size(), 0.0);
    }

    AMFMOctrees trees = build_both_octrees(sources, receivers);
    if (!trees.source || !trees.observation) {
        return std::vector<double>(receivers.size(), 0.0);
    }

    run_upward_pass(trees.source.get());
    run_m2l_l2l(trees.observation.get(), trees.source.get());
    return evaluate_gravity_near_plus_far(receivers, trees.observation.get(), trees.source.get());
}

double AMFMCore::compute_gravity_at_receiver(
    const AMFMReceiver& receiver,
    const std::vector<AMFMSource>& sources,
    Octree* octree) {
    
    // Calculate critical distance for this receiver
    // This determines the boundary between near-field and far-field regions
    double critical_distance = calculate_critical_distance(receiver, sources);
    
    // Near-field: Direct calculation for nearby sources
    // Sums individual contributions from sources within critical_distance
    // This is accurate but computationally expensive for many sources
    double gz_near = AMFMNearField::compute_near_gravity(
        receiver, sources, critical_distance);
    
    // Far-field: Multipole approximation for distant sources
    // Uses hierarchical multipole moments from octree nodes beyond critical_distance
    // This is fast and accurate for distant sources
    // Pass both critical_distance (absolute) and factor (relative) to far-field
    double gz_far = AMFMFarField::compute_far_gravity(
        receiver, octree->get_root(), critical_distance, critical_distance_factor_);
    
    // Total gravity is the sum of near-field and far-field contributions
    // Note: The far-field calculation is designed to exclude sources already
    // handled by near-field, so there's no double-counting
    return gz_near + gz_far;
}

// ============================================================================
// SECTION 3: Private Helper Methods
// ============================================================================

std::unique_ptr<Octree> AMFMCore::build_octree(const std::vector<AMFMSource>& sources) {
    // Compute bounding box from all source positions
    BoundingBox bbox = AMFMUtils::compute_bbox_from_sources(sources);
    
    // Expand bounding box slightly to avoid edge issues
    // Sources near the boundary could cause problems during octree subdivision
    // Adding a 10% margin ensures all sources are well-contained
    double margin = bbox.size() * 0.1;
    bbox.min_corner.x -= margin;
    bbox.min_corner.y -= margin;
    bbox.min_corner.z -= margin;
    bbox.max_corner.x += margin;
    bbox.max_corner.y += margin;
    bbox.max_corner.z += margin;
    
    std::unique_ptr<Octree> octree(new Octree(
        bbox,
        params_.max_depth,
        params_.max_sources_per_node,
        params_.min_cell_size
    ));
    octree->build(sources);
    return octree;
}

std::unique_ptr<ObservationOctree> AMFMCore::build_observation_octree(
    const std::vector<AMFMReceiver>& receivers) {
    if (receivers.empty()) return std::unique_ptr<ObservationOctree>();
    std::vector<Point3D> positions;
    positions.reserve(receivers.size());
    for (const auto& r : receivers) positions.push_back(r.position);
    BoundingBox bbox = AMFMUtils::compute_bbox(positions);
    double margin = (bbox.size() > 1e-20) ? bbox.size() * 0.1 : 1.0;
    bbox.min_corner.x -= margin;
    bbox.min_corner.y -= margin;
    bbox.min_corner.z -= margin;
    bbox.max_corner.x += margin;
    bbox.max_corner.y += margin;
    bbox.max_corner.z += margin;
    std::unique_ptr<ObservationOctree> obs(new ObservationOctree(
        bbox,
        params_.max_depth,
        params_.max_positions_per_node,
        params_.min_cell_size
    ));
    obs->build(positions);
    return obs;
}

AMFMOctrees AMFMCore::build_both_octrees(
    const std::vector<AMFMSource>& sources,
    const std::vector<AMFMReceiver>& receivers) {
    AMFMOctrees result;
    if (!sources.empty()) result.source = build_octree(sources);
    if (!receivers.empty()) result.observation = build_observation_octree(receivers);
    return result;
}

void AMFMCore::run_upward_pass(Octree* source_tree) {
    if (!source_tree) return;
    AMFMFarField::compute_M2M_upward(source_tree->get_root(), params_.P);
}

namespace {
    void apply_m2l_at_observation_nodes(ObservationOctreeNode* node, int P) {
        if (!node) return;
        const int size = (P + 1) * (P + 1);
        node->local_phi.assign(size, std::complex<double>(0, 0));
        for (OctreeNode* src : node->far_field_source_cells)
            AMFMFarField::m2l_add_source_contribution(node, src, P);
        for (int i = 0; i < 8; i++)
            if (node->children[i])
                apply_m2l_at_observation_nodes(node->children[i], P);
    }
}

void AMFMCore::run_m2l_l2l(ObservationOctree* obs_tree, Octree* src_tree) {
    if (!obs_tree || !src_tree) return;
    ObservationOctreeNode* obs_root = obs_tree->get_root();
    if (!obs_root) return;

    AMFMFarField::build_admissible_lists(*obs_tree, *src_tree, params_.lambda_min);
    apply_m2l_at_observation_nodes(obs_root, params_.P);
    AMFMFarField::compute_L2L_downward(obs_root, params_.P);
    AMFMFarField::print_farfield_profile();
}

// Step 5.4: G = A_near M + A_far M; output in mGal (Eq. 29)
// Grouped path: build leaf_to_receivers once, then far + near use it (single tree walk).
std::vector<double> AMFMCore::evaluate_gravity_near_plus_far(
    const std::vector<AMFMReceiver>& receivers,
    ObservationOctree* obs_tree,
    Octree* src_tree) {
    if (!obs_tree || !src_tree || receivers.empty()) {
        return std::vector<double>(receivers.size(), 0.0);
    }
    ObservationOctreeNode* obs_root = obs_tree->get_root();
    if (!obs_root) return std::vector<double>(receivers.size(), 0.0);

    std::map<ObservationOctreeNode*, std::vector<size_t>> leaf_to_receivers;
    for (size_t i = 0; i < receivers.size(); ++i) {
        std::vector<ObservationOctreeNode*> leaves = obs_tree->find_leaf_nodes(receivers[i].position);
        ObservationOctreeNode* leaf = leaves.empty() ? obs_root : leaves[0];
        leaf_to_receivers[leaf].push_back(i);
    }

    std::vector<double> far_gz = AMFMFarField::evaluate_far_gravity_grouped(
        receivers, leaf_to_receivers, params_.P);
    std::vector<double> near_gz = AMFMNearField::compute_near_gravity_octree_grouped(
        receivers, leaf_to_receivers, *obs_tree, *src_tree, params_.lambda_min);
    std::vector<double> result(receivers.size());
    for (size_t i = 0; i < receivers.size(); ++i) {
        result[i] = AMFMUtils::to_mGal(near_gz[i] + far_gz[i]);
    }
    return result;
}

double AMFMCore::calculate_critical_distance(
    const AMFMReceiver& receiver,
    const std::vector<AMFMSource>& sources) {
    
    // Handle empty sources case
    if (sources.empty()) {
        return 1.0;  // Default critical distance
    }
    
    // Find average source volume
    // This helps estimate the typical source size
    double avg_volume = 0.0;
    for (const auto& src : sources) {
        avg_volume += src.volume;
    }
    avg_volume /= sources.size();
    
    // Estimate average source size from volume
    // Assuming sources are roughly cubic: size = volume^(1/3)
    double avg_source_size = std::pow(avg_volume, 1.0/3.0);
    
    // Critical distance = factor × average_source_size
    // This ensures that sources within a few source-lengths use direct calculation,
    // while more distant sources use multipole approximation
    return critical_distance_factor_ * avg_source_size;
}
