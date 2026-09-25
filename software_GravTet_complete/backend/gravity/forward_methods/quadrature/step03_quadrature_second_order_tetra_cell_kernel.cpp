#include "step01_quadrature_second_order_types_and_api.h"
#include "quadrature_second_order_detail.h"
#include "../../common/gravity_constants.hpp"

#include <cmath>

namespace {
constexpr double G = gravity::physical::GRAVITATIONAL_CONSTANT;
constexpr double R2_MIN = gravity::physical::R2_SOFTENING_MIN;
}

double compute_gz_tetra_quadrature(const Receiver& receiver, const TetraCell& cell) {
    quadrature_second_order::detail::QuadPoint q[4];
    quadrature_second_order::detail::tetra_quadrature_points(cell, q);

    double gz = 0.0;
    for (const auto& p : q) {
        // Keep same sign convention style as existing backend kernels:
        // dz = receiver.z - source.z
        const double dx = receiver.x - p.x;
        const double dy = receiver.y - p.y;
        const double dz = receiver.z - p.z;
        const double r2 = dx * dx + dy * dy + dz * dz;
        if (r2 < R2_MIN) {
            continue;
        }
        const double r = std::sqrt(r2);
        const double r3 = r2 * r;

        // Piecewise-constant density within one tetra cell:
        // rho_{j,m} = rho_j for m = 1..4.
        gz += G * (cell.density * p.weight) * (dz / r3);
    }
    return gz;
}

