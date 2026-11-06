#include "step01_quadrature_second_order_types_and_api.h"
#include "quadrature_second_order_detail.h"
#include "../../common/gravity_constants.hpp"

#include <cmath>

namespace {
constexpr double G = gravity::physical::GRAVITATIONAL_CONSTANT;
constexpr double R2_MIN = gravity::physical::R2_SOFTENING_MIN;
}

namespace quadrature_second_order {
namespace detail {

std::vector<PreparedTetra> prepare_tetra_cells(const std::vector<TetraCell>& cells) {
    std::vector<PreparedTetra> prepared(cells.size());
    for (std::size_t i = 0; i < cells.size(); ++i) {
        QuadPoint q[4];
        tetra_quadrature_points(cells[i], q);
        for (int m = 0; m < 4; ++m) {
            prepared[i].qx[m] = q[m].x;
            prepared[i].qy[m] = q[m].y;
            prepared[i].qz[m] = q[m].z;
            prepared[i].rho_w[m] = cells[i].density * q[m].weight;
        }
    }
    return prepared;
}

double gz_scalar_prepared_range(const Receiver& receiver, const std::vector<PreparedTetra>& prepared,
                                std::size_t start, std::size_t end) {
    double gz = 0.0;
    for (std::size_t i = start; i < end; ++i) {
        const PreparedTetra& t = prepared[i];
        for (int m = 0; m < 4; ++m) {
            const double dx = receiver.x - t.qx[m];
            const double dy = receiver.y - t.qy[m];
            const double dz = receiver.z - t.qz[m];
            const double r2 = dx * dx + dy * dy + dz * dz;
            if (r2 < R2_MIN) {
                continue;
            }
            const double r = std::sqrt(r2);
            const double r3 = r2 * r;
            gz += G * t.rho_w[m] * (dz / r3);
        }
    }
    return gz;
}

double gz_scalar_prepared_one(const Receiver& receiver, const std::vector<PreparedTetra>& prepared) {
    return gz_scalar_prepared_range(receiver, prepared, 0, prepared.size());
}

} // namespace detail
} // namespace quadrature_second_order

double compute_gz_quadrature(const Receiver& receiver, const std::vector<TetraCell>& cells) {
    const auto prepared = quadrature_second_order::detail::prepare_tetra_cells(cells);
    return quadrature_second_order::detail::gz_scalar_prepared_one(receiver, prepared);
}

