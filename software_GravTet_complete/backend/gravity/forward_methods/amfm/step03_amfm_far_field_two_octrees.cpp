// ============================================================================
// AMFM Workflow - Phase 2: Octree Construction
// Step 2.1: Source octree — real subdivision. Step 2.2: Observation octree — same.
// Step 2.3: Expansion center per cell (r′_c / r_c).
// ============================================================================
// Subdivide when: count > max_per_node, depth < max_depth, cell_size > min_cell_size.
// Drop empty octants. Each source/position in exactly one leaf.
// ============================================================================

#include "step03_amfm_far_field_two_octrees.h"
#include <algorithm>
#include <cmath>

// ----------------------------------------------------------------------------
// Octree (source octree) — Step 2.1: real subdivision
// ----------------------------------------------------------------------------

Octree::Octree(const BoundingBox& root_bbox,
               int max_depth,
               int max_sources_per_node,
               double min_cell_size)
    : max_depth_(max_depth),
      max_sources_per_node_(max_sources_per_node),
      min_cell_size_(min_cell_size) {
    root_ = new OctreeNode();
    root_->bbox = root_bbox;
    root_->level = 0;
    root_->is_leaf = true;
    root_->total_mass = 0.0;
    root_->center_of_mass = root_bbox.center();
    root_->expansion_center = root_bbox.center();  // Step 2.3
    for (int i = 0; i < 8; i++) root_->children[i] = nullptr;
}

Octree::~Octree() {
    if (root_) delete root_;
}

void Octree::build(const std::vector<AMFMSource>& sources) {
    if (sources.empty()) return;
    insert_sources(root_, sources, 0);
    compute_multipole_moments();
}

void Octree::insert_sources(OctreeNode* node,
                            const std::vector<AMFMSource>& sources,
                            int current_depth) {
    std::vector<AMFMSource> node_sources;
    for (const auto& src : sources) {
        if (node->bbox.contains(src.position))
            node_sources.push_back(src);
    }
    if (node_sources.empty()) return;

    double cell_size = node->bbox.size();
    bool should_subdivide =
        (node_sources.size() > static_cast<size_t>(max_sources_per_node_)) &&
        (current_depth < max_depth_) &&
        (cell_size > min_cell_size_);

    if (should_subdivide) {
        std::array<BoundingBox, 8> octants = AMFMUtils::split_octants(node->bbox);
        node->is_leaf = false;
        node->sources.clear();  // Internal nodes do not hold sources

        for (int i = 0; i < 8; i++) {
            std::vector<AMFMSource> octant_sources;
            for (const auto& src : node_sources) {
                if (octants[i].contains(src.position))
                    octant_sources.push_back(src);
            }
            if (octant_sources.empty())
                continue;  // Drop empty cell

            node->children[i] = new OctreeNode();
            node->children[i]->bbox = octants[i];
            node->children[i]->level = node->level + 1;
            node->children[i]->is_leaf = true;
            node->children[i]->total_mass = 0.0;
            node->children[i]->center_of_mass = octants[i].center();
            node->children[i]->expansion_center = octants[i].center();  // Step 2.3
            for (int j = 0; j < 8; j++) node->children[i]->children[j] = nullptr;

            insert_sources(node->children[i], octant_sources, current_depth + 1);
        }
    } else {
        node->sources = node_sources;
        node->is_leaf = true;
    }
}

std::vector<OctreeNode*> Octree::find_leaf_nodes(const Point3D& point) {
    std::vector<OctreeNode*> result;
    find_leaf_nodes_recursive(root_, point, result);
    return result;
}

void Octree::find_leaf_nodes_recursive(OctreeNode* node,
                                       const Point3D& point,
                                       std::vector<OctreeNode*>& result) {
    if (!node || !node->bbox.contains(point)) return;
    if (node->is_leaf) {
        result.push_back(node);
    } else {
        for (int i = 0; i < 8; i++) {
            if (node->children[i])
                find_leaf_nodes_recursive(node->children[i], point, result);
        }
    }
}

std::vector<OctreeNode*> Octree::get_all_leaves() {
    std::vector<OctreeNode*> leaves;
    collect_leaves(root_, leaves);
    return leaves;
}

void Octree::collect_leaves(OctreeNode* node, std::vector<OctreeNode*>& leaves) {
    if (!node) return;
    if (node->is_leaf) {
        leaves.push_back(node);
    } else {
        for (int i = 0; i < 8; i++) {
            if (node->children[i])
                collect_leaves(node->children[i], leaves);
        }
    }
}

void Octree::compute_multipole_moments() {
    compute_node_moments(root_);
}

void Octree::compute_node_moments(OctreeNode* node) {
    if (!node) return;
    if (node->is_leaf) {
        node->total_mass = 0.0;
        double mx = 0, my = 0, mz = 0;
        for (const auto& src : node->sources) {
            double m = src.mass();
            node->total_mass += m;
            mx += m * src.position.x;
            my += m * src.position.y;
            mz += m * src.position.z;
        }
        if (node->total_mass > 0.0)
            node->center_of_mass = Point3D(mx / node->total_mass, my / node->total_mass, mz / node->total_mass);
        else
            node->center_of_mass = node->bbox.center();
    } else {
        node->total_mass = 0.0;
        double mx = 0, my = 0, mz = 0;
        for (int i = 0; i < 8; i++) {
            if (node->children[i]) {
                compute_node_moments(node->children[i]);
                double cm = node->children[i]->total_mass;
                node->total_mass += cm;
                mx += cm * node->children[i]->center_of_mass.x;
                my += cm * node->children[i]->center_of_mass.y;
                mz += cm * node->children[i]->center_of_mass.z;
            }
        }
        if (node->total_mass > 0.0)
            node->center_of_mass = Point3D(mx / node->total_mass, my / node->total_mass, mz / node->total_mass);
        else
            node->center_of_mass = node->bbox.center();
    }
}

// ----------------------------------------------------------------------------
// ObservationOctree — Step 2.2: real subdivision, Step 2.3: expansion center
// ----------------------------------------------------------------------------

ObservationOctree::ObservationOctree(const BoundingBox& root_bbox,
                                     int max_depth,
                                     int max_positions_per_node,
                                     double min_cell_size)
    : max_depth_(max_depth),
      max_positions_per_node_(max_positions_per_node),
      min_cell_size_(min_cell_size) {
    root_ = new ObservationOctreeNode();
    root_->bbox = root_bbox;
    root_->level = 0;
    root_->is_leaf = true;
    root_->parent = nullptr;
    root_->expansion_center = root_bbox.center();  // Step 2.3
    for (int i = 0; i < 8; i++) root_->children[i] = nullptr;
}

ObservationOctree::~ObservationOctree() {
    if (root_) delete root_;
}

void ObservationOctree::build(const std::vector<Point3D>& positions) {
    if (positions.empty()) return;
    insert_positions(root_, positions, 0);
}

void ObservationOctree::insert_positions(ObservationOctreeNode* node,
                                         const std::vector<Point3D>& positions,
                                         int current_depth) {
    std::vector<Point3D> node_positions;
    for (const auto& p : positions) {
        if (node->bbox.contains(p))
            node_positions.push_back(p);
    }
    if (node_positions.empty()) return;

    double cell_size = node->bbox.size();
    bool should_subdivide =
        (node_positions.size() > static_cast<size_t>(max_positions_per_node_)) &&
        (current_depth < max_depth_) &&
        (cell_size > min_cell_size_);

    if (should_subdivide) {
        std::array<BoundingBox, 8> octants = AMFMUtils::split_octants(node->bbox);
        node->is_leaf = false;
        node->positions.clear();

        for (int i = 0; i < 8; i++) {
            std::vector<Point3D> octant_positions;
            for (const auto& p : node_positions) {
                if (octants[i].contains(p))
                    octant_positions.push_back(p);
            }
            if (octant_positions.empty())
                continue;

            node->children[i] = new ObservationOctreeNode();
            node->children[i]->bbox = octants[i];
            node->children[i]->level = node->level + 1;
            node->children[i]->is_leaf = true;
            node->children[i]->parent = node;
            node->children[i]->expansion_center = octants[i].center();  // Step 2.3
            for (int j = 0; j < 8; j++) node->children[i]->children[j] = nullptr;

            insert_positions(node->children[i], octant_positions, current_depth + 1);
        }
    } else {
        node->positions = node_positions;
        node->is_leaf = true;
    }
}

std::vector<ObservationOctreeNode*> ObservationOctree::find_leaf_nodes(const Point3D& point) {
    std::vector<ObservationOctreeNode*> result;
    find_leaf_nodes_recursive(root_, point, result);
    return result;
}

void ObservationOctree::find_leaf_nodes_recursive(ObservationOctreeNode* node,
                                                   const Point3D& point,
                                                   std::vector<ObservationOctreeNode*>& result) {
    if (!node || !node->bbox.contains(point)) return;
    if (node->is_leaf) {
        result.push_back(node);
    } else {
        for (int i = 0; i < 8; i++) {
            if (node->children[i])
                find_leaf_nodes_recursive(node->children[i], point, result);
        }
    }
}

std::vector<ObservationOctreeNode*> ObservationOctree::get_all_leaves() {
    std::vector<ObservationOctreeNode*> leaves;
    collect_leaves(root_, leaves);
    return leaves;
}

void ObservationOctree::collect_leaves(ObservationOctreeNode* node,
                                       std::vector<ObservationOctreeNode*>& leaves) {
    if (!node) return;
    if (node->is_leaf) {
        leaves.push_back(node);
    } else {
        for (int i = 0; i < 8; i++) {
            if (node->children[i])
                collect_leaves(node->children[i], leaves);
        }
    }
}

