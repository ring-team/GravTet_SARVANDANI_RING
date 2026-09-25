// Step 04 — Barnes-Hut NEAR-FIELD direct (pairwise) summation kernel.
//
// Why not a shared function with the brute-force pairwise solver?
// - The brute-force solver loops over contiguous source arrays.
// - Barnes-Hut leaf nodes hold source indices (sparse/gather access).
// So this file keeps the same physics/kernel formula and SIMD pattern,
// adapted to index-based leaf traversal.
#include "../../common/gravity_constants.hpp"
#include "barnes_hut_detail.h"
#include <cmath>

#if defined(__AVX2__)
#include <immintrin.h>
#endif
#if defined(__aarch64__) || defined(__ARM_NEON)
#include <arm_neon.h>
#endif

namespace {
constexpr double G = gravity::physical::GRAVITATIONAL_CONSTANT;
constexpr double R2_MIN = gravity::physical::R2_SOFTENING_MIN;

double direct_sum_from_indices_scalar(
    double rx,
    double ry,
    double rz,
    const Source* __restrict__ sources,
    const size_t* __restrict__ indices,
    size_t n
) {
    double gz = 0;
    for (size_t k = 0; k < n; k++) {
        const Source& s = sources[indices[k]];
        double dx = rx - s.x;
        double dy = ry - s.y;
        double dz = rz - s.z;
        double r2 = dx * dx + dy * dy + dz * dz;
        if (r2 < R2_MIN) continue;
        double r3 = std::pow(r2, 1.5);
        double m = s.density * s.volume;
        gz += G * m * dz / r3;
    }
    return gz;
}

#if !defined(BARNES_HUT_SCALAR_ONLY) && defined(__AVX2__)
double direct_sum_from_indices_avx2(
    double rx,
    double ry,
    double rz,
    const Source* __restrict__ sources,
    const size_t* __restrict__ indices,
    size_t n
) {
    const double* base = reinterpret_cast<const double*>(sources);
    constexpr size_t stride = sizeof(Source) / sizeof(double);
    const __m256d vr_x = _mm256_set1_pd(rx);
    const __m256d vr_y = _mm256_set1_pd(ry);
    const __m256d vr_z = _mm256_set1_pd(rz);
    const __m256d vG = _mm256_set1_pd(G);
    const __m256d veps = _mm256_set1_pd(R2_MIN);
    __m256d vgz = _mm256_setzero_pd();
    size_t k = 0;
    for (; k + 4 <= n; k += 4) {
        __m256i voff = _mm256_set_epi64x(
            static_cast<long long>(indices[k + 3] * stride),
            static_cast<long long>(indices[k + 2] * stride),
            static_cast<long long>(indices[k + 1] * stride),
            static_cast<long long>(indices[k + 0] * stride)
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
    if (k < n) gz += direct_sum_from_indices_scalar(rx, ry, rz, sources, indices + k, n - k);
    return gz;
}
#endif

#if !defined(BARNES_HUT_SCALAR_ONLY) && (defined(__aarch64__) || defined(__ARM_NEON))
double direct_sum_from_indices_neon(
    double rx,
    double ry,
    double rz,
    const Source* __restrict__ sources,
    const size_t* __restrict__ indices,
    size_t n
) {
    float64x2_t vr_x = vdupq_n_f64(rx);
    float64x2_t vr_y = vdupq_n_f64(ry);
    float64x2_t vr_z = vdupq_n_f64(rz);
    float64x2_t vG = vdupq_n_f64(G);
    float64x2_t veps = vdupq_n_f64(R2_MIN);
    float64x2_t vgz = vdupq_n_f64(0.0);
    size_t k = 0;
    for (; k + 2 <= n; k += 2) {
        const Source& s0 = sources[indices[k]];
        const Source& s1 = sources[indices[k + 1]];
        double xs[2] = {s0.x, s1.x};
        double ys[2] = {s0.y, s1.y};
        double zs[2] = {s0.z, s1.z};
        double ms[2] = {s0.density * s0.volume, s1.density * s1.volume};
        float64x2_t vx = vld1q_f64(xs);
        float64x2_t vy = vld1q_f64(ys);
        float64x2_t vz = vld1q_f64(zs);
        float64x2_t vm = vld1q_f64(ms);
        float64x2_t vdx = vsubq_f64(vr_x, vx);
        float64x2_t vdy = vsubq_f64(vr_y, vy);
        float64x2_t vdz = vsubq_f64(vr_z, vz);
        float64x2_t vr2 = vaddq_f64(vmulq_f64(vdx, vdx), vaddq_f64(vmulq_f64(vdy, vdy), vmulq_f64(vdz, vdz)));
        uint64x2_t mask = vcgtq_f64(vr2, veps);
        float64x2_t vr3 = vmulq_f64(vr2, vsqrtq_f64(vr2));
        float64x2_t vcontrib = vmulq_f64(vG, vdivq_f64(vmulq_f64(vm, vdz), vr3));
        vcontrib = vreinterpretq_f64_u64(vandq_u64(vreinterpretq_u64_f64(vcontrib), mask));
        vgz = vaddq_f64(vgz, vcontrib);
    }
    double gz = vgetq_lane_f64(vgz, 0) + vgetq_lane_f64(vgz, 1);
    if (k < n) gz += direct_sum_from_indices_scalar(rx, ry, rz, sources, indices + k, n - k);
    return gz;
}
#endif
} // namespace

namespace barnes_hut {
namespace detail {

double compute_gz_near_field_leaf(
    double rx,
    double ry,
    double rz,
    const OctreeNode* leaf,
    const std::vector<Source>& sources
) {
    const size_t n = leaf->source_indices.size();
    if (n == 0) return 0;
    const Source* src = sources.data();
    const size_t* idx = leaf->source_indices.data();
#if !defined(BARNES_HUT_SCALAR_ONLY) && defined(__AVX2__)
    if (n >= 4) return direct_sum_from_indices_avx2(rx, ry, rz, src, idx, n);
#elif !defined(BARNES_HUT_SCALAR_ONLY) && (defined(__aarch64__) || defined(__ARM_NEON))
    if (n >= 2) return direct_sum_from_indices_neon(rx, ry, rz, src, idx, n);
#endif
    return direct_sum_from_indices_scalar(rx, ry, rz, src, idx, n);
}

} // namespace detail
} // namespace barnes_hut
