// step06_amfm_far_field.h: adaptive multilevel fast multipole (AMFM) gravity.
#ifndef AMFM_FARFIELD_H
#define AMFM_FARFIELD_H

// ============================================================================
// Adaptive Multilevel Fast Multipole (amfm) Workflow - Phase 3: Field Calculations
// Step 3.2: Far-Field Multipole Calculation
// ============================================================================
// This file provides functions for computing gravity from distant sources using
// multipole approximation, which treats groups of sources as single point masses
// at their center of mass.
// 
// Far-field calculation is used when sources are far from the receiver,
// where the multipole approximation (treating a group as a point mass) is
// accurate and computationally efficient. This avoids summing individual
// contributions from many distant sources.
// ============================================================================

#include "../../common/gravity_constants.hpp"
#include "step01_amfm_types.h"
#include "step03_amfm_far_field_two_octrees.h"
#include <vector>
#include <complex>
#include <map>

namespace AMFMFarField {

    /** Linear index for (n,m): 0<=n<=P, -n<=m<=n. Size (P+1)^2. */
    inline int multipole_index(int n, int m) { return n * n + n + m; }

    // ============================================================================
    // Step 3.2: Multipole moments at leaf (Eq. 8)
    // ============================================================================

    /**
     * Compute multipole moments M_nm^φ at a leaf (Eq. 8).
     * M_nm^φ = Σ_s mass_s × conj(R_nm(r_s − r′_c)) over sources in the cell.
     * Stores result in node->multipole_phi (resized to (P+1)^2).
     * @param leaf Leaf node with sources and expansion_center set
     * @param P Truncation order (n = 0..P, m = -n..n)
     */
    void compute_leaf_multipole_moments(OctreeNode* leaf, int P);

    // ============================================================================
    // Step 3.3: M2M — shift moments from child r′_c to parent r″_c (Eq. 10); upward pass
    // ============================================================================

    /**
     * Perform M2M upward pass on source octree: ensure leaf moments are computed,
     * then shift child moments to parent up to root. Root ends with moments consistent with all leaves.
     * @param root Root of source octree
     * @param P Truncation order
     */
    void compute_M2M_upward(OctreeNode* root, int P);

    // ============================================================================
    // Step 3.4: M2L — local coeffs at observation r_c from far-field source r″_c (Eq. 14)
    // ============================================================================

    /**
     * Add M2L contribution from one source cell to one observation cell (Eq. 14).
     * L_nm(r_c) += Σ_{n′,m′} (−1)^n S_{n+n′, m+m′}(r_c − r″_c) M_{n′m′}(r″_c).
     * Caller must ensure source is far-field (λ ≥ 5) and obs_node->local_phi resized if needed.
     */
    void m2l_add_source_contribution(ObservationOctreeNode* obs_node,
                                     const OctreeNode* source_node,
                                     int P);

    // ============================================================================
    // Step 3.5: L2L — shift local coeffs from parent r_c to child r^c_c (Eq. 17); downward pass
    // ============================================================================

    /**
     * Add L2L contribution from parent to child (Eq. 17).
     * child L_nm += Σ_{n′≥n, m′} R_{n′−n, m′−m}(r^c_c − r_c) × parent L_{n′m′}.
     * Vector = child->expansion_center − parent->expansion_center.
     * Caller must ensure parent->local_phi is set; child->local_phi is resized/accumulated.
     */
    void l2l_add_parent_to_child(ObservationOctreeNode* child,
                                 const ObservationOctreeNode* parent,
                                 int P);

    /**
     * L2L downward pass on observation octree: for each child add shifted parent L, then recurse.
     * Root must already have local_phi set (e.g. by M2L). After this, every node has parent L shifted down.
     */
    void compute_L2L_downward(ObservationOctreeNode* root, int P);

    // ============================================================================
    // Step 3.6: Admissible list — far-field source cells per observation cell (λ = D/S ≥ lambda_min)
    // ============================================================================

    /**
     * Build admissible lists: for each observation node, set far_field_source_cells to all
     * source cells with λ = D/S ≥ lambda_min (D = distance between cell centers, S = max cell size).
     * Dual-tree traversal: well-separated pairs are listed; near-field pairs are not.
     * Clears and fills ObservationOctreeNode::far_field_source_cells throughout the observation tree.
     */
    void build_admissible_lists(ObservationOctree& obs_tree,
                               Octree& src_tree,
                               double lambda_min = 5.0);

    /**
     * Print profiling stats (timers and per-level list sizes) to stdout.
     * Only prints when environment variable AMFM_PROFILE is set (e.g. AMFM_PROFILE=1).
     * Call after run_m2l_l2l to inspect where time is spent.
     */
    void print_farfield_profile();

    /**
     * Compute λ = D/S for one (observation cell, source cell) pair.
     * D = distance(obs->expansion_center, src->expansion_center), S = max(obs_size, src_size).
     */
    double admissible_lambda(ObservationOctreeNode* obs_node, OctreeNode* src_node);

    // ============================================================================
    // Step 4.3: Far-field at receivers (Eqs. 15, 18) — φ_far, g_far from L_nm at leaf center
    // ============================================================================

    /**
     * Far-field potential at point r using local coeffs at observation leaf (Eq. 15).
     * φ_far(r) = G Re(Σ_{n,m} R_nm(r − r^c_c) L_nm). Assumes leaf->local_phi is set (M2L+L2L).
     */
    double potential_far_at_point(const Point3D& r, ObservationOctreeNode* leaf, int P);

    /**
     * Far-field gravity vector at point r (Eq. 18). g_far = G Re(Σ_{n,m} ∇R_nm(r − r^c_c) L_nm).
     * Output gx, gy, gz in m/s² (vertical positive downward).
     */
    void gravity_far_at_point(const Point3D& r, ObservationOctreeNode* leaf, int P,
                              double& gx, double& gy, double& gz);

    /**
     * Vertical component of far-field gravity at r (convenience).
     */
    double gravity_z_far_at_point(const Point3D& r, ObservationOctreeNode* leaf, int P);

    /**
     * Compute far-field gravity at all receivers. For each receiver, find observation leaf
     * containing it and evaluate g_far using that leaf's local_phi. Call after M2L + L2L
     * so every leaf has local_phi set.
     * @return Vector of vertical gravity (m/s²) per receiver — A_far * M (far part only).
     */
    std::vector<double> evaluate_far_gravity_at_receivers(
        const std::vector<AMFMReceiver>& receivers,
        ObservationOctree& obs_tree,
        int P);

    /** Far-field at receivers using pre-grouped leaf->receiver indices (avoids repeated find_leaf). */
    std::vector<double> evaluate_far_gravity_grouped(
        const std::vector<AMFMReceiver>& receivers,
        const std::map<ObservationOctreeNode*, std::vector<size_t>>& leaf_to_receivers,
        int P);

    // Same G as near-field (`gravity/common/gravity_constants.hpp`).
    constexpr double G = gravity::physical::GRAVITATIONAL_CONSTANT;
    
    // ============================================================================
    // SECTION 1: Far-Field Distance Criteria (legacy point-mass path)
    // ============================================================================
    
    /**
     * Check if an octree node is far enough from receiver to use multipole approximation
     * 
     * The multipole approximation is accurate when the distance to the node
     * is much larger than the node's size. This function implements the
     * criterion: distance > critical_distance × node_size
     * 
     * This ensures that the node appears as a point mass from the receiver's
     * perspective, making the multipole approximation valid.
     * 
     * @param receiver Observation point where gravity is calculated
     * @param node Octree node to check
     * @param critical_distance_factor Factor for determining far-field threshold (typically 2.0-3.0)
     * @return True if node is far enough to use multipole, false otherwise
     */
    bool is_far_enough(const AMFMReceiver& receiver,
                      OctreeNode* node,
                      double critical_distance_factor);
    
    // ============================================================================
    // SECTION 2: Multipole Approximation
    // ============================================================================
    
    /**
     * Compute gravity using multipole approximation (point mass at center of mass)
     * 
     * Treats the entire octree node (and all sources within it) as a single
     * point mass located at the node's center of mass. This is accurate when
     * the node is far from the receiver.
     * 
     * Formula: gz = G × total_mass × dz / r³
     * where:
     * - total_mass is the sum of all source masses in the node/subtree
     * - center_of_mass is the weighted average position of all sources
     * - dz is the vertical distance from receiver to center_of_mass
     * - r is the distance from receiver to center_of_mass
     * 
     * @param receiver Observation point where gravity is calculated
     * @param node Octree node to approximate as point mass
     * @return Vertical component of gravity in m/s² (SI units)
     */
    double multipole_approximation(const AMFMReceiver& receiver,
                                  OctreeNode* node);
    
    // ============================================================================
    // SECTION 3: Recursive Far-Field Calculation
    // ============================================================================
    
    /**
     * Calculate total gravity from far-field sources using recursive octree traversal
     * 
     * Recursively traverses the octree, applying multipole approximation to nodes
     * that are far enough, and descending into children for nodes that are too close.
     * 
     * Algorithm:
     * 1. Check if node is entirely beyond critical_distance (near-field boundary)
     * 2. If yes and far enough for multipole: use multipole approximation
     * 3. If yes but too close for multipole: descend into children
     * 4. If no (node overlaps near-field): return 0 (handled by near-field)
     * 
     * This efficiently handles large numbers of distant sources by grouping them
     * into hierarchical multipole moments, while ensuring no double-counting with near-field.
     * 
     * @param receiver Observation point where gravity is calculated
     * @param node Current octree node being processed (start with root)
     * @param critical_distance Absolute distance threshold for near-field (meters)
     * @param critical_distance_factor Factor for multipole criterion (typically 2.0-3.0)
     * @return Total vertical component of gravity from far-field sources in m/s²
     */
    double compute_far_gravity(const AMFMReceiver& receiver,
                               OctreeNode* node,
                               double critical_distance,
                               double critical_distance_factor);
}

#endif // AMFM_FARFIELD_H
