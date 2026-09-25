// step05_amfm_near_field.h: adaptive multilevel fast multipole (AMFM) gravity.
#ifndef AMFM_NEARFIELD_H
#define AMFM_NEARFIELD_H

// ============================================================================
// Adaptive Multilevel Fast Multipole (amfm) Workflow - Phase 4: Near-Field and Far-Field
// Step 4.1: Closed-form tetrahedron (Eqs. 24–28, Appendix A); singularity-free.
// ============================================================================
// This file provides functions for computing gravity from nearby sources using
// direct summation (point masses) and closed-form tetrahedral formulas.
// ============================================================================

#include "../../common/gravity_constants.hpp"
#include "step01_amfm_types.h"
#include <vector>
#include <map>

// Forward declarations for Step 4.2 (near-field loop)
class ObservationOctree;
class Octree;
struct ObservationOctreeNode;

namespace AMFMNearField {
    // Gravitational constant in SI units (m³ kg⁻¹ s⁻²); see `gravity/common/gravity_constants.hpp`
    constexpr double G = gravity::physical::GRAVITATIONAL_CONSTANT;
    
    // ============================================================================
    // SECTION 1: Single Source Gravity Calculation
    // ============================================================================
    
    /**
     * Calculate vertical component of gravity from a single source point
     * 
     * Uses Newton's law of universal gravitation to compute the vertical
     * (z-direction) component of gravitational acceleration at a receiver point
     * due to a point mass source.
     * 
     * Formula: gz = G × mass × dz / r³
     * where:
     * - G is the gravitational constant
     * - mass is the source mass (density × volume)
     * - dz is the vertical distance component (receiver.z - source.z)
     * - r is the Euclidean distance between receiver and source
     * 
     * @param receiver Observation point where gravity is calculated
     * @param source Point mass source contributing to gravity field
     * @return Vertical component of gravity in m/s² (SI units)
     */
    double compute_gravity_from_source(const AMFMReceiver& receiver,
                                      const AMFMSource& source);
    
    // ============================================================================
    // SECTION 2: Near-Field Gravity Calculation
    // ============================================================================
    
    /**
     * Calculate total gravity at receiver from nearby sources (direct summation)
     * 
     * Iterates through all sources and sums the gravitational contribution
     * from sources within the critical distance. Sources beyond the critical
     * distance are handled by far-field multipole approximation.
     * 
     * The critical distance determines the boundary between near-field
     * (direct calculation) and far-field (multipole approximation) regions.
     * 
     * @param receiver Observation point where gravity is calculated
     * @param sources Vector of all source points
     * @param critical_distance Maximum distance for near-field calculation (meters)
     *                          Sources within this distance use direct calculation
     * @return Total vertical component of gravity in m/s² (SI units)
     */
    double compute_near_gravity(const AMFMReceiver& receiver,
                                const std::vector<AMFMSource>& sources,
                                double critical_distance);

    // ============================================================================
    // Step 4.1: Closed-form tetrahedron — φ, g (Eqs. 24–28, Appendix A); singularity-free
    // ============================================================================

    /** Tetrahedron: 4 vertices v[0]..v[3], constant density ρ. Volume from scalar triple product. */
    struct TetrahedronSource {
        Point3D v[4];
        double density;
        TetrahedronSource() : density(0) {}
    };

    /**
     * Gravitational potential at observation r from a homogeneous tetrahedron (Eq. 24).
     * φ = G ρ ∭_T (1/R) dV; reduced to face integrals (solid-angle formulation); singularity-free.
     * @return Potential in m²/s² (SI)
     */
    double potential_tetrahedron(const Point3D& observation, const TetrahedronSource& tet);

    /**
     * Gravity vector at observation r from a homogeneous tetrahedron (Eq. 24, gradient of potential).
     * g = -∇φ; vertical component gz positive downward (same sign convention as point-mass).
     * @param observation Observation point
     * @param tet Tetrahedron (4 vertices, density)
     * @param gx, gy, gz Output: gravity vector components in m/s² (SI)
     */
    void gravity_tetrahedron(const Point3D& observation, const TetrahedronSource& tet,
                             double& gx, double& gy, double& gz);

    /** Vertical component only (convenience for tests). */
    double gravity_z_tetrahedron(const Point3D& observation, const TetrahedronSource& tet);

    // ============================================================================
    // Step 4.2: Near-field loop — for each observation, collect near-field sources; sum with closed form
    // ============================================================================

    /**
     * Compute near-field gravity at all receivers using the octree admissible criterion.
     * For each receiver: find observation leaf containing it; collect sources from source cells
     * that are NOT in that leaf's far-field list; sum contributions (point mass).
     * Requires run_m2l_l2l to have been called first so admissible lists are already built.
     * @return Vector of vertical gravity (m/s²) per receiver — i.e. A_near * M (near part only).
     */
    std::vector<double> compute_near_gravity_octree(
        const std::vector<AMFMReceiver>& receivers,
        ObservationOctree& obs_tree,
        Octree& src_tree,
        double lambda_min = 5.0);

    /** Near-field using pre-grouped leaf->receiver indices (same grouping as far for single tree walk). */
    std::vector<double> compute_near_gravity_octree_grouped(
        const std::vector<AMFMReceiver>& receivers,
        const std::map<ObservationOctreeNode*, std::vector<size_t>>& leaf_to_receivers,
        ObservationOctree& obs_tree,
        Octree& src_tree,
        double lambda_min = 5.0);
}

#endif // AMFM_NEARFIELD_H
