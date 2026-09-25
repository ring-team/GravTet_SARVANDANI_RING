// step02_amfm_utils.h: adaptive multilevel fast multipole (AMFM) gravity.
#ifndef AMFM_UTILS_H
#define AMFM_UTILS_H

// ============================================================================
// Adaptive Multilevel Fast Multipole (amfm) Workflow - Phase 1: Data Structures
// Step 1.5: Utility helpers (distance, box ops, unit conversion)
// ============================================================================
// This file provides helper functions for:
// - Unit conversions (SI to mGal)
// - Geometric distance calculations
// - Bounding box operations and computations
// - Octree spatial subdivision (splitting into 8 octants)
// These utilities support octree construction and spatial queries.
// ============================================================================

#include "step01_amfm_types.h"
#include <vector>
#include <array>

// ============================================================================
// Adaptive Multilevel Fast Multipole (amfm) Utility Functions
// ============================================================================
// This namespace contains helper functions for geometric calculations,
// unit conversions, and spatial operations used throughout the adaptive multilevel fast multipole (amfm) algorithm.
// ============================================================================

namespace AMFMUtils {

// ============================================================================
// SECTION 1: Unit Conversion Functions
// ============================================================================

/**
 * Convert gravity from SI units (m/s²) to milligals (mGal)
 * 
 * Gravity calculations are typically performed in SI units, but geophysical
 * measurements are commonly reported in milligals for convenience.
 * 
 * Conversion: 1 mGal = 10^-5 m/s² = 0.00001 m/s²
 * 
 * @param g_si Gravity value in m/s²
 * @return Gravity value in mGal
 */
double to_mGal(double g_si);

// ============================================================================
// SECTION 2: Geometric Distance Functions
// ============================================================================

/**
 * Calculate Euclidean distance between two 3D points
 * 
 * This is a wrapper around Point3D::distance() for consistency with
 * the utility function namespace. Used extensively in adaptive multilevel fast multipole (amfm) for:
 * - Determining near-field vs far-field interactions
 * - Computing multipole expansion distances
 * - Spatial query optimizations
 * 
 * @param p1 First point
 * @param p2 Second point
 * @return Distance in meters
 */
double distance(const Point3D& p1, const Point3D& p2);

// ============================================================================
// SECTION 3: Bounding Box Operations
// ============================================================================

/**
 * Check if a point is inside a bounding box
 * 
 * Wrapper around BoundingBox::contains() for consistency.
 * Used to determine which octree node contains a given source or receiver.
 * 
 * @param p Point to test
 * @param bbox Bounding box to test against
 * @return True if point is inside (or on boundary), false otherwise
 */
bool point_in_bbox(const Point3D& p, const BoundingBox& bbox);

/**
 * Compute bounding box from a collection of 3D points
 * 
 * Finds the axis-aligned bounding box (AABB) that contains all points.
 * This is the first step in octree construction - determining the root
 * node's spatial extent.
 * 
 * Algorithm:
 * 1. Find minimum and maximum x, y, z coordinates across all points
 * 2. Create BoundingBox with these extents
 * 
 * @param points Vector of 3D points
 * @return BoundingBox containing all points (or empty box if points is empty)
 */
BoundingBox compute_bbox(const std::vector<Point3D>& points);

/**
 * Compute bounding box from a collection of adaptive multilevel fast multipole (amfm) sources
 * 
 * Extracts positions from sources and computes their bounding box.
 * This is used during octree construction to determine spatial extent
 * of source distributions.
 * 
 * @param sources Vector of adaptive multilevel fast multipole (amfm) sources
 * @return BoundingBox containing all source positions
 */
BoundingBox compute_bbox_from_sources(const std::vector<AMFMSource>& sources);

// ============================================================================
// SECTION 4: Octree Spatial Subdivision
// ============================================================================

/**
 * Split a bounding box into 8 octants (sub-boxes)
 * 
 * This is the core operation for octree construction. Each bounding box
 * is divided into 8 equal-sized sub-boxes, one for each octant of 3D space.
 * 
 * Octant ordering convention:
 * - Octant 0: -x, -y, -z (bottom-left-back)
 * - Octant 1: +x, -y, -z (bottom-right-back)
 * - Octant 2: -x, +y, -z (bottom-left-front)
 * - Octant 3: +x, +y, -z (bottom-right-front)
 * - Octant 4: -x, -y, +z (top-left-back)
 * - Octant 5: +x, -y, +z (top-right-back)
 * - Octant 6: -x, +y, +z (top-left-front)
 * - Octant 7: +x, +y, +z (top-right-front)
 * 
 * The center point of the input bounding box becomes the division point.
 * Each octant is a new BoundingBox with half the size in each dimension.
 * 
 * @param bbox Bounding box to subdivide
 * @return Array of 8 BoundingBox objects, one per octant
 */
std::array<BoundingBox, 8> split_octants(const BoundingBox& bbox);

} // namespace AMFMUtils

#endif // AMFM_UTILS_H
