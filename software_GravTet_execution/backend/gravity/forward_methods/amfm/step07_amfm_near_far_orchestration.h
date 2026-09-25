// step07_amfm_near_far_orchestration.h: adaptive multilevel fast multipole (AMFM) gravity.
#ifndef AMFM_CORE_H
#define AMFM_CORE_H

// ============================================================================
// Adaptive Multilevel Fast Multipole (amfm) Workflow - Phase 5: Main Algorithm
// Step 5.1: Build both octrees; set params (P, λ, max_depth, max_per_cell).
// ============================================================================
// This file defines the AMFMCore class and AMFMParams, which combine near-field
// and far-field calculations for the full AMFM algorithm.
// ============================================================================

#include "step01_amfm_types.h"
#include "step03_amfm_far_field_two_octrees.h"
#include <vector>
#include <memory>

// ============================================================================
// Step 5.1: Algorithm parameters (P, λ, max_depth, max_per_cell)
// ============================================================================
// Note: AMFMParams in step08_amfm_ffi.h is the C FFI input struct (arrays + algo params).
// AMFMAlgorithmParams here is the C++ core params (P, λ, tree limits) for building octrees.
// ============================================================================

/** Algorithm parameters for octree build and passes: P, λ, max_depth, max_per_cell. */
struct AMFMAlgorithmParams {
    int P;                        ///< Truncation order (e.g. 7); n,m in [0,P], [-n,n]
    double lambda_min;            ///< Admissible factor λ = D/S ≥ this for far-field (e.g. 5.0)
    int max_depth;                ///< Maximum octree depth
    int max_sources_per_node;     ///< Max sources per cell before subdividing (source octree)
    int max_positions_per_node;   ///< Max positions per cell before subdividing (observation octree)
    double min_cell_size;        ///< Minimum cell size (m) before stopping subdivision

    AMFMAlgorithmParams()
        : P(7),
          lambda_min(5.0),
          max_depth(10),
          max_sources_per_node(10),
          max_positions_per_node(10),
          min_cell_size(1.0) {}
};

/** Result of building both octrees (Step 5.1). */
struct AMFMOctrees {
    std::unique_ptr<Octree> source;
    std::unique_ptr<ObservationOctree> observation;
};

/**
 * AMFMCore - Main class for adaptive multilevel fast multipole (amfm) gravity forward modeling
 * 
 * Orchestrates the full algorithm: build both octrees (Step 5.1), upward pass,
 * M2L+L2L, evaluate far-field and near-field, sum (Eq. 29).
 */
class AMFMCore {
public:
    // ============================================================================
    // SECTION 1: Constructor and params
    // ============================================================================
    
    /** Constructor with full params (Step 5.1). Params stored for build and passes. */
    explicit AMFMCore(const AMFMAlgorithmParams& params = AMFMAlgorithmParams());

    /**
     * Legacy constructor: critical_distance_factor, max_depth, max_sources_per_node.
     * Builds AMFMParams with P=7, lambda_min=5.0, max_positions_per_node=max_sources_per_node.
     */
    AMFMCore(double critical_distance_factor,
             int max_depth,
             int max_sources_per_node);

    /** Stored algorithm parameters (P, λ, max_depth, max_per_cell). */
    const AMFMAlgorithmParams& get_params() const { return params_; }
    void set_params(const AMFMAlgorithmParams& params) { params_ = params; }
    
    // ============================================================================
    // Step 5.1: Build both octrees from sources and receivers
    // ============================================================================

    /**
     * Build observation octree from receiver positions (same logic as source octree).
     * Uses params_.max_depth, params_.max_positions_per_node, params_.min_cell_size.
     */
    std::unique_ptr<ObservationOctree> build_observation_octree(
        const std::vector<AMFMReceiver>& receivers);

    /**
     * Build both octrees: source octree from sources, observation octree from receiver positions.
     * Uses stored params_ (P, λ, max_depth, max_sources_per_node, max_positions_per_node, min_cell_size).
     * @return AMFMOctrees containing both trees (or empty if inputs empty).
     */
    AMFMOctrees build_both_octrees(
        const std::vector<AMFMSource>& sources,
        const std::vector<AMFMReceiver>& receivers);

    // ============================================================================
    // Step 5.2: Upward pass — multipole at leaves (Step 3.2), then M2M (Step 3.3) to root
    // ============================================================================

    /**
     * Run upward pass on source octree: compute multipole moments at leaves (Eq. 8),
     * then M2M (Eq. 10) from children to parent up to root. Uses params_.P.
     * After this, root moments are consistent with all sources.
     * @param source_tree Source octree (from build_octree or build_both_octrees).
     */
    void run_upward_pass(Octree* source_tree);

    // ============================================================================
    // Step 5.3: M2L + L2L — for each observation cell apply M2L from far source cells, then L2L downward
    // ============================================================================

    /**
     * Run M2L + L2L on observation octree: build admissible lists, then for each
     * observation node add M2L from its far_field_source_cells, then L2L downward.
     * Uses params_.P and params_.lambda_min. After this, every observation leaf has local_phi set.
     * @param obs_tree Observation octree (from build_both_octrees).
     * @param src_tree Source octree (from build_both_octrees; must have run_upward_pass already).
     */
    void run_m2l_l2l(ObservationOctree* obs_tree, Octree* src_tree);

    // ============================================================================
    // Step 5.4: Evaluate far-field (Step 4.3), then near-field (Step 4.2); sum and convert (Eq. 29)
    // ============================================================================

    /**
     * Evaluate gravity at all receivers: G = A_near M + A_far M (Eq. 29).
     * Far-field from local expansion (Step 4.3), near-field from octree loop (Step 4.2),
     * then sum and convert to mGal. Assumes run_upward_pass and run_m2l_l2l have been called.
     * @param receivers Receiver positions
     * @param obs_tree Observation octree (with local_phi set)
     * @param src_tree Source octree (with multipole_phi set)
     * @return Vector of vertical gravity in mGal, one per receiver
     */
    std::vector<double> evaluate_gravity_near_plus_far(
        const std::vector<AMFMReceiver>& receivers,
        ObservationOctree* obs_tree,
        Octree* src_tree);

    // ============================================================================
    // SECTION 2: Main Computation Functions
    // ============================================================================
    
    /**
     * Compute gravity for all receivers (Step 5.5 — single API).
     *
     * Full two-tree AMFM pipeline: build both octrees → upward pass (M2M) →
     * M2L + L2L → evaluate far-field + near-field at receivers → sum and convert to mGal (Eq. 29).
     * Params (P, λ, max_depth, etc.) are taken from the core's AMFMAlgorithmParams (set at construction).
     *
     * @param sources Vector of source points (discretized geological model)
     * @param receivers Vector of receiver points (observation locations)
     * @return Vector of vertical gravity in mGal, one per receiver
     */
    std::vector<double> compute_gravity(
        const std::vector<AMFMSource>& sources,
        const std::vector<AMFMReceiver>& receivers);
    
    /**
     * Compute gravity at a single receiver
     * 
     * Computes gravity at one receiver by combining:
     * - Near-field: Direct summation from sources within critical distance
     * - Far-field: Multipole approximation from octree nodes beyond critical distance
     * 
     * @param receiver Observation point where gravity is calculated
     * @param sources Vector of all source points
     * @param octree Pre-built octree structure (must be built from same sources)
     * @return Gravity value in m/s² (SI units) - will be converted to mGal by caller
     */
    double compute_gravity_at_receiver(
        const AMFMReceiver& receiver,
        const std::vector<AMFMSource>& sources,
        Octree* octree);
    
private:
    // ============================================================================
    // SECTION 3: Private Members
    // ============================================================================
    
    AMFMAlgorithmParams params_;         // Step 5.1: P, λ, max_depth, max_per_cell
    double critical_distance_factor_;    // Legacy: for compute_gravity_at_receiver far-field
    
    // ============================================================================
    // SECTION 4: Private Helper Methods
    // ============================================================================
    
    /**
     * Build source octree from sources
     * 
     * Creates and builds the adaptive octree structure from source points.
     * The octree is used for efficient far-field multipole calculations.
     * 
     * The bounding box is expanded slightly (10% margin) to avoid edge issues
     * with sources near the boundary.
     * 
     * @param sources Vector of source points
     * @return Unique pointer to built Octree
     */
    std::unique_ptr<Octree> build_octree(const std::vector<AMFMSource>& sources);
    
    /**
     * Calculate critical distance for near-field/far-field boundary
     * 
     * The critical distance determines which sources use direct calculation
     * (near-field) vs multipole approximation (far-field).
     * 
     * Critical distance is computed as: factor × average_source_size
     * where source size is estimated from volume (assuming cubic sources).
     * 
     * @param receiver Observation point (currently not used, but kept for
     *                 potential receiver-specific adaptations)
     * @param sources Vector of source points
     * @return Critical distance in meters
     */
    double calculate_critical_distance(const AMFMReceiver& receiver,
                                      const std::vector<AMFMSource>& sources);
};

#endif // AMFM_CORE_H
