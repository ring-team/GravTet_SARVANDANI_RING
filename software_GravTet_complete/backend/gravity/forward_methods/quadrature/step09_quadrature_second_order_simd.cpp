#include "quadrature_second_order_detail.h"
#include "../../common/gravity_constants.hpp"

#include <cmath>

#if defined(__x86_64__)
#include <immintrin.h>
#endif
#if defined(__aarch64__) || defined(__ARM_NEON)
#include <arm_neon.h>
#endif

extern "C" int quadrature_simd_supports(int lanes) {
#if defined(QUADRATURE_SECOND_ORDER_SCALAR_ONLY)
    return lanes == 1;
#elif defined(__x86_64__) && (defined(__GNUC__) || defined(__clang__))
    __builtin_cpu_init();
    if (lanes == 2) return __builtin_cpu_supports("sse2");
    if (lanes == 4) return __builtin_cpu_supports("avx2");
    if (lanes == 8) return __builtin_cpu_supports("avx512f");
    return lanes == 1;
#elif defined(__aarch64__) || defined(__ARM_NEON)
    return lanes == 1 || lanes == 2;
#else
    return lanes == 1;
#endif
}
extern "C" int quadrature_simd_lanes() {
    for (int lanes : {8, 4, 2}) if (quadrature_simd_supports(lanes)) return lanes;
    return 1;
}

namespace {
constexpr double G = gravity::physical::GRAVITATIONAL_CONSTANT;
constexpr double R2_MIN = gravity::physical::R2_SOFTENING_MIN;
}

namespace quadrature_second_order {
namespace detail {

#if defined(__x86_64__) && (defined(__GNUC__) || defined(__clang__))
__attribute__((target("sse2")))
static double gz_x86_2(const Receiver& receiver, const std::vector<PreparedTetra>& prepared,
                         std::size_t start, std::size_t end) {
    double result = 0.0;
    // A batch contains consecutive quadrature points, including across tetrahedra.
    for (std::size_t offset = start * 4; offset < end * 4; offset += 2) {
        double x[2] = {}, y[2] = {}, z[2] = {}, mass[2] = {};
        for (int lane = 0; lane < 2; ++lane) {
            const std::size_t point = offset + lane;
            if (point >= end * 4) continue;
            const auto& t = prepared[point / 4];
            const int m = point % 4;
            x[lane] = t.qx[m]; y[lane] = t.qy[m]; z[lane] = t.qz[m]; mass[lane] = t.rho_w[m];
        }
        const __m128d dx = _mm_sub_pd(_mm_set1_pd(receiver.x), _mm_loadu_pd(x));
        const __m128d dy = _mm_sub_pd(_mm_set1_pd(receiver.y), _mm_loadu_pd(y));
        const __m128d dz = _mm_sub_pd(_mm_set1_pd(receiver.z), _mm_loadu_pd(z));
        const __m128d r2 = _mm_add_pd(_mm_mul_pd(dx,dx), _mm_add_pd(_mm_mul_pd(dy,dy), _mm_mul_pd(dz,dz)));
        const __m128d safe = _mm_max_pd(r2, _mm_set1_pd(R2_MIN));
        const __m128d r3 = _mm_mul_pd(safe, _mm_sqrt_pd(safe));
        const __m128d v = _mm_mul_pd(_mm_set1_pd(G), _mm_div_pd(_mm_mul_pd(_mm_loadu_pd(mass), dz), r3));
        double contributions[2], distances[2];
        _mm_storeu_pd(contributions, v); _mm_storeu_pd(distances, r2);
        for (int lane = 0; lane < 2 && offset + lane < end * 4; ++lane)
            if (distances[lane] > R2_MIN) result += contributions[lane];
    }
    return result;
}
__attribute__((target("avx2")))
static double gz_x86_4(const Receiver& receiver, const std::vector<PreparedTetra>& prepared,
                         std::size_t start, std::size_t end) {
    double result = 0.0;
    // A batch contains consecutive quadrature points, including across tetrahedra.
    for (std::size_t offset = start * 4; offset < end * 4; offset += 4) {
        double x[4] = {}, y[4] = {}, z[4] = {}, mass[4] = {};
        for (int lane = 0; lane < 4; ++lane) {
            const std::size_t point = offset + lane;
            if (point >= end * 4) continue;
            const auto& t = prepared[point / 4];
            const int m = point % 4;
            x[lane] = t.qx[m]; y[lane] = t.qy[m]; z[lane] = t.qz[m]; mass[lane] = t.rho_w[m];
        }
        const __m256d dx = _mm256_sub_pd(_mm256_set1_pd(receiver.x), _mm256_loadu_pd(x));
        const __m256d dy = _mm256_sub_pd(_mm256_set1_pd(receiver.y), _mm256_loadu_pd(y));
        const __m256d dz = _mm256_sub_pd(_mm256_set1_pd(receiver.z), _mm256_loadu_pd(z));
        const __m256d r2 = _mm256_add_pd(_mm256_mul_pd(dx,dx), _mm256_add_pd(_mm256_mul_pd(dy,dy), _mm256_mul_pd(dz,dz)));
        const __m256d safe = _mm256_max_pd(r2, _mm256_set1_pd(R2_MIN));
        const __m256d r3 = _mm256_mul_pd(safe, _mm256_sqrt_pd(safe));
        const __m256d v = _mm256_mul_pd(_mm256_set1_pd(G), _mm256_div_pd(_mm256_mul_pd(_mm256_loadu_pd(mass), dz), r3));
        double contributions[4], distances[4];
        _mm256_storeu_pd(contributions, v); _mm256_storeu_pd(distances, r2);
        for (int lane = 0; lane < 4 && offset + lane < end * 4; ++lane)
            if (distances[lane] > R2_MIN) result += contributions[lane];
    }
    return result;
}
__attribute__((target("avx512f")))
static double gz_x86_8(const Receiver& receiver, const std::vector<PreparedTetra>& prepared,
                         std::size_t start, std::size_t end) {
    double result = 0.0;
    // A batch contains consecutive quadrature points, including across tetrahedra.
    for (std::size_t offset = start * 4; offset < end * 4; offset += 8) {
        double x[8] = {}, y[8] = {}, z[8] = {}, mass[8] = {};
        for (int lane = 0; lane < 8; ++lane) {
            const std::size_t point = offset + lane;
            if (point >= end * 4) continue;
            const auto& t = prepared[point / 4];
            const int m = point % 4;
            x[lane] = t.qx[m]; y[lane] = t.qy[m]; z[lane] = t.qz[m]; mass[lane] = t.rho_w[m];
        }
        const __m512d dx = _mm512_sub_pd(_mm512_set1_pd(receiver.x), _mm512_loadu_pd(x));
        const __m512d dy = _mm512_sub_pd(_mm512_set1_pd(receiver.y), _mm512_loadu_pd(y));
        const __m512d dz = _mm512_sub_pd(_mm512_set1_pd(receiver.z), _mm512_loadu_pd(z));
        const __m512d r2 = _mm512_add_pd(_mm512_mul_pd(dx,dx), _mm512_add_pd(_mm512_mul_pd(dy,dy), _mm512_mul_pd(dz,dz)));
        const __m512d safe = _mm512_max_pd(r2, _mm512_set1_pd(R2_MIN));
        const __m512d r3 = _mm512_mul_pd(safe, _mm512_sqrt_pd(safe));
        const __m512d v = _mm512_mul_pd(_mm512_set1_pd(G), _mm512_div_pd(_mm512_mul_pd(_mm512_loadu_pd(mass), dz), r3));
        double contributions[8], distances[8];
        _mm512_storeu_pd(contributions, v); _mm512_storeu_pd(distances, r2);
        for (int lane = 0; lane < 8 && offset + lane < end * 4; ++lane)
            if (distances[lane] > R2_MIN) result += contributions[lane];
    }
    return result;
}
#endif

#if defined(__aarch64__) || defined(__ARM_NEON)
static inline double gz_simd_one_tetra_neon(const Receiver& receiver, const PreparedTetra& t) {
    const float64x2_t vrx = vdupq_n_f64(receiver.x);
    const float64x2_t vry = vdupq_n_f64(receiver.y);
    const float64x2_t vrz = vdupq_n_f64(receiver.z);
    const float64x2_t vG = vdupq_n_f64(G);
    const float64x2_t veps = vdupq_n_f64(R2_MIN);

    float64x2_t acc = vdupq_n_f64(0.0);
    for (int o = 0; o < 4; o += 2) {
        const float64x2_t vqx = vld1q_f64(&t.qx[o]);
        const float64x2_t vqy = vld1q_f64(&t.qy[o]);
        const float64x2_t vqz = vld1q_f64(&t.qz[o]);
        const float64x2_t vrho_w = vld1q_f64(&t.rho_w[o]);

        const float64x2_t vdx = vsubq_f64(vrx, vqx);
        const float64x2_t vdy = vsubq_f64(vry, vqy);
        const float64x2_t vdz = vsubq_f64(vrz, vqz);
        const float64x2_t vr2 = vaddq_f64(vmulq_f64(vdx, vdx), vaddq_f64(vmulq_f64(vdy, vdy), vmulq_f64(vdz, vdz)));
        const uint64x2_t mask = vcgtq_f64(vr2, veps);
        const float64x2_t vr3 = vmulq_f64(vr2, vsqrtq_f64(vr2));
        float64x2_t vcontrib = vmulq_f64(vG, vdivq_f64(vmulq_f64(vrho_w, vdz), vr3));
        vcontrib = vreinterpretq_f64_u64(vandq_u64(vreinterpretq_u64_f64(vcontrib), mask));
        acc = vaddq_f64(acc, vcontrib);
    }
    return vgetq_lane_f64(acc, 0) + vgetq_lane_f64(acc, 1);
}
#endif

double gz_simd_prepared_range(const Receiver& receiver, const std::vector<PreparedTetra>& prepared,
                              std::size_t start, std::size_t end, int simd_lanes) {
    const int lanes = simd_lanes == 0 ? quadrature_simd_lanes() : simd_lanes;
#if !defined(QUADRATURE_SECOND_ORDER_SCALAR_ONLY)
#if defined(__x86_64__) && (defined(__GNUC__) || defined(__clang__))
    if (lanes == 8) return gz_x86_8(receiver, prepared, start, end);
    if (lanes == 4) return gz_x86_4(receiver, prepared, start, end);
    if (lanes == 2) return gz_x86_2(receiver, prepared, start, end);
#elif defined(__aarch64__) || defined(__ARM_NEON)
    if (lanes == 2) {
        double gz = 0.0;
        for (std::size_t i = start; i < end; ++i) gz += gz_simd_one_tetra_neon(receiver, prepared[i]);
        return gz;
    }
#endif
#endif
    return gz_scalar_prepared_range(receiver, prepared, start, end);
}

double receiver_gz_dispatch(const Receiver& receiver, const std::vector<PreparedTetra>& prepared,
                           std::size_t start, std::size_t end, int simd_lanes) {
    return gz_simd_prepared_range(receiver, prepared, start, end, simd_lanes);
}

} // namespace detail
} // namespace quadrature_second_order
