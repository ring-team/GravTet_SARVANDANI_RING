/**
 * Step 12 — SIMD acceleration for the inner source loop (AVX2 on x86, NEON on ARM).
 * Scalar tail and DIRECT_NEWTON_SCALAR_ONLY builds delegate to Step 08.
 */

#include "direct_newton_detail.h"
#include "direct_newton_const.h"
#include <cmath>
#include <cstddef>

#if defined(__AVX2__)
#include <immintrin.h>
#endif
#if defined(__aarch64__) || defined(__ARM_NEON)
#include <arm_neon.h>
#endif

namespace direct_newton {
namespace detail {

using namespace consts;

#if defined(__AVX2__)
static inline double gz_avx2_loop(double rx, double ry, double rz, const Source* __restrict__ sources, std::size_t n) {
    const __m256d vr_x = _mm256_set1_pd(rx);
    const __m256d vr_y = _mm256_set1_pd(ry);
    const __m256d vr_z = _mm256_set1_pd(rz);
    const __m256d vG = _mm256_set1_pd(G);
    const __m256d veps = _mm256_set1_pd(R2_MIN);

    __m256d vgz = _mm256_setzero_pd();
    const std::size_t stride = sizeof(Source) / sizeof(double);  // 5

    for (std::size_t i = 0; i + 4 <= n; i += 4) {
        const double* base = reinterpret_cast<const double*>(&sources[i]);
        __m256i idx = _mm256_set_epi64x(3 * stride, 2 * stride, stride, 0);
        __m256d vx = _mm256_i64gather_pd(base, idx, 8);
        idx = _mm256_set_epi64x(3 * stride + 1, 2 * stride + 1, stride + 1, 1);
        __m256d vy = _mm256_i64gather_pd(base, idx, 8);
        idx = _mm256_set_epi64x(3 * stride + 2, 2 * stride + 2, stride + 2, 2);
        __m256d vz = _mm256_i64gather_pd(base, idx, 8);
        idx = _mm256_set_epi64x(3 * stride + 3, 2 * stride + 3, stride + 3, 3);
        __m256d vd = _mm256_i64gather_pd(base, idx, 8);
        idx = _mm256_set_epi64x(3 * stride + 4, 2 * stride + 4, stride + 4, 4);
        __m256d vvol = _mm256_i64gather_pd(base, idx, 8);

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
    return _mm_cvtsd_f64(sum2);
}
#endif

#if defined(__aarch64__) || defined(__ARM_NEON)
static inline double gz_neon_loop(double rx, double ry, double rz, const Source* __restrict__ sources, std::size_t n) {
    float64x2_t vr_x = vdupq_n_f64(rx);
    float64x2_t vr_y = vdupq_n_f64(ry);
    float64x2_t vr_z = vdupq_n_f64(rz);
    float64x2_t vG = vdupq_n_f64(G);
    float64x2_t veps = vdupq_n_f64(R2_MIN);

    float64x2_t vgz = vdupq_n_f64(0.0);

    for (std::size_t i = 0; i + 2 <= n; i += 2) {
        const Source& s0 = sources[i];
        const Source& s1 = sources[i + 1];
        double xy[2] = {s0.x, s1.x};
        double yy[2] = {s0.y, s1.y};
        double zy[2] = {s0.z, s1.z};
        double my[2] = {s0.density * s0.volume, s1.density * s1.volume};
        float64x2_t vx = vld1q_f64(xy);
        float64x2_t vy = vld1q_f64(yy);
        float64x2_t vz = vld1q_f64(zy);
        float64x2_t vmass = vld1q_f64(my);

        float64x2_t vdx = vsubq_f64(vr_x, vx);
        float64x2_t vdy = vsubq_f64(vr_y, vy);
        float64x2_t vdz = vsubq_f64(vr_z, vz);

        float64x2_t vr2 =
            vaddq_f64(vmulq_f64(vdx, vdx), vaddq_f64(vmulq_f64(vdy, vdy), vmulq_f64(vdz, vdz)));
        uint64x2_t mask = vcgtq_f64(vr2, veps);

        float64x2_t vr3 = vmulq_f64(vr2, vsqrtq_f64(vr2));
        float64x2_t vcontrib = vmulq_f64(vG, vdivq_f64(vmulq_f64(vmass, vdz), vr3));
        vcontrib = vreinterpretq_f64_u64(vandq_u64(vreinterpretq_u64_f64(vcontrib), mask));
        vgz = vaddq_f64(vgz, vcontrib);
    }

    return vgetq_lane_f64(vgz, 0) + vgetq_lane_f64(vgz, 1);
}
#endif

double gz_simd_accumulate_sources(double rx, double ry, double rz, const Source* __restrict__ sources, std::size_t n) {
#if defined(DIRECT_NEWTON_SCALAR_ONLY)
    return gz_scalar_loop(rx, ry, rz, sources, n);
#elif defined(__AVX2__)
    const std::size_t simd_end = (n / 4) * 4;
    double gz = gz_avx2_loop(rx, ry, rz, sources, simd_end);
    if (simd_end < n) gz += gz_scalar_loop(rx, ry, rz, sources + simd_end, n - simd_end);
    return gz;
#elif defined(__aarch64__) || defined(__ARM_NEON)
    const std::size_t simd_end = (n / 2) * 2;
    double gz = gz_neon_loop(rx, ry, rz, sources, simd_end);
    if (simd_end < n) gz += gz_scalar_loop(rx, ry, rz, sources + simd_end, n - simd_end);
    return gz;
#else
    return gz_scalar_loop(rx, ry, rz, sources, n);
#endif
}

} // namespace detail
} // namespace direct_newton

