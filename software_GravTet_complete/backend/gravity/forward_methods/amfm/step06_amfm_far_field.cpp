// ============================================================================
// AMFM Workflow - Phase 3/4: Far-field (MINIMAL — placeholder)
// ============================================================================
// From scratch: stubs so build and core compile. No real M2M/M2L/L2L yet.
// Implement Step 3.2–3.6 and Step 4.3 when you add those phases.
// ============================================================================

#include "step06_amfm_far_field.h"
#include "step04_amfm_far_field_spherical.h"
#include "step05_amfm_near_field.h"
#include <cmath>
#include <complex>
#include <chrono>
#include <iostream>
#include <iomanip>
#include <cstdlib>
#include <cstdint>
#include <vector>
#include <algorithm>
#include <thread>

namespace AMFMFarField {

// ============================================================================
// Profiling: timers and per-level stats (enable with AMFM_PROFILE=1)
// ============================================================================
using Clock = std::chrono::high_resolution_clock;
using Sec = std::chrono::duration<double>;

struct LevelStats {
    size_t node_count = 0;
    size_t sum_far_list_size = 0;
    size_t max_far_list_size = 0;
};

static double t_build_admissible = 0.0;
static double t_m2l_total = 0.0;
static double t_l2l_total = 0.0;
static uint64_t m2l_call_count = 0;
static uint64_t l2l_call_count = 0;
static std::vector<LevelStats> level_stats;

static void reset_farfield_profile() {
    t_build_admissible = 0.0;
    t_m2l_total = 0.0;
    t_l2l_total = 0.0;
    m2l_call_count = 0;
    l2l_call_count = 0;
    level_stats.clear();
}

static void collect_admissible_stats(ObservationOctreeNode* node) {
    if (!node) return;
    int level = node->level;
    if (level >= static_cast<int>(level_stats.size()))
        level_stats.resize(level + 1);
    size_t list_size = node->far_field_source_cells.size();
    level_stats[level].node_count++;
    level_stats[level].sum_far_list_size += list_size;
    level_stats[level].max_far_list_size = std::max(level_stats[level].max_far_list_size, list_size);
    for (int i = 0; i < 8; i++)
        if (node->children[i])
            collect_admissible_stats(node->children[i]);
}

void print_farfield_profile() {
    if (!getenv("AMFM_PROFILE")) return;
    std::cout << "\n--- AMFM Farfield profile ---\n";
    std::cout << std::fixed << std::setprecision(4);
    std::cout << "  build_admissible_lists: " << t_build_admissible << " s\n";
    std::cout << "  M2L (total):           " << t_m2l_total << " s  (calls: " << m2l_call_count << ")\n";
    std::cout << "  L2L downward:           " << t_l2l_total << " s  (calls: " << l2l_call_count << ")\n";
    std::cout << "  M2L+L2L total:         " << (t_m2l_total + t_l2l_total) << " s\n";
    if (!level_stats.empty()) {
        std::cout << "\n  Per-level (obs tree): node_count, sum(far_list_size), max(far_list_size), avg list size\n";
        std::cout << "  " << std::setw(6) << "level" << std::setw(14) << "nodes"
                  << std::setw(18) << "sum_far" << std::setw(12) << "max_far"
                  << std::setw(14) << "avg_far\n";
        for (size_t lev = 0; lev < level_stats.size(); lev++) {
            const auto& s = level_stats[lev];
            double avg = (s.node_count > 0) ? static_cast<double>(s.sum_far_list_size) / s.node_count : 0.0;
            std::cout << "  " << std::setw(6) << lev << std::setw(14) << s.node_count
                      << std::setw(18) << s.sum_far_list_size << std::setw(12) << s.max_far_list_size
                      << std::setw(14) << std::setprecision(2) << avg << "\n";
        }
    }
    std::cout << "---\n" << std::endl;
}

// Step 3.2: Multipole moments at leaf (Eq. 8)
// M_nm^φ = Σ_s mass_s × conj(R_nm(r_s − r′_c)) over sources in the cell.
void compute_leaf_multipole_moments(OctreeNode* leaf, int P) {
    if (!leaf || !leaf->is_leaf || P < 0) return;

    const int size = (P + 1) * (P + 1);
    leaf->multipole_phi.assign(size, std::complex<double>(0, 0));

    const Point3D& r_c = leaf->expansion_center;
    AMFMSpherical::ensure_factorials(P + P);

    for (const AMFMSource& src : leaf->sources) {
        double dx = src.position.x - r_c.x;
        double dy = src.position.y - r_c.y;
        double dz = src.position.z - r_c.z;
        double mass = src.mass();

        for (int n = 0; n <= P; n++) {
            for (int m = -n; m <= n; m++) {
                std::complex<double> R = AMFMSpherical::R_nm(n, m, dx, dy, dz);
                leaf->multipole_phi[multipole_index(n, m)] += mass * std::conj(R);
            }
        }
    }
}

// Step 3.3: M2M upward pass (Eq. 10)
// M_nm(r″_c) += Σ_{n′,m′} R_{n′m′}(r′_c − r″_c) M_{n−n′, m−m′}(r′_c); vector = child_center − parent_center.
namespace {
    void m2m_add_child(OctreeNode* parent, OctreeNode* child, int P) {
        double dx = child->expansion_center.x - parent->expansion_center.x;
        double dy = child->expansion_center.y - parent->expansion_center.y;
        double dz = child->expansion_center.z - parent->expansion_center.z;

        const int size = (P + 1) * (P + 1);
        if (parent->multipole_phi.size() != static_cast<size_t>(size))
            parent->multipole_phi.assign(size, std::complex<double>(0, 0));
        if (child->multipole_phi.size() != static_cast<size_t>(size)) return;

        for (int n = 0; n <= P; n++) {
            for (int m = -n; m <= n; m++) {
                std::complex<double> sum(0, 0);
                for (int np = 0; np <= n; np++) {
                    int nq = n - np;
                    if (nq > P) continue;
                    for (int mp = -np; mp <= np; mp++) {
                        int mq = m - mp;
                        if (mq < -nq || mq > nq) continue;
                        std::complex<double> R = AMFMSpherical::R_nm(np, mp, dx, dy, dz);
                        sum += R * child->multipole_phi[multipole_index(nq, mq)];
                    }
                }
                parent->multipole_phi[multipole_index(n, m)] += sum;
            }
        }
    }
}

void compute_M2M_upward(OctreeNode* root, int P) {
    if (!root || P < 0) return;

    AMFMSpherical::ensure_factorials(P + P);

    if (root->is_leaf) {
        compute_leaf_multipole_moments(root, P);
        return;
    }

    const int size = (P + 1) * (P + 1);
    root->multipole_phi.assign(size, std::complex<double>(0, 0));

    for (int i = 0; i < 8; i++) {
        if (root->children[i]) {
            compute_M2M_upward(root->children[i], P);
            m2m_add_child(root, root->children[i], P);
        }
    }
}

// Step 3.4: M2L (Eq. 14)
// L_nm(r_c) += Σ_{n′,m′} (−1)^n S_{n+n′, m+m′}(r_c − r″_c) M_{n′m′}(r″_c).
// Vector = observation_center − source_center.
void m2l_add_source_contribution(ObservationOctreeNode* obs_node,
                                 const OctreeNode* source_node,
                                 int P) {
    if (!obs_node || !source_node || P < 0) return;

    auto t0 = Clock::now();
    double dx = obs_node->expansion_center.x - source_node->expansion_center.x;
    double dy = obs_node->expansion_center.y - source_node->expansion_center.y;
    double dz = obs_node->expansion_center.z - source_node->expansion_center.z;

    const int size = (P + 1) * (P + 1);
    if (source_node->multipole_phi.size() != static_cast<size_t>(size)) return;

    if (obs_node->local_phi.size() != static_cast<size_t>(size))
        obs_node->local_phi.assign(size, std::complex<double>(0, 0));

    AMFMSpherical::ensure_factorials(2 * P);

    for (int n = 0; n <= P; n++) {
        for (int m = -n; m <= n; m++) {
            std::complex<double> sum(0, 0);
            for (int np = 0; np <= P; np++) {
                for (int mp = -np; mp <= np; mp++) {
                    int nS = n + np, mS = m + mp;
                    if (nS < 0 || mS < -nS || mS > nS) continue;
                    std::complex<double> S = AMFMSpherical::S_nm(nS, mS, dx, dy, dz);
                    sum += S * source_node->multipole_phi[multipole_index(np, mp)];
                }
            }
            double sign = (n % 2 == 0) ? 1.0 : -1.0;
            obs_node->local_phi[multipole_index(n, m)] += sign * sum;
        }
    }
    t_m2l_total += std::chrono::duration_cast<Sec>(Clock::now() - t0).count();
    m2l_call_count++;
}

// Step 3.5: L2L (Eq. 17)
// child L_nm += Σ_{n′≥n, m′} R_{n′−n, m′−m}(r^c_c − r_c) × parent L_{n′m′}.
// Vector = child_center − parent_center.
void l2l_add_parent_to_child(ObservationOctreeNode* child,
                             const ObservationOctreeNode* parent,
                             int P) {
    if (!child || !parent || P < 0) return;

    double dx = child->expansion_center.x - parent->expansion_center.x;
    double dy = child->expansion_center.y - parent->expansion_center.y;
    double dz = child->expansion_center.z - parent->expansion_center.z;

    const int size = (P + 1) * (P + 1);
    if (parent->local_phi.size() != static_cast<size_t>(size)) return;

    if (child->local_phi.size() != static_cast<size_t>(size))
        child->local_phi.assign(size, std::complex<double>(0, 0));

    AMFMSpherical::ensure_factorials(2 * P);

    for (int n = 0; n <= P; n++) {
        for (int m = -n; m <= n; m++) {
            std::complex<double> sum(0, 0);
            for (int np = n; np <= P; np++) {
                int dn = np - n;
                for (int mp = -np; mp <= np; mp++) {
                    int dm = mp - m;
                    if (dm < -dn || dm > dn) continue;
                    std::complex<double> R = AMFMSpherical::R_nm(dn, dm, dx, dy, dz);
                    sum += R * parent->local_phi[multipole_index(np, mp)];
                }
            }
            child->local_phi[multipole_index(n, m)] += sum;
        }
    }
    l2l_call_count++;
}

void compute_L2L_downward(ObservationOctreeNode* root, int P) {
    if (!root || P < 0) return;

    auto t0 = Clock::now();
    for (int i = 0; i < 8; i++) {
        ObservationOctreeNode* ch = root->children[i];
        if (!ch) continue;
        l2l_add_parent_to_child(ch, root, P);
        compute_L2L_downward(ch, P);
    }
    t_l2l_total += std::chrono::duration_cast<Sec>(Clock::now() - t0).count();
}

double admissible_lambda(ObservationOctreeNode* obs_node, OctreeNode* src_node) {
    if (!obs_node || !src_node) return 0.0;
    double D = obs_node->expansion_center.distance(src_node->expansion_center);
    double S = std::max(obs_node->bbox.size(), src_node->bbox.size());
    if (S <= 0.0) return (D <= 0.0) ? 0.0 : 1e30;
    return D / S;
}

// True if the two cells touch (share a face, edge, or vertex). We only do M2L for
// non-adjacent same-level cells so the interaction list stays bounded (~6^3-2^3 max).
static bool cells_adjacent(const BoundingBox& a, const BoundingBox& b) {
    const double eps = 1e-12 * std::max(a.size(), std::max(b.size(), 1.0));
    bool sep_x = (a.max_corner.x + eps < b.min_corner.x) || (b.max_corner.x + eps < a.min_corner.x);
    bool sep_y = (a.max_corner.y + eps < b.min_corner.y) || (b.max_corner.y + eps < a.min_corner.y);
    bool sep_z = (a.max_corner.z + eps < b.min_corner.z) || (b.max_corner.z + eps < a.min_corner.z);
    return !sep_x && !sep_y && !sep_z;
}

// Cap far-field list size per observation cell so M2L cost stays O(N). 48 = tight list-2 style.
const size_t kMaxFarFieldPerNode = 48;

// Step 3.6: Admissible list (λ = D/S ≥ lambda_min) — dual-tree traversal
namespace {
    void clear_far_lists(ObservationOctreeNode* node) {
        if (!node) return;
        node->far_field_source_cells.clear();
        for (int i = 0; i < 8; i++)
            if (node->children[i]) clear_far_lists(node->children[i]);
    }

    // Same-level restriction: only add (obs, src) when both are at the same level.
    // This keeps interaction lists O(1) per cell and makes AMFM scale as intended.
    // Without it, one observation cell could get hundreds of source cells (same lambda),
    // causing M2L to dominate and be 100x+ slower than direct sum.
    void admissible_recursive(ObservationOctreeNode* obs_node,
                             OctreeNode* src_node,
                             double lambda_min) {
        if (!obs_node || !src_node) return;

        double lam = admissible_lambda(obs_node, src_node);
        if (lam >= lambda_min && obs_node->level == src_node->level
            && !cells_adjacent(obs_node->bbox, src_node->bbox)
            && obs_node->far_field_source_cells.size() < kMaxFarFieldPerNode) {
            obs_node->far_field_source_cells.push_back(src_node);
            return;
        }

        if (obs_node->is_leaf && src_node->is_leaf)
            return;  // near-field pair, do not add to far list

        if (!obs_node->is_leaf) {
            for (int i = 0; i < 8; i++)
                if (obs_node->children[i])
                    admissible_recursive(obs_node->children[i], src_node, lambda_min);
        } else {
            for (int i = 0; i < 8; i++)
                if (src_node->children[i])
                    admissible_recursive(obs_node, src_node->children[i], lambda_min);
        }
    }
}

void build_admissible_lists(ObservationOctree& obs_tree, Octree& src_tree, double lambda_min) {
    ObservationOctreeNode* obs_root = obs_tree.get_root();
    OctreeNode* src_root = src_tree.get_root();
    if (!obs_root || !src_root) return;

    reset_farfield_profile();
    auto t0 = Clock::now();
    clear_far_lists(obs_root);
    admissible_recursive(obs_root, src_root, lambda_min);
    t_build_admissible = std::chrono::duration_cast<Sec>(Clock::now() - t0).count();
    collect_admissible_stats(obs_root);
}

// Step 4.3: Far-field at receivers (Eqs. 15, 18)
// φ_far(r) = G Re(Σ_{n,m} R_nm(r − r^c_c) L_nm).  g_far = −G Re(Σ ∇R_nm L_nm).
double potential_far_at_point(const Point3D& r, ObservationOctreeNode* leaf, int P) {
    if (!leaf || P < 0) return 0.0;
    const int size = (P + 1) * (P + 1);
    if (leaf->local_phi.size() != static_cast<size_t>(size)) return 0.0;

    double dx = r.x - leaf->expansion_center.x;
    double dy = r.y - leaf->expansion_center.y;
    double dz = r.z - leaf->expansion_center.z;

    AMFMSpherical::ensure_factorials(2 * P);
    std::complex<double> sum(0, 0);
    for (int n = 0; n <= P; n++) {
        for (int m = -n; m <= n; m++) {
            std::complex<double> R = AMFMSpherical::R_nm(n, m, dx, dy, dz);
            sum += R * leaf->local_phi[multipole_index(n, m)];
        }
    }
    return G * sum.real();
}

void gravity_far_at_point(const Point3D& r, ObservationOctreeNode* leaf, int P,
                          double& gx, double& gy, double& gz) {
    gx = gy = gz = 0.0;
    if (!leaf || P < 0) return;
    const int size = (P + 1) * (P + 1);
    if (leaf->local_phi.size() != static_cast<size_t>(size)) return;

    double dx = r.x - leaf->expansion_center.x;
    double dy = r.y - leaf->expansion_center.y;
    double dz = r.z - leaf->expansion_center.z;

    AMFMSpherical::ensure_factorials(2 * P);
    std::complex<double> sum_x(0, 0), sum_y(0, 0), sum_z(0, 0);
    for (int n = 0; n <= P; n++) {
        for (int m = -n; m <= n; m++) {
            std::complex<double> dRx, dRy, dRz;
            AMFMSpherical::gradient_R_nm(n, m, dx, dy, dz, dRx, dRy, dRz);
            std::complex<double> L = leaf->local_phi[multipole_index(n, m)];
            sum_x += dRx * L;
            sum_y += dRy * L;
            sum_z += dRz * L;
        }
    }
    gx = -G * sum_x.real();
    gy = -G * sum_y.real();
    gz = -G * sum_z.real();
}

double gravity_z_far_at_point(const Point3D& r, ObservationOctreeNode* leaf, int P) {
    double gx, gy, gz;
    gravity_far_at_point(r, leaf, P, gx, gy, gz);
    return gz;
}

std::vector<double> evaluate_far_gravity_at_receivers(
    const std::vector<AMFMReceiver>& receivers,
    ObservationOctree& obs_tree,
    int P) {
    std::vector<double> results;
    results.reserve(receivers.size());
    for (const AMFMReceiver& rec : receivers) {
        std::vector<ObservationOctreeNode*> leaves = obs_tree.find_leaf_nodes(rec.position);
        ObservationOctreeNode* leaf = leaves.empty() ? obs_tree.get_root() : leaves[0];
        results.push_back(gravity_z_far_at_point(rec.position, leaf, P));
    }
    return results;
}

std::vector<double> evaluate_far_gravity_grouped(
    const std::vector<AMFMReceiver>& receivers,
    const std::map<ObservationOctreeNode*, std::vector<size_t>>& leaf_to_receivers,
    int P) {
    const size_t M = receivers.size();
    std::vector<double> results(M, 0.0);

    typedef std::pair<ObservationOctreeNode*, const std::vector<size_t>*> Entry;
    std::vector<Entry> entries;
    entries.reserve(leaf_to_receivers.size());
    for (const auto& kv : leaf_to_receivers)
        entries.push_back(Entry(kv.first, &kv.second));

    unsigned int n_threads = std::thread::hardware_concurrency();
    if (n_threads == 0) n_threads = 1;
    if (entries.size() < 2 || n_threads < 2) {
        for (const auto& kv : leaf_to_receivers) {
            ObservationOctreeNode* leaf = kv.first;
            const std::vector<size_t>& indices = kv.second;
            for (size_t ri : indices)
                results[ri] = gravity_z_far_at_point(receivers[ri].position, leaf, P);
        }
        return results;
    }

    size_t work_per = (entries.size() + n_threads - 1) / n_threads;
    if (work_per < 1) work_per = 1;
    n_threads = static_cast<unsigned int>((entries.size() + work_per - 1) / work_per);
    if (n_threads < 2) {
        for (const auto& kv : leaf_to_receivers) {
            ObservationOctreeNode* leaf = kv.first;
            const std::vector<size_t>& indices = kv.second;
            for (size_t ri : indices)
                results[ri] = gravity_z_far_at_point(receivers[ri].position, leaf, P);
        }
        return results;
    }

    std::vector<std::thread> threads;
    threads.reserve(n_threads);
    for (unsigned int t = 0; t < n_threads; t++) {
        size_t e0 = t * work_per;
        size_t e1 = e0 + work_per;
        if (e1 > entries.size()) e1 = entries.size();
        if (e0 >= entries.size()) break;
        threads.push_back(std::thread([&entries, &receivers, &results, e0, e1, P]() {
            for (size_t e = e0; e < e1; e++) {
                ObservationOctreeNode* leaf = entries[e].first;
                const std::vector<size_t>& indices = *entries[e].second;
                for (size_t ri : indices)
                    results[ri] = gravity_z_far_at_point(receivers[ri].position, leaf, P);
            }
        }));
    }
    for (size_t i = 0; i < threads.size(); i++)
        threads[i].join();

    return results;
}

bool is_far_enough(const AMFMReceiver& receiver, OctreeNode* node, double critical_distance_factor) {
    if (!node) return false;
    double dist = receiver.position.distance(node->center_of_mass);
    double node_size = node->bbox.size();
    return dist > critical_distance_factor * node_size;
}

double multipole_approximation(const AMFMReceiver& receiver, OctreeNode* node) {
    if (!node || node->total_mass <= 0.0) return 0.0;
    double dx = receiver.position.x - node->center_of_mass.x;
    double dy = receiver.position.y - node->center_of_mass.y;
    double dz = receiver.position.z - node->center_of_mass.z;
    double r2 = dx*dx + dy*dy + dz*dz;
    if (r2 < 1e-10) return 0.0;
    double r3 = std::pow(r2, 1.5);
    return G * node->total_mass * dz / r3;
}

static bool node_beyond_critical_distance(const AMFMReceiver& receiver,
                                          OctreeNode* node,
                                          double critical_distance) {
    if (!node) return false;
    double min_dist_x = std::max(0.0, std::max(node->bbox.min_corner.x - receiver.position.x,
                                               receiver.position.x - node->bbox.max_corner.x));
    double min_dist_y = std::max(0.0, std::max(node->bbox.min_corner.y - receiver.position.y,
                                               receiver.position.y - node->bbox.max_corner.y));
    double min_dist_z = std::max(0.0, std::max(node->bbox.min_corner.z - receiver.position.z,
                                               receiver.position.z - node->bbox.max_corner.z));
    double min_dist = std::sqrt(min_dist_x*min_dist_x + min_dist_y*min_dist_y + min_dist_z*min_dist_z);
    return min_dist > critical_distance;
}

double compute_far_gravity(const AMFMReceiver& receiver,
                           OctreeNode* node,
                           double critical_distance,
                           double critical_distance_factor) {
    if (!node) return 0.0;
    if (node_beyond_critical_distance(receiver, node, critical_distance)) {
        if (node->is_leaf || is_far_enough(receiver, node, critical_distance_factor))
            return multipole_approximation(receiver, node);
        double gz = 0.0;
        for (int i = 0; i < 8; i++) {
            if (node->children[i])
                gz += compute_far_gravity(receiver, node->children[i], critical_distance, critical_distance_factor);
        }
        return gz;
    }
    if (node->is_leaf) {
        double gz = 0.0;
        for (const auto& src : node->sources) {
            if (receiver.position.distance(src.position) > critical_distance)
                gz += AMFMNearField::compute_gravity_from_source(receiver, src);
        }
        return gz;
    }
    double gz = 0.0;
    for (int i = 0; i < 8; i++) {
        if (node->children[i])
            gz += compute_far_gravity(receiver, node->children[i], critical_distance, critical_distance_factor);
    }
    return gz;
}

} // namespace AMFMFarField
