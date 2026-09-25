// ============================================================================
// AMFM Workflow - Phase 4: Near-field (MINIMAL — Step 4.1 point mass only)
// ============================================================================
// From scratch: only point-mass gravity (Step 4.1). Tetrahedron + octree loop later.
// SIMD (AVX2/NEON), multi-threading, and cache-friendly blocking added.
// ============================================================================

#include "../../common/gravity_constants.hpp"
#include "step05_amfm_near_field.h"
#include "step03_amfm_far_field_two_octrees.h"
#include <cmath>
#include <map>
#include <thread>
#include <unordered_set>
#include <vector>

#if !defined(AMFM_SCALAR_ONLY) && defined(__AVX2__)
#include <immintrin.h>
#endif
#if !defined(AMFM_SCALAR_ONLY) && (defined(__aarch64__) || defined(__ARM_NEON))
#include <arm_neon.h>
#endif

namespace AMFMNearField {

namespace {
constexpr double R2_MIN = gravity::physical::R2_SOFTENING_MIN;

/** Scalar: sum gz from contiguous sources (same kernel as compute_gravity_from_source). */
double direct_sum_sources_scalar(double rx, double ry, double rz,
    const AMFMSource* __restrict__ sources, size_t n) {
    double gz = 0.0;
    for (size_t i = 0; i < n; i++) {
        const AMFMSource& s = sources[i];
        double dx = rx - s.position.x, dy = ry - s.position.y, dz = rz - s.position.z;
        double r2 = dx*dx + dy*dy + dz*dz;
        if (r2 < R2_MIN) continue;
        double r3 = std::pow(r2, 1.5);
        gz += G * s.mass() * dz / r3;
    }
    return gz;
}

#if !defined(AMFM_SCALAR_ONLY) && defined(__AVX2__)
/** AVX2: 4 sources at a time (contiguous AMFMSource: x,y,z,density,volume = 5 doubles). */
double direct_sum_sources_avx2(double rx, double ry, double rz,
    const AMFMSource* __restrict__ sources, size_t n) {
    const double* base = reinterpret_cast<const double*>(sources);
    constexpr size_t stride = sizeof(AMFMSource) / sizeof(double);
    const __m256d vr_x = _mm256_set1_pd(rx);
    const __m256d vr_y = _mm256_set1_pd(ry);
    const __m256d vr_z = _mm256_set1_pd(rz);
    const __m256d vG = _mm256_set1_pd(G);
    const __m256d veps = _mm256_set1_pd(R2_MIN);
    __m256d vgz = _mm256_setzero_pd();
    size_t i = 0;
    for (; i + 4 <= n; i += 4) {
        __m256i voff = _mm256_set_epi64x(
            static_cast<long long>((i+3)*stride),
            static_cast<long long>((i+2)*stride),
            static_cast<long long>((i+1)*stride),
            static_cast<long long>(i*stride)
        );
        __m256d vx = _mm256_i64gather_pd(base + 0, voff, 8);
        __m256d vy = _mm256_i64gather_pd(base + 1, voff, 8);
        __m256d vz = _mm256_i64gather_pd(base + 2, voff, 8);
        __m256d vd = _mm256_i64gather_pd(base + 3, voff, 8);
        __m256d vvol = _mm256_i64gather_pd(base + 4, voff, 8);
        __m256d vdx = _mm256_sub_pd(vr_x, vx);
        __m256d vdy = _mm256_sub_pd(vr_y, vy);
        __m256d vdz = _mm256_sub_pd(vr_z, vz);
        __m256d vr2 = _mm256_fmadd_pd(vdx, vdx, _mm256_fmadd_pd(vdy, vdy, _mm256_mul_pd(vdz, vdz)));
        __m256d mask = _mm256_cmp_pd(vr2, veps, _CMP_GT_OQ);
        __m256d vr3 = _mm256_mul_pd(vr2, _mm256_sqrt_pd(vr2));
        __m256d vmass = _mm256_mul_pd(vd, vvol);
        __m256d vcontrib = _mm256_mul_pd(vG, _mm256_div_pd(_mm256_mul_pd(vmass, vdz), vr3));
        vcontrib = _mm256_and_pd(vcontrib, mask);
        vgz = _mm256_add_pd(vgz, vcontrib);
    }
    __m128d lo = _mm256_castpd256_pd128(vgz);
    __m128d hi = _mm256_extractf128_pd(vgz, 1);
    __m128d sum2 = _mm_add_pd(lo, hi);
    sum2 = _mm_hadd_pd(sum2, sum2);
    double gz = _mm_cvtsd_f64(sum2);
    if (i < n)
        gz += direct_sum_sources_scalar(rx, ry, rz, sources + i, n - i);
    return gz;
}
#endif

#if !defined(AMFM_SCALAR_ONLY) && (defined(__aarch64__) || defined(__ARM_NEON))
/** NEON: 2 sources at a time. */
double direct_sum_sources_neon(double rx, double ry, double rz,
    const AMFMSource* __restrict__ sources, size_t n) {
    float64x2_t vr_x = vdupq_n_f64(rx);
    float64x2_t vr_y = vdupq_n_f64(ry);
    float64x2_t vr_z = vdupq_n_f64(rz);
    float64x2_t vG = vdupq_n_f64(G);
    float64x2_t veps = vdupq_n_f64(R2_MIN);
    float64x2_t vgz = vdupq_n_f64(0.0);
    size_t i = 0;
    for (; i + 2 <= n; i += 2) {
        const AMFMSource& s0 = sources[i];
        const AMFMSource& s1 = sources[i+1];
        double xy[2] = { s0.position.x, s1.position.x };
        double yy[2] = { s0.position.y, s1.position.y };
        double zz[2] = { s0.position.z, s1.position.z };
        double mm[2] = { s0.mass(), s1.mass() };
        float64x2_t vx = vld1q_f64(xy);
        float64x2_t vy = vld1q_f64(yy);
        float64x2_t vz = vld1q_f64(zz);
        float64x2_t vmass = vld1q_f64(mm);
        float64x2_t vdx = vsubq_f64(vr_x, vx);
        float64x2_t vdy = vsubq_f64(vr_y, vy);
        float64x2_t vdz = vsubq_f64(vr_z, vz);
        float64x2_t vr2 = vaddq_f64(vmulq_f64(vdx, vdx), vaddq_f64(vmulq_f64(vdy, vdy), vmulq_f64(vdz, vdz)));
        uint64x2_t mask = vcgtq_f64(vr2, veps);
        float64x2_t vr3 = vmulq_f64(vr2, vsqrtq_f64(vr2));
        float64x2_t vcontrib = vmulq_f64(vG, vdivq_f64(vmulq_f64(vmass, vdz), vr3));
        vcontrib = vreinterpretq_f64_u64(vandq_u64(vreinterpretq_u64_f64(vcontrib), mask));
        vgz = vaddq_f64(vgz, vcontrib);
    }
    double gz = vgetq_lane_f64(vgz, 0) + vgetq_lane_f64(vgz, 1);
    if (i < n)
        gz += direct_sum_sources_scalar(rx, ry, rz, sources + i, n - i);
    return gz;
}
#endif

/** Choose SIMD or scalar for direct sum over contiguous sources. */
double direct_sum_sources(double rx, double ry, double rz,
    const AMFMSource* sources, size_t n) {
#if !defined(AMFM_SCALAR_ONLY) && defined(__AVX2__)
    if (n >= 4) return direct_sum_sources_avx2(rx, ry, rz, sources, n);
#elif !defined(AMFM_SCALAR_ONLY) && (defined(__aarch64__) || defined(__ARM_NEON))
    if (n >= 2) return direct_sum_sources_neon(rx, ry, rz, sources, n);
#endif
    return direct_sum_sources_scalar(rx, ry, rz, sources, n);
}

} // anonymous namespace

// ----------------------------------------------------------------------------
// Step 4.1: Single source — vertical gravity gz = G * mass * dz / r³ (m/s²)
// ----------------------------------------------------------------------------
double compute_gravity_from_source(const AMFMReceiver& receiver, const AMFMSource& source) {
    double dx = receiver.position.x - source.position.x;
    double dy = receiver.position.y - source.position.y;
    double dz = receiver.position.z - source.position.z;
    double r2 = dx*dx + dy*dy + dz*dz;
    if (r2 < R2_MIN) return 0.0;
    double r3 = std::pow(r2, 1.5);
    return G * source.mass() * dz / r3;
}

// ----------------------------------------------------------------------------
// Near-field: sum over sources within critical_distance (direct summation)
// ----------------------------------------------------------------------------
double compute_near_gravity(const AMFMReceiver& receiver,
                            const std::vector<AMFMSource>& sources,
                            double critical_distance) {
    double gz = 0.0;
    for (const auto& src : sources) {
        if (receiver.position.distance(src.position) <= critical_distance)
            gz += compute_gravity_from_source(receiver, src);
    }
    return gz;
}

// ----------------------------------------------------------------------------
// Step 4.1: Closed-form tetrahedron — φ, g (Eqs. 24–28); singularity-free
// Uses solid-angle formulation: φ = G ρ Σ (h × ω) over faces.
// ----------------------------------------------------------------------------
namespace {
    const double EPS = 1e-12;
    const double FD_EPS = 1e-8;

    // Solid angle of triangle (a,b,c) as seen from P. Van Oosterom & Strackee (1983).
    // Singularity-free: returns 0 when P in plane or on vertex.
    double solid_angle_triangle(const Point3D& P, const Point3D& a, const Point3D& b, const Point3D& c) {
        double r1x = a.x - P.x, r1y = a.y - P.y, r1z = a.z - P.z;
        double r2x = b.x - P.x, r2y = b.y - P.y, r2z = b.z - P.z;
        double r3x = c.x - P.x, r3y = c.y - P.y, r3z = c.z - P.z;
        double d1 = std::sqrt(r1x*r1x + r1y*r1y + r1z*r1z);
        double d2 = std::sqrt(r2x*r2x + r2y*r2y + r2z*r2z);
        double d3 = std::sqrt(r3x*r3x + r3y*r3y + r3z*r3z);
        if (d1 < EPS || d2 < EPS || d3 < EPS) return 0.0;
        double ax = r1x/d1, ay = r1y/d1, az = r1z/d1;
        double bx = r2x/d2, by = r2y/d2, bz = r2z/d2;
        double cx = r3x/d3, cy = r3y/d3, cz = r3z/d3;
        double cross_x = by*cz - bz*cy, cross_y = bz*cx - bx*cz, cross_z = bx*cy - by*cx;
        double num = ax*cross_x + ay*cross_y + az*cross_z;
        double den = 1.0 + (ax*bx+ay*by+az*bz) + (bx*cx+by*cy+bz*cz) + (cx*ax+cy*ay+cz*az);
        if (std::abs(den) < EPS && std::abs(num) < EPS) return 0.0;
        double omega = 2.0 * std::atan2(num, den);
        return omega;
    }
}

double potential_tetrahedron(const Point3D& observation, const TetrahedronSource& tet) {
    const Point3D& v0 = tet.v[0], &v1 = tet.v[1], &v2 = tet.v[2], &v3 = tet.v[3];
    const Point3D& P = observation;
    double rho = tet.density;
    if (rho == 0.0) return 0.0;

    // Four faces: (v1,v2,v3) opp v0; (v0,v2,v3) opp v1; (v0,v1,v3) opp v2; (v0,v1,v2) opp v3
    const int face_verts[4][3] = { {1,2,3}, {0,2,3}, {0,1,3}, {0,1,2} };
    const int opp[4] = { 0, 1, 2, 3 };

    double phi = 0.0;
    for (int f = 0; f < 4; f++) {
        const Point3D& a = tet.v[face_verts[f][0]];
        const Point3D& b = tet.v[face_verts[f][1]];
        const Point3D& c = tet.v[face_verts[f][2]];
        const Point3D& o = tet.v[opp[f]];

        double e1x = b.x - a.x, e1y = b.y - a.y, e1z = b.z - a.z;
        double e2x = c.x - a.x, e2y = c.y - a.y, e2z = c.z - a.z;
        double nx = e1y*e2z - e1z*e2y, ny = e1z*e2x - e1x*e2z, nz = e1x*e2y - e1y*e2x;
        double nlen = std::sqrt(nx*nx + ny*ny + nz*nz);
        if (nlen < EPS) continue;
        nx /= nlen; ny /= nlen; nz /= nlen;
        double out = (o.x - a.x)*nx + (o.y - a.y)*ny + (o.z - a.z)*nz;
        if (out > 0.0) { nx = -nx; ny = -ny; nz = -nz; }

        double h = (P.x - a.x)*nx + (P.y - a.y)*ny + (P.z - a.z)*nz;
        double omega = solid_angle_triangle(P, a, b, c);
        phi += h * omega;
    }
    return G * rho * phi;
}

void gravity_tetrahedron(const Point3D& observation, const TetrahedronSource& tet,
                         double& gx, double& gy, double& gz) {
    double scale = 1.0;
    for (int i = 0; i < 4; i++) {
        double d = observation.distance(tet.v[i]);
        if (d > scale) scale = d;
    }
    if (scale < 1e-15) scale = 1.0;
    double h = FD_EPS * std::max(scale, 1.0);
    Point3D obs = observation;

    obs.x = observation.x + h;
    double px = potential_tetrahedron(obs, tet);
    obs.x = observation.x - h;
    double pxm = potential_tetrahedron(obs, tet);
    gx = -(px - pxm) / (2.0 * h);

    obs.x = observation.x; obs.y = observation.y + h;
    double py = potential_tetrahedron(obs, tet);
    obs.y = observation.y - h;
    double pym = potential_tetrahedron(obs, tet);
    gy = -(py - pym) / (2.0 * h);

    obs.y = observation.y; obs.z = observation.z + h;
    double pz = potential_tetrahedron(obs, tet);
    obs.z = observation.z - h;
    double pzm = potential_tetrahedron(obs, tet);
    gz = -(pz - pzm) / (2.0 * h);
}

double gravity_z_tetrahedron(const Point3D& observation, const TetrahedronSource& tet) {
    double gx, gy, gz;
    gravity_tetrahedron(observation, tet, gx, gy, gz);
    return gz;
}

namespace {
    void collect_leaves_under(OctreeNode* node, std::unordered_set<OctreeNode*>& out) {
        if (node->is_leaf) {
            out.insert(node);
            return;
        }
        for (int i = 0; i < 8; i++)
            if (node->children[i])
                collect_leaves_under(node->children[i], out);
    }
}

// ----------------------------------------------------------------------------
// Step 4.2: Near-field loop — group receivers by obs leaf; exclude far-field
// (With root-only octree, “near” = all sources not in far list = all sources.)
// ----------------------------------------------------------------------------
std::vector<double> compute_near_gravity_octree(
    const std::vector<AMFMReceiver>& receivers,
    ObservationOctree& obs_tree,
    Octree& src_tree,
    double lambda_min) {
    (void)lambda_min;
    std::vector<double> results(receivers.size(), 0.0);
    std::vector<OctreeNode*> src_leaves = src_tree.get_all_leaves();
    ObservationOctreeNode* obs_root = obs_tree.get_root();
    if (!obs_root) return results;

    std::map<ObservationOctreeNode*, std::vector<size_t>> leaf_to_receivers;
    for (size_t i = 0; i < receivers.size(); ++i) {
        std::vector<ObservationOctreeNode*> obs_leaves = obs_tree.find_leaf_nodes(receivers[i].position);
        ObservationOctreeNode* obs_leaf = obs_leaves.empty() ? obs_root : obs_leaves[0];
        leaf_to_receivers[obs_leaf].push_back(i);
    }

    for (const auto& kv : leaf_to_receivers) {
        ObservationOctreeNode* obs_leaf = kv.first;
        const std::vector<size_t>& indices = kv.second;
        std::unordered_set<OctreeNode*> far_leaves;
        for (OctreeNode* fc : obs_leaf->far_field_source_cells)
            collect_leaves_under(fc, far_leaves);
        std::vector<OctreeNode*> near_src_leaves;
        near_src_leaves.reserve(src_leaves.size() / 2);
        for (OctreeNode* src_leaf : src_leaves)
            if (far_leaves.count(src_leaf) == 0)
                near_src_leaves.push_back(src_leaf);
        for (size_t ri : indices) {
            const AMFMReceiver& rec = receivers[ri];
            double gz = 0.0;
            for (OctreeNode* src_leaf : near_src_leaves)
                gz += direct_sum_sources(rec.position.x, rec.position.y, rec.position.z,
                    src_leaf->sources.data(), src_leaf->sources.size());
            results[ri] = gz;
        }
    }
    return results;
}

std::vector<double> compute_near_gravity_octree_grouped(
    const std::vector<AMFMReceiver>& receivers,
    const std::map<ObservationOctreeNode*, std::vector<size_t>>& leaf_to_receivers,
    ObservationOctree& obs_tree,
    Octree& src_tree,
    double lambda_min) {
    (void)obs_tree;
    (void)lambda_min;
    const size_t M = receivers.size();
    std::vector<double> results(M, 0.0);
    std::vector<OctreeNode*> src_leaves = src_tree.get_all_leaves();

    typedef std::pair<ObservationOctreeNode*, const std::vector<size_t>*> Entry;
    std::vector<Entry> entries;
    entries.reserve(leaf_to_receivers.size());
    for (const auto& kv : leaf_to_receivers)
        entries.push_back(Entry(kv.first, &kv.second));

    const size_t RECEIVER_BLOCK = 64;
    unsigned int n_threads = std::thread::hardware_concurrency();
    if (n_threads == 0) n_threads = 1;
    if (entries.size() < 2 || n_threads < 2) {
        for (const auto& kv : leaf_to_receivers) {
            ObservationOctreeNode* obs_leaf = kv.first;
            const std::vector<size_t>& indices = kv.second;
            std::unordered_set<OctreeNode*> far_leaves;
            for (OctreeNode* fc : obs_leaf->far_field_source_cells)
                collect_leaves_under(fc, far_leaves);
            std::vector<OctreeNode*> near_src_leaves;
            near_src_leaves.reserve(src_leaves.size() / 2);
            for (OctreeNode* src_leaf : src_leaves)
                if (far_leaves.count(src_leaf) == 0)
                    near_src_leaves.push_back(src_leaf);
            for (size_t ii0 = 0; ii0 < indices.size(); ii0 += RECEIVER_BLOCK) {
                size_t ii1 = ii0 + RECEIVER_BLOCK;
                if (ii1 > indices.size()) ii1 = indices.size();
                for (size_t ii = ii0; ii < ii1; ii++) {
                    size_t ri = indices[ii];
                    const AMFMReceiver& rec = receivers[ri];
                    double gz = 0.0;
                    for (OctreeNode* src_leaf : near_src_leaves)
                        gz += direct_sum_sources(rec.position.x, rec.position.y, rec.position.z,
                            src_leaf->sources.data(), src_leaf->sources.size());
                    results[ri] = gz;
                }
            }
        }
        return results;
    }

    size_t work_per = (entries.size() + n_threads - 1) / n_threads;
    if (work_per < 1) work_per = 1;
    n_threads = static_cast<unsigned int>((entries.size() + work_per - 1) / work_per);
    if (n_threads < 2) {
        for (const auto& kv : leaf_to_receivers) {
            ObservationOctreeNode* obs_leaf = kv.first;
            const std::vector<size_t>& indices = kv.second;
            std::unordered_set<OctreeNode*> far_leaves;
            for (OctreeNode* fc : obs_leaf->far_field_source_cells)
                collect_leaves_under(fc, far_leaves);
            std::vector<OctreeNode*> near_src_leaves;
            near_src_leaves.reserve(src_leaves.size() / 2);
            for (OctreeNode* src_leaf : src_leaves)
                if (far_leaves.count(src_leaf) == 0)
                    near_src_leaves.push_back(src_leaf);
            for (size_t ri : indices) {
                const AMFMReceiver& rec = receivers[ri];
                double gz = 0.0;
                for (OctreeNode* src_leaf : near_src_leaves)
                    gz += direct_sum_sources(rec.position.x, rec.position.y, rec.position.z,
                        src_leaf->sources.data(), src_leaf->sources.size());
                results[ri] = gz;
            }
        }
        return results;
    }

    std::vector<std::vector<double>> results_local(n_threads);
    for (size_t t = 0; t < n_threads; t++)
        results_local[t].resize(M, 0.0);

    std::vector<std::thread> threads;
    threads.reserve(n_threads);
    for (unsigned int t = 0; t < n_threads; t++) {
        size_t e0 = t * work_per;
        size_t e1 = e0 + work_per;
        if (e1 > entries.size()) e1 = entries.size();
        if (e0 >= entries.size()) break;
        threads.push_back(std::thread([&entries, &receivers, &src_leaves, &results_local, t, e0, e1, RECEIVER_BLOCK]() {
            for (size_t e = e0; e < e1; e++) {
                ObservationOctreeNode* obs_leaf = entries[e].first;
                const std::vector<size_t>& indices = *entries[e].second;
                std::unordered_set<OctreeNode*> far_leaves;
                for (OctreeNode* fc : obs_leaf->far_field_source_cells)
                    collect_leaves_under(fc, far_leaves);
                std::vector<OctreeNode*> near_src_leaves;
                near_src_leaves.reserve(src_leaves.size() / 2);
                for (OctreeNode* src_leaf : src_leaves)
                    if (far_leaves.count(src_leaf) == 0)
                        near_src_leaves.push_back(src_leaf);
                for (size_t ii0 = 0; ii0 < indices.size(); ii0 += RECEIVER_BLOCK) {
                    size_t ii1 = ii0 + RECEIVER_BLOCK;
                    if (ii1 > indices.size()) ii1 = indices.size();
                    for (size_t ii = ii0; ii < ii1; ii++) {
                        size_t ri = indices[ii];
                        const AMFMReceiver& rec = receivers[ri];
                        double gz = 0.0;
                        for (OctreeNode* src_leaf : near_src_leaves)
                            gz += direct_sum_sources(rec.position.x, rec.position.y, rec.position.z,
                                src_leaf->sources.data(), src_leaf->sources.size());
                        results_local[t][ri] = gz;
                    }
                }
            }
        }));
    }
    for (size_t t = 0; t < threads.size(); t++)
        threads[t].join();

    for (size_t i = 0; i < M; i++)
        for (unsigned int t = 0; t < n_threads; t++)
            results[i] += results_local[t][i];

    return results;
}

} // namespace AMFMNearField
