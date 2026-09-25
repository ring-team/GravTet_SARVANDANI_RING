// step03_amfm_far_field_two_octrees.h: adaptive multilevel fast multipole (AMFM) gravity.
#ifndef OCTREE_H
#define OCTREE_H

// ============================================================================
// Adaptive Multilevel Fast Multipole (amfm) Workflow - Phase 2: Octree Construction
// Step 2.1: Source octree. Step 2.2: Observation octree (independent, same logic).
// ============================================================================
// This file defines:
// - Octree: source octree (build from source centers; multipole moments).
// - ObservationOctreeNode / ObservationOctree: observation octree (build from
//   observation positions; independent of source octree; query cell for point, depth, parent/child).
// ============================================================================

#include "step01_amfm_types.h"
#include "step02_amfm_utils.h"
#include <vector>
#include <memory>
#include <array>
#include <complex>

/**
 * Octree - Hierarchical spatial data structure for adaptive multilevel fast multipole (amfm) algorithm
 * 
 * The octree recursively subdivides 3D space into 8 octants, creating a tree
 * structure where:
 * - Each node represents a region of 3D space (defined by a BoundingBox)
 * - Leaf nodes contain actual source points
 * - Internal nodes contain 8 child nodes (one per octant)
 * 
 * Adaptive refinement criteria:
 * - Subdivide if node contains more than max_sources_per_node_ sources
 * - Subdivide if current_depth < max_depth_
 * - Subdivide if cell_size > min_cell_size_
 * 
 * After construction, multipole moments are computed for all nodes to enable
 * fast far-field gravity calculations.
 */
class Octree {
public:
    /**
     * Constructor: Initialize octree with root bounding box and parameters
     * 
     * @param root_bbox Bounding box defining the spatial extent of the entire tree
     * @param max_depth Maximum depth of the tree (prevents excessive subdivision)
     * @param max_sources_per_node Maximum sources before subdividing a node
     * @param min_cell_size Minimum cell size before stopping subdivision (meters)
     */
    Octree(const BoundingBox& root_bbox, 
           int max_depth = 10,
           int max_sources_per_node = 10,
           double min_cell_size = 1.0);
    
    /**
     * Destructor: Recursively delete all nodes in the tree
     */
    ~Octree();
    
    // ============================================================================
    // SECTION 1: Tree Construction and Access
    // ============================================================================
    
    /**
     * Build the octree from a collection of sources
     * 
     * This is the main entry point for constructing the tree:
     * 1. Inserts all sources into the tree (recursively subdividing as needed)
     * 2. Computes multipole moments for all nodes
     * 
     * @param sources Vector of adaptive multilevel fast multipole (amfm) sources to insert into the tree
     */
    void build(const std::vector<AMFMSource>& sources);
    
    /**
     * Get the root node of the octree
     * 
     * @return Pointer to the root OctreeNode
     */
    OctreeNode* get_root() { return root_; }
    
    // ============================================================================
    // SECTION 2: Spatial Queries
    // ============================================================================
    
    /**
     * Find leaf node(s) containing a given point
     * 
     * Traverses the tree from root to find the leaf node that contains
     * the specified point. In a properly constructed octree, there should
     * be exactly one leaf node containing any point within the root bounding box.
     * 
     * @param point 3D point to search for
     * @return Vector of leaf nodes containing the point (typically one node)
     */
    std::vector<OctreeNode*> find_leaf_nodes(const Point3D& point);
    
    /**
     * Get all leaf nodes in the tree
     * 
     * Useful for iterating over all nodes that contain actual sources.
     * 
     * @return Vector of all leaf node pointers
     */
    std::vector<OctreeNode*> get_all_leaves();
    
    // ============================================================================
    // SECTION 3: Multipole Moment Computation
    // ============================================================================
    
    /**
     * Compute multipole moments for all nodes in the tree
     * 
     * Multipole moments (total_mass and center_of_mass) are computed for each
     * node to enable fast far-field gravity calculations. For leaf nodes,
     * moments are computed from sources. For internal nodes, moments are
     * computed by aggregating child node moments.
     * 
     * This is called automatically after build(), but can be called again
     * if sources are modified.
     */
    void compute_multipole_moments();
    
private:
    // ============================================================================
    // SECTION 4: Private Members
    // ============================================================================
    
    OctreeNode* root_;              // Root node of the octree
    int max_depth_;                  // Maximum tree depth
    int max_sources_per_node_;       // Max sources before subdivision
    double min_cell_size_;           // Minimum cell size (meters)
    
    // ============================================================================
    // SECTION 5: Private Helper Methods
    // ============================================================================
    
    /**
     * Recursively insert sources into a node
     * 
     * Filters sources that belong to this node's bounding box, then either:
     * - Subdivides the node if criteria are met and distributes sources to children
     * - Keeps sources in this node if it should remain a leaf
     * 
     * @param node Current node being processed
     * @param sources Sources to potentially insert (will be filtered by bbox)
     * @param current_depth Current depth in the tree (0 = root)
     */
    void insert_sources(OctreeNode* node, 
                       const std::vector<AMFMSource>& sources,
                       int current_depth);
    
    /**
     * Compute multipole moments for a single node (recursive)
     * 
     * For leaf nodes: computes moments from sources directly
     * For internal nodes: aggregates moments from children
     * 
     * @param node Node to compute moments for
     */
    void compute_node_moments(OctreeNode* node);
    
    /**
     * Recursively collect all leaf nodes
     * 
     * Helper function for get_all_leaves(). Traverses the tree and
     * collects pointers to all leaf nodes.
     * 
     * @param node Current node being processed
     * @param leaves Output vector to collect leaf node pointers
     */
    void collect_leaves(OctreeNode* node, std::vector<OctreeNode*>& leaves);
    
    /**
     * Recursively find leaf nodes containing a point
     * 
     * Helper function for find_leaf_nodes(). Traverses the tree to find
     * the leaf node(s) that contain the specified point.
     * 
     * @param node Current node being processed
     * @param point Point to search for
     * @param result Output vector to collect matching leaf node pointers
     */
    void find_leaf_nodes_recursive(OctreeNode* node, 
                                   const Point3D& point,
                                   std::vector<OctreeNode*>& result);
};

// ============================================================================
// Step 2.2: Observation octree (independent of source octree; same build logic)
// ============================================================================

/**
 * ObservationOctreeNode - One node in the observation octree (observation positions only).
 * Leaves store observation positions; no mass. Supports query by point, depth, parent/child.
 */
struct ObservationOctreeNode {
    BoundingBox bbox;
    std::array<ObservationOctreeNode*, 8> children;
    bool is_leaf;
    int level;
    ObservationOctreeNode* parent;  // for query parent (nullptr for root)
    Point3D expansion_center;  // cell centroid r_c for L2L/M2L (paper: expansion center)
    std::vector<std::complex<double>> local_phi;  // local coeffs L_nm^φ (Eq. 12, 14); size (P+1)^2
    std::vector<Point3D> positions;  // observation positions in this cell (leaves only)
    /** Step 3.6: Admissible list — far-field source cells (λ = D/S ≥ lambda_min) for M2L. */
    std::vector<OctreeNode*> far_field_source_cells;

    ObservationOctreeNode()
        : is_leaf(true), level(0), parent(nullptr) {
        for (int i = 0; i < 8; i++) children[i] = nullptr;
    }

    ~ObservationOctreeNode() {
        for (int i = 0; i < 8; i++) {
            if (children[i]) delete children[i];
        }
    }
};

/**
 * ObservationOctree - Build from observation positions; same logic as source octree
 * (root = minimal enclosing cuboid, subdivide into 8, drop empty cells, max depth/count).
 * Independent of source octree. Can query cell for a point, depth, parent/child.
 */
class ObservationOctree {
public:
    ObservationOctree(const BoundingBox& root_bbox,
                      int max_depth = 10,
                      int max_positions_per_node = 10,
                      double min_cell_size = 1.0);
    ~ObservationOctree();

    void build(const std::vector<Point3D>& positions);
    ObservationOctreeNode* get_root() { return root_; }

    /** Find leaf node(s) containing the given point (query cell for a point). */
    std::vector<ObservationOctreeNode*> find_leaf_nodes(const Point3D& point);
    std::vector<ObservationOctreeNode*> get_all_leaves();

private:
    ObservationOctreeNode* root_;
    int max_depth_;
    int max_positions_per_node_;
    double min_cell_size_;

    void insert_positions(ObservationOctreeNode* node,
                          const std::vector<Point3D>& positions,
                          int current_depth);
    void collect_leaves(ObservationOctreeNode* node, std::vector<ObservationOctreeNode*>& leaves);
    void find_leaf_nodes_recursive(ObservationOctreeNode* node,
                                   const Point3D& point,
                                   std::vector<ObservationOctreeNode*>& result);
};

#endif // OCTREE_H
