// step01_amfm_types.h: adaptive multilevel fast multipole (AMFM) gravity.
#ifndef AMFM_TYPES_H
#define AMFM_TYPES_H

// ============================================================================
// Adaptive Multilevel Fast Multipole (amfm) Workflow - Phase 1: Data Structures
// Step 1.1: Core Data Structure Definitions
// ============================================================================
// This file defines the fundamental data types for the adaptive multilevel fast multipole (amfm) algorithm:
// - Point3D: 3D spatial coordinates
// - AMFMSource: Point mass elements (discretized geological model)
// - AMFMReceiver: Observation points where gravity is calculated
// - BoundingBox: Axis-aligned bounding boxes for spatial queries
// - OctreeNode: Hierarchical octree structure for adaptive refinement
// ============================================================================

#include <vector>
#include <array>
#include <cmath>
#include <complex>
#include <algorithm>

// ============================================================================
// SECTION 1: Basic 3D Geometry Types
// ============================================================================

/**
 * Point3D - Represents a point in 3D space (x, y, z)
 *
 * Purpose:
 * - Stores spatial coordinates of sources, receivers, or any point in the model
 * - Provides a simple way to calculate distances between points
 */
 struct Point3D {

    // --- Variables (coordinates in 3D space) ---
    double x;  // X-coordinate of the point
    double y;  // Y-coordinate of the point
    double z;  // Z-coordinate of the point

    // --- Constructors ---

    /**
     * Default constructor
     * - Creates a point at the origin (0, 0, 0)
     *
     * Example:
     *   Point3D p;
     *   // p.x = 0, p.y = 0, p.z = 0
     */
    Point3D() : x(0), y(0), z(0) {}

    /**
     * Parameterized constructor
     * - Creates a point at a specific location (x_, y_, z_)
     *
     * Example:
     *   Point3D p(10, 20, 5);
     *   // p.x = 10, p.y = 20, p.z = 5
     */
    Point3D(double x_, double y_, double z_)
        : x(x_), y(y_), z(z_) {}

    // --- Functions (operations on the variables) ---

    /**
     * distance
     * - Computes the Euclidean distance from this point to another point
     * - Uses the variables x, y, z of both points
     *
     * Formula:
     *   sqrt((x1 - x2)^2 + (y1 - y2)^2 + (z1 - z2)^2)
     *
     * Example:
     *   Point3D a(0, 0, 0);
     *   Point3D b(3, 4, 12);
     *   double d = a.distance(b); // d = 13
     */
    double distance(const Point3D& other) const {
        double dx = x - other.x;
        double dy = y - other.y;
        double dz = z - other.z;
        return std::sqrt(dx*dx + dy*dy + dz*dz);
    }
};


// ============================================================================
// SECTION 2: Source and Receiver Types (Paper: Eq. 2, 4; constant ρ per element)
// ============================================================================

/**
 * AMFMSource - One source element in the discretized domain (Ren et al. 2017).
 *
 * Paper: Ω is discretized into elements T_i (Eq. 4). "When the size of a tetrahedral
 * element is small enough, we can assume that the mass density ... is constant in
 * each element." The "first connection" is from each source element to the center
 * of the source elements (Section 3.2). So each element is represented by:
 *   - position: center of the element r' (meters, SI)
 *   - density:  ρ constant in the element (kg/m³)
 *   - volume:   element volume (m³)
 *   - mass:     ρ × volume (kg), used in gravity potential φ = G ∭ ρ/R dv.
 * Element type (tetrahedron, hexahedron, etc.) does not appear here; only
 * (position, density, volume) matter for the algorithm.
 */
struct AMFMSource {

    Point3D position;  // Center of the source element (m) — paper: "center of the source elements"
    double density;   // Density ρ in the element (kg/m³) — constant per element, Eq. 2
    double volume;    // Volume of the element (m³)

    AMFMSource() : position(), density(0), volume(0) {}

    AMFMSource(const Point3D& pos, double rho, double vol)
        : position(pos), density(rho), volume(vol) {}

    AMFMSource(double x, double y, double z, double rho, double vol)
        : position(x, y, z), density(rho), volume(vol) {}

    /** Mass = ρ × volume (kg). Paper Eq. 2: contribution to potential uses ρ dv. */
    double mass() const {
        return density * volume;
    }
};

/**
 * AMFMReceiver - Observation point r where gravity is computed (Ren et al. 2017).
 *
 * Paper: Eq. 2 defines φ(r), g(r), T_g(r) "at an observation point r". The
 * observation octree is built on observation sites (Section 3.2.2). Each
 * receiver is one observation site: position r (m), and the gravity result
 * (e.g. vertical component g_z in mGal) is stored here after the AMFM run.
 */
struct AMFMReceiver {

    Point3D position;      // Observation point r (m) — paper: "observation site"
    double gravity_value;  // Computed gravity at this point (e.g. g_z in mGal)

    AMFMReceiver() : position(), gravity_value(0) {}

    explicit AMFMReceiver(const Point3D& pos) : position(pos), gravity_value(0) {}

    AMFMReceiver(double x, double y, double z) : position(x, y, z), gravity_value(0) {}
};


// ============================================================================
// SECTION 3: BoundingBox (the main cube/box of sources, root node)
// ============================================================================

/**
 * BoundingBox - Axis-aligned 3D box (Ren et al. 2017, Section 3.2.2).
 *
 * Paper: "Set up a minimal axis-parallel cuboid which entirely encloses all
 * these center points. This axis-parallel cuboid is defined as the root cell
 * of the octree." Each octree cell is such a box; subdivision gives 8 children
 * with side lengths halved.
 *
 * Provides: min/max corners, center, size (max side length), and contains(p).
 */
struct BoundingBox {

    Point3D min_corner;  // Minimum corner (smallest x, y, z)
    Point3D max_corner;  // Maximum corner (largest x, y, z)

    BoundingBox() : min_corner(), max_corner() {}

    BoundingBox(const Point3D& min_pt, const Point3D& max_pt)
        : min_corner(min_pt), max_corner(max_pt) {}

    /** True if p is inside or on the boundary of this box (closed interval). */
    bool contains(const Point3D& p) const {
        return p.x >= min_corner.x && p.x <= max_corner.x &&
               p.y >= min_corner.y && p.y <= max_corner.y &&
               p.z >= min_corner.z && p.z <= max_corner.z;
    }

    /** Largest side length (paper: used for admissible criterion and subdivision). */
    double size() const {
        double dx = max_corner.x - min_corner.x;
        double dy = max_corner.y - min_corner.y;
        double dz = max_corner.z - min_corner.z;
        return std::max({dx, dy, dz});
    }

    /** Geometric center of the box (expansion center for octree cell). */
    Point3D center() const {
        return Point3D(
            (min_corner.x + max_corner.x) / 2.0,
            (min_corner.y + max_corner.y) / 2.0,
            (min_corner.z + max_corner.z) / 2.0
        );
    }
};

// ============================================================================
// SECTION 4: OctreeNode (node/cube/box in the octree)
// ============================================================================

/**
 * OctreeNode - Represents one cube/box/node in the octree hierarchy
 *
 * Purpose:
 * - Organizes sources spatially for fast adaptive multilevel fast multipole (amfm) calculations.
 * - Each cube/box/node may contain sources directly (leaf) or be subdivided into 8 smaller cube/box nodes (internal).
 *
 * Key ideas:
 * 1. Root node: the big cube/box containing all sources
 * 2. Internal nodes: subdivided into 8 child cube/box nodes (octants)
 * 3. Leaf nodes: contain actual sources → used for near-field calculations
 * 4. Internal nodes: aggregate sources → used for far-field multipole approximation
 *
 * Hierarchy example (simplified 2D slice view):
 * 
 * Root cube/box/node
 * ├─ Child cube/box/node 1
 * ├─ Child cube/box/node 2
 * └─ ... up to 8 children (octants)
 */
 struct OctreeNode {
    // --- Members ---

    BoundingBox bbox;                // Cube/box/node spatial extent
    std::vector<AMFMSource> sources; // Sources inside this cube/box/node (only for leaf nodes)
    std::array<OctreeNode*, 8> children; // 8 smaller cube/box nodes (octants) inside this node

    bool is_leaf;      // True if this cube/box/node is a leaf (contains sources directly)
    int level;         // Depth of this cube/box/node in the tree (root = 0)
    double total_mass; // Sum of all sources inside this cube/box/node and its subtree
    Point3D center_of_mass; // Center of mass of sources for multipole approximation
    Point3D expansion_center; // Cell centroid r′_c / r″_c for M2M/M2L (paper: expansion center)

    // Multipole moments M_nm^φ (Eq. 8) for far-field. Size (P+1)^2; index = n*n + n + m for 0<=n<=P, -n<=m<=n.
    // Only populated for leaves (Step 3.2); internal nodes filled by M2M (Step 3.3).
    std::vector<std::complex<double>> multipole_phi;

    // --- Constructor ---
    /**
     * OctreeNode()
     * - Initializes an empty leaf cube/box/node
     * - Level = 0, total_mass = 0
     * - All 8 child pointers initialized to nullptr (no subdivisions yet)
     *
     * Example:
     *   OctreeNode root;
     *   root.is_leaf = true
     *   root.children = {nullptr, nullptr, ..., nullptr} (8 times)
     */
    OctreeNode() 
        : is_leaf(true), 
          level(0), 
          total_mass(0.0) 
    {
        for (int i = 0; i < 8; i++) {
            children[i] = nullptr; // No child cube/box/node yet
        }
    }

    // --- Destructor ---
    /**
     * ~OctreeNode()
     * - Recursively deletes all child cube/box nodes
     * - Ensures entire subtree is cleaned up without memory leaks
     *
     * Example:
     *   If root has 8 children, each child’s destructor is called recursively
     *   until all leaf cube/box/nodes are deleted
     */
    ~OctreeNode() {
        for (int i = 0; i < 8; i++) {
            if (children[i]) {
                delete children[i]; // Recursively delete child cube/box/node
            }
        }
    }
};



#endif // AMFM_TYPES_H
