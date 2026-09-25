#include "quadrature_second_order_detail.h"

#include <cmath>

namespace {
// Precomputed Hammer-rule constants:
// a = (5 + 3*sqrt(5))/20, b = (5 - sqrt(5))/20
constexpr double A_HAMMER = 0.5854101966249685;
constexpr double B_HAMMER = 0.1381966011250105;
}

namespace quadrature_second_order {
namespace detail {

double tetra_volume(const TetraCell& cell) {
    const double ax = cell.x2 - cell.x1;
    const double ay = cell.y2 - cell.y1;
    const double az = cell.z2 - cell.z1;

    const double bx = cell.x3 - cell.x1;
    const double by = cell.y3 - cell.y1;
    const double bz = cell.z3 - cell.z1;

    const double cx = cell.x4 - cell.x1;
    const double cy = cell.y4 - cell.y1;
    const double cz = cell.z4 - cell.z1;

    const double cross_x = ay * bz - az * by;
    const double cross_y = az * bx - ax * bz;
    const double cross_z = ax * by - ay * bx;

    const double triple = cross_x * cx + cross_y * cy + cross_z * cz;
    return std::abs(triple) / 6.0;
}

void tetra_quadrature_points(const TetraCell& cell, QuadPoint out_points[4]) {
    const double v = tetra_volume(cell);
    const double w = v * 0.25;

    out_points[0].x = A_HAMMER * cell.x1 + B_HAMMER * cell.x2 + B_HAMMER * cell.x3 + B_HAMMER * cell.x4;
    out_points[0].y = A_HAMMER * cell.y1 + B_HAMMER * cell.y2 + B_HAMMER * cell.y3 + B_HAMMER * cell.y4;
    out_points[0].z = A_HAMMER * cell.z1 + B_HAMMER * cell.z2 + B_HAMMER * cell.z3 + B_HAMMER * cell.z4;
    out_points[0].weight = w;

    out_points[1].x = B_HAMMER * cell.x1 + A_HAMMER * cell.x2 + B_HAMMER * cell.x3 + B_HAMMER * cell.x4;
    out_points[1].y = B_HAMMER * cell.y1 + A_HAMMER * cell.y2 + B_HAMMER * cell.y3 + B_HAMMER * cell.y4;
    out_points[1].z = B_HAMMER * cell.z1 + A_HAMMER * cell.z2 + B_HAMMER * cell.z3 + B_HAMMER * cell.z4;
    out_points[1].weight = w;

    out_points[2].x = B_HAMMER * cell.x1 + B_HAMMER * cell.x2 + A_HAMMER * cell.x3 + B_HAMMER * cell.x4;
    out_points[2].y = B_HAMMER * cell.y1 + B_HAMMER * cell.y2 + A_HAMMER * cell.y3 + B_HAMMER * cell.y4;
    out_points[2].z = B_HAMMER * cell.z1 + B_HAMMER * cell.z2 + A_HAMMER * cell.z3 + B_HAMMER * cell.z4;
    out_points[2].weight = w;

    out_points[3].x = B_HAMMER * cell.x1 + B_HAMMER * cell.x2 + B_HAMMER * cell.x3 + A_HAMMER * cell.x4;
    out_points[3].y = B_HAMMER * cell.y1 + B_HAMMER * cell.y2 + B_HAMMER * cell.y3 + A_HAMMER * cell.y4;
    out_points[3].z = B_HAMMER * cell.z1 + B_HAMMER * cell.z2 + B_HAMMER * cell.z3 + A_HAMMER * cell.z4;
    out_points[3].weight = w;
}

} // namespace detail
} // namespace quadrature_second_order

