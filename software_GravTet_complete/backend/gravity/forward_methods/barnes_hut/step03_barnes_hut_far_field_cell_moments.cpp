// Step 03 — Barnes-Hut FAR-FIELD setup: cell mass and center-of-mass moments.
#include "step01_barnes_hut_types_and_api.h"

void compute_moments(OctreeNode* node, const std::vector<Source>& sources) {
    if (!node) return;

    if (node->is_leaf) {
        double M = 0, Mx = 0, My = 0, Mz = 0;
        for (size_t i : node->source_indices) {
            const Source& s = sources[i];
            double m = s.density * s.volume;
            M += m;
            Mx += m * s.x;
            My += m * s.y;
            Mz += m * s.z;
        }
        node->mass = M;
        if (M > 0) {
            node->com_x = Mx / M;
            node->com_y = My / M;
            node->com_z = Mz / M;
        }
        return;
    }

    double M = 0, Mx = 0, My = 0, Mz = 0;
    for (const auto& child : node->children) {
        if (!child) continue;
        compute_moments(child.get(), sources);
        M += child->mass;
        Mx += child->mass * child->com_x;
        My += child->mass * child->com_y;
        Mz += child->mass * child->com_z;
    }
    node->mass = M;
    if (M > 0) {
        node->com_x = Mx / M;
        node->com_y = My / M;
        node->com_z = Mz / M;
    }
}
