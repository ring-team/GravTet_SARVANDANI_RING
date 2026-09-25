// ============================================================================
// Adaptive Multilevel Fast Multipole (amfm) Workflow - Phase 1: Data Structures
// Step 1.5: Utility helpers implementation
// ============================================================================
// This file implements the utility functions declared in step02_amfm_utils.h:
// - Unit conversions (SI to mGal)
// - Geometric distance calculations
// - Bounding box operations and computations
// - Octree spatial subdivision (splitting into 8 octants)
// ============================================================================

#include "step02_amfm_utils.h"
#include <cmath>
#include <algorithm>
#include <limits>

namespace AMFMUtils {

// ============================================================================
// SECTION 1: Unit Conversion (m/s² → mGal)
// ============================================================================

double to_mGal(double g_si) {
    // Conversion factor: 1 mGal = 10^-5 m/s²
    // Multiply by 1e5 to convert from m/s² to mGal
    return g_si * 1e5;
}

// ============================================================================
// SECTION 2: Geometric distance
// ============================================================================

double distance(const Point3D& p1, const Point3D& p2) {
    // Delegate to Point3D's built-in distance method
    // This wrapper provides consistency with the utility namespace
    return p1.distance(p2);
}

// ============================================================================
// SECTION 3: Bounding box operations
// ============================================================================

bool point_in_bbox(const Point3D& p, const BoundingBox& bbox) {
    // Delegate to BoundingBox's built-in contains method
    // This wrapper provides consistency with the utility namespace
    return bbox.contains(p);
}

BoundingBox compute_bbox(const std::vector<Point3D>& points) {
    // Handle empty input: return a degenerate bounding box at origin
    if (points.empty()) {
        return BoundingBox{Point3D(0, 0, 0), Point3D(0, 0, 0)};
    }
    //////////////////////////////////////////////
    // Initialize min/max values to extreme limits
    // We'll find the actual min/max by iterating through all points
    double min_x = std::numeric_limits<double>::max();
    double min_y = std::numeric_limits<double>::max();
    double min_z = std::numeric_limits<double>::max();
    double max_x = std::numeric_limits<double>::lowest();
    double max_y = std::numeric_limits<double>::lowest();
    double max_z = std::numeric_limits<double>::lowest();
    
    // Iterate through all points to find bounding extents
    for (const auto& p : points) {
        min_x = std::min(min_x, p.x);
        min_y = std::min(min_y, p.y);
        min_z = std::min(min_z, p.z);
        max_x = std::max(max_x, p.x);
        max_y = std::max(max_y, p.y);
        max_z = std::max(max_z, p.z);
    }
    
    // Construct and return bounding box with computed extents
    return BoundingBox{
        Point3D(min_x, min_y, min_z),  // min_corner
        Point3D(max_x, max_y, max_z)   // max_corner
    };
}
BoundingBox compute_bbox_from_sources(const std::vector<AMFMSource>& sources) {

    
    // Extract positions from sources into a vector of points
    std::vector<Point3D> points;
    points.reserve(sources.size());  // Pre-allocate for efficiency
    
    for (const auto& src : sources) {
        points.push_back(src.position);
    }
    
    // Delegate to compute_bbox() which handles the actual computation
    return compute_bbox(points);
}

// ============================================================================
// SECTION 4: Octree spatial subdivision (split into 8 octants)
// ============================================================================

std::array<BoundingBox, 8> split_octants(const BoundingBox& bbox) {
    // Calculate the center point - this is where we split the box
    Point3D center = bbox.center();
    
    // Get the original min and max corners for reference
    Point3D min = bbox.min_corner;
    Point3D max = bbox.max_corner;
    
    // Array to hold the 8 resulting octant bounding boxes
    std::array<BoundingBox, 8> octants;
    // guide: for + axis like +x we move from center to max and for - axis like -z we move from min to center
    //Each octant is just a smaller bounding box inside the parent box
    // Octant 0: -x, -y, -z (bottom-left-back)
    // From min corner to center
    octants[0] = BoundingBox{
        Point3D(min.x, min.y, min.z),      // min corner
        Point3D(center.x, center.y, center.z) // max corner
    };
    
    // Octant 1: +x, -y, -z (bottom-right-back)
    // X from center to max, Y and Z from min to center
    octants[1] = BoundingBox{
        Point3D(center.x, min.y, min.z),
        Point3D(max.x, center.y, center.z)
    };
    
    // Octant 2: -x, +y, -z (bottom-left-front)
    // X from min to center, Y from center to max, Z from min to center
    octants[2] = BoundingBox{
        Point3D(min.x, center.y, min.z),
        Point3D(center.x, max.y, center.z)
    };
    
    // Octant 3: +x, +y, -z (bottom-right-front)
    // X and Y from center to max, Z from min to center
    octants[3] = BoundingBox{
        Point3D(center.x, center.y, min.z),
        Point3D(max.x, max.y, center.z)
    };
    
    // Octant 4: -x, -y, +z (top-left-back)
    // X and Y from min to center, Z from center to max
    octants[4] = BoundingBox{
        Point3D(min.x, min.y, center.z),
        Point3D(center.x, center.y, max.z)
    };
    
    // Octant 5: +x, -y, +z (top-right-back)
    // X from center to max, Y from min to center, Z from center to max
    octants[5] = BoundingBox{
        Point3D(center.x, min.y, center.z),
        Point3D(max.x, center.y, max.z)
    };
    
    // Octant 6: -x, +y, +z (top-left-front)
    // X from min to center, Y and Z from center to max
    octants[6] = BoundingBox{
        Point3D(min.x, center.y, center.z),
        Point3D(center.x, max.y, max.z)
    };
    
    // Octant 7: +x, +y, +z (top-right-front)
    // From center to max corner
    octants[7] = BoundingBox{
        Point3D(center.x, center.y, center.z), // min corner
        Point3D(max.x, max.y, max.z)           // max corner
    };
    
    return octants;
}

} // namespace AMFMUtils
