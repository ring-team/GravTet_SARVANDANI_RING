#include "quadrature_second_order_detail.h"

#include <algorithm>
#include <cmath>
namespace {
constexpr double PI = 3.14159265358979323846;

double hash01(int idx, int salt) {
    const double n = std::sin((idx + 1) * 127.1 + salt * 311.7) * 43758.5453123;
    return n - std::floor(n);
}

double valley_mountain_display_relief_x(
    double x_rel,
    double size_x,
    double mountain_height,
    double valley_depth
) {
    const double mountain_center = -0.22 * size_x;
    const double valley_center = 0.24 * size_x;
    const double mountain_sigma = std::max(1e-9, 0.16 * size_x);
    const double valley_sigma = std::max(1e-9, 0.17 * size_x);
    const double mountain = mountain_height * std::exp(
        -((x_rel - mountain_center) * (x_rel - mountain_center)) /
        (2.0 * mountain_sigma * mountain_sigma)
    );
    const double valley = valley_depth * std::exp(
        -((x_rel - valley_center) * (x_rel - valley_center)) /
        (2.0 * valley_sigma * valley_sigma)
    );
    return mountain - valley;
}

void jitter_vertex(double& x, double& y, double& z, int id, double amp) {
    x += (hash01(id, 17) - 0.5) * amp;
    y += (hash01(id, 43) - 0.5) * amp;
    z += (hash01(id, 97) - 0.5) * amp;
}

void append_five_tetra_from_cell(
    double x0, double x1,
    double y0, double y1,
    double z0, double z1,
    double density,
    std::vector<TetraCell>& out
) {
    // 5-tet decomposition matching existing tetra source strategy.
    TetraCell t1{x0,y0,z0, x1,y0,z0, x0,y1,z0, x0,y0,z1, density};
    TetraCell t2{x1,y1,z0, x1,y0,z0, x0,y1,z0, x1,y1,z1, density};
    TetraCell t3{x1,y0,z1, x1,y0,z0, x0,y0,z1, x1,y1,z1, density};
    TetraCell t4{x0,y1,z1, x0,y1,z0, x0,y0,z1, x1,y1,z1, density};
    TetraCell t5{x0,y0,z1, x1,y0,z1, x0,y1,z1, x1,y1,z1, density};
    out.push_back(t1);
    out.push_back(t2);
    out.push_back(t3);
    out.push_back(t4);
    out.push_back(t5);
}

void append_grid(
    double cx, double cy, double cz,
    double sx, double sy, double sz,
    double density,
    int nx, int ny, int nz,
    std::vector<TetraCell>& out
) {
    const int ix = std::max(1, nx);
    const int iy = std::max(1, ny);
    const int iz = std::max(1, nz);
    const double dx = sx / ix;
    const double dy = sy / iy;
    const double dz = sz / iz;
    const double x_start = cx - sx * 0.5;
    const double y_start = cy - sy * 0.5;
    const double z_start = cz - sz * 0.5;
    for (int i = 0; i < ix; ++i) {
        for (int j = 0; j < iy; ++j) {
            for (int k = 0; k < iz; ++k) {
                const double x0 = x_start + i * dx;
                const double y0 = y_start + j * dy;
                const double z0 = z_start + k * dz;
                append_five_tetra_from_cell(x0, x0 + dx, y0, y0 + dy, z0, z0 + dz, density, out);
            }
        }
    }
}

void apply_unstructured_jitter(std::vector<TetraCell>& cells, double strength) {
    if (cells.empty()) return;
    double amp = 0.01 * strength;
    int id = 0;
    for (auto& c : cells) {
        jitter_vertex(c.x1, c.y1, c.z1, id++, amp);
        jitter_vertex(c.x2, c.y2, c.z2, id++, amp);
        jitter_vertex(c.x3, c.y3, c.z3, id++, amp);
        jitter_vertex(c.x4, c.y4, c.z4, id++, amp);
    }
}

/** Cell centroid; used for primitive clipping so boundary tets do not hang outside the analytic surface. */
void tetra_centroid(const TetraCell& t, double& ox, double& oy, double& oz) {
    ox = 0.25 * (t.x1 + t.x2 + t.x3 + t.x4);
    oy = 0.25 * (t.y1 + t.y2 + t.y3 + t.y4);
    oz = 0.25 * (t.z1 + t.z2 + t.z3 + t.z4);
}

double total_volume(const std::vector<TetraCell>& cells) {
    double v = 0.0;
    for (const auto& c : cells) {
        v += quadrature_second_order::detail::tetra_volume(c);
    }
    return v;
}

void scale_density_for_target_mass(std::vector<TetraCell>& cells, double target_volume) {
    if (cells.empty() || target_volume <= 0.0) return;
    const double current_volume = total_volume(cells);
    if (current_volume <= 1e-30) return;
    const double scale = target_volume / current_volume;
    for (auto& c : cells) c.density *= scale;
}

} // namespace

namespace quadrature_second_order {
namespace detail {

bool generate_unstructured_tetra_cells_from_params(const QuadratureModelParams* params,
                                                   std::vector<TetraCell>& cells) {
    if (!params || !is_unstructured_tetra_model_type(params->model_type)) {
        return false;
    }

    // Local copy so catalog IDs (55–63) match the QUAD_MODEL_* branches below.
    QuadratureModelParams local = *params;
    switch (local.model_type) {
        case 55: local.model_type = QUAD_MODEL_CUBE_UNSTRUCTURED_TETRAHEDRAL; break;
        case 56: local.model_type = QUAD_MODEL_CUBOID_UNSTRUCTURED_TETRAHEDRAL; break;
        case 57: local.model_type = QUAD_MODEL_SPHERE_UNSTRUCTURED_TETRAHEDRAL; break;
        case 58: local.model_type = QUAD_MODEL_ELLIPSOID_UNSTRUCTURED_TETRAHEDRAL; break;
        case 59: local.model_type = QUAD_MODEL_VERTICAL_CYLINDER_UNSTRUCTURED_TETRAHEDRAL; break;
        case 60: local.model_type = QUAD_MODEL_HORIZONTAL_CYLINDER_UNSTRUCTURED_TETRAHEDRAL; break;
        case 61: local.model_type = QUAD_MODEL_FAULTED_BLOCK_UNSTRUCTURED_TETRAHEDRAL; break;
        case 62: local.model_type = QUAD_MODEL_VALLEY_MOUNTAIN_UNSTRUCTURED_TETRAHEDRAL; break;
        case 63: local.model_type = QUAD_MODEL_FOUR_CUBES_UNSTRUCTURED_TETRAHEDRAL; break;
        default: break;
    }
    params = &local;

    cells.clear();
    const int nx = std::max(1, params->num_sources_x);
    const int ny = std::max(1, params->num_sources_y);
    const int nz = std::max(1, params->num_sources_z);

    auto append_grid_local = [&](double cx, double cy, double cz, double sx, double sy, double sz, double density) {
        append_grid(cx, cy, cz, sx, sy, sz, density, nx, ny, nz, cells);
    };

    if (params->model_type == QUAD_MODEL_VALLEY_MOUNTAIN_UNSTRUCTURED_TETRAHEDRAL) {
        // Mirror generate_layered_basin_sources_hexahedral (Direct Newton reference).
        const double sx = std::max(1e-12, params->size_x);
        const double sy = std::max(1e-12, params->size_y);
        const double l1 = params->layer1_thickness;
        const double l2 = params->layer2_thickness;
        const double l3 = params->layer3_thickness;
        const double total_h = std::max(1e-12, l1 + l2 + l3);
        const double dx = sx / nx;
        const double dy = sy / ny;
        const double dz = total_h / nz;

        const double x_start = params->center_x - sx / 2.0 + dx / 2.0;
        const double y_start = params->center_y - sy / 2.0 + dy / 2.0;
        const double z_start = params->center_z - total_h / 2.0 + dz / 2.0;

        const double ld1 = params->layer1_density;
        const double ld2 = params->layer2_density;
        const double ld3 = params->layer3_density;

        const bool valley_relief_mode =
            (ld3 < -0.5) &&
            (ld1 > 0.0) && (ld2 > 0.0);
        if (valley_relief_mode) {
            const double block_z = std::max(1e-9, std::abs(l3));
            const double pad_x = 100.0;
            const double pad_y = 50.0;
            const double pad_z = 30.0;
            const double hs_x = sx + 2.0 * pad_x;
            const double hs_y = sy + 2.0 * pad_y;
            const double hs_z = block_z + pad_z;
            const int nx_hs = std::max(1, static_cast<int>(std::lround(nx * hs_x / sx)));
            const int ny_hs = std::max(1, static_cast<int>(std::lround(ny * hs_y / sy)));
            const int nz_hs = std::max(1, static_cast<int>(std::lround(nz * hs_z / block_z)));
            const double dx_hs = hs_x / nx_hs;
            const double dy_hs = hs_y / ny_hs;
            const double dz_hs = hs_z / nz_hs;
            const double x_min = params->center_x - hs_x * 0.5;
            const double y_min = params->center_y - hs_y * 0.5;
            const double z_min = params->center_z - hs_z * 0.5;
            const double z_ref = params->center_z + block_z * 0.5;
            const double z_surface = 0.0;
            const double ax = sx * 0.5;
            const double ay = sy * 0.5;
            const double mountain_rho = std::abs(ld1);
            const double half_rho = std::abs(ld2);

            for (int i = 0; i < nx_hs; ++i) {
                const double x0 = x_min + i * dx_hs;
                const double x_rel = (x0 + 0.5 * dx_hs) - params->center_x;
                for (int j = 0; j < ny_hs; ++j) {
                    const double y0 = y_min + j * dy_hs;
                    const double y_rel = (y0 + 0.5 * dy_hs) - params->center_y;
                    const bool in_anomaly = std::abs(x_rel) <= ax && std::abs(y_rel) <= ay;
                    const double relief = in_anomaly
                        ? valley_mountain_display_relief_x(x_rel, sx, std::abs(l1), std::abs(l2))
                        : 0.0;
                    const double z_top = z_ref + relief;
                    for (int k = 0; k < nz_hs; ++k) {
                        const double z0_corner = z_min + k * dz_hs;
                        const double z1_corner = z0_corner + dz_hs;
                        const double z_centroid = 0.5 * (z0_corner + z1_corner);
                        if (z_centroid > z_surface + 1e-6 || z_centroid > z_top + 1e-6) {
                            continue;
                        }
                        const double dens = in_anomaly
                            ? ((relief >= 0.0) ? mountain_rho : half_rho)
                            : half_rho;
                        append_five_tetra_from_cell(
                            x0, x0 + dx_hs, y0, y0 + dy_hs, z0_corner, z1_corner, dens, cells
                        );
                    }
                }
            }
            return true;
        }

        const bool valley_sine_topography_mode =
            (ld3 < -0.5) &&
            (ld1 > 0.0) && (ld2 > 0.0);
        const bool valley_fault_style_mode =
            !valley_sine_topography_mode &&
            (std::abs(l3) < 1e-12) &&
            (std::abs(ld3) < 1e-12) &&
            (l1 > 0.0) && (l2 > 0.0) &&
            (ld1 > 0.0) && (ld2 > 0.0);

        for (int i = 0; i < nx; ++i) {
            for (int j = 0; j < ny; ++j) {
                for (int k = 0; k < nz; ++k) {
                    double z = z_start + k * dz;
                    const double depth_from_top = (params->center_z + total_h / 2.0) - z;
                    double dens = (depth_from_top <= l1) ? ld1 :
                                 (depth_from_top <= l1 + l2) ? ld2 : ld3;
                    if (valley_sine_topography_mode) {
                        const double x_rel = (x_start + i * dx) - params->center_x;
                        const double A = 0.5 * (std::abs(l1) + std::abs(l2));
                        const double lambda = std::max(
                            1e-6,
                            params->spacing_x > 0.0 ? params->spacing_x : sx
                        );
                        const double relief = A * std::sin(2.0 * M_PI * x_rel / lambda);
                        dens = (relief >= 0.0) ? std::abs(ld1) : std::abs(ld2);
                    } else if (valley_fault_style_mode) {
                        const double x = x_start + i * dx;
                        dens = (x < params->center_x) ? std::abs(ld1) : std::abs(ld2);
                        z += (x < params->center_x) ? (0.5 * std::abs(l1)) : (-0.5 * std::abs(l2));
                    }
                    const double x0 = params->center_x - sx * 0.5 + i * dx;
                    const double y0 = params->center_y - sy * 0.5 + j * dy;
                    const double z0_corner = z - dz * 0.5;
                    const double z1_corner = z + dz * 0.5;
                    append_five_tetra_from_cell(
                        x0, x0 + dx, y0, y0 + dy, z0_corner, z1_corner, dens, cells
                    );
                }
            }
        }
    } else if (params->model_type == QUAD_MODEL_FOUR_CUBES_UNSTRUCTURED_TETRAHEDRAL) {
        const double positions[4][2] = {
            {-params->spacing_x * 0.5 + params->cube1_offset_x, -params->spacing_y * 0.5 + params->cube1_offset_y},
            { params->spacing_x * 0.5 + params->cube2_offset_x, -params->spacing_y * 0.5 + params->cube2_offset_y},
            {-params->spacing_x * 0.5 + params->cube3_offset_x,  params->spacing_y * 0.5 + params->cube3_offset_y},
            { params->spacing_x * 0.5 + params->cube4_offset_x,  params->spacing_y * 0.5 + params->cube4_offset_y}
        };
        const double dims[4][3] = {
            {params->cube1_x, params->cube1_y, params->cube1_z},
            {params->cube2_x, params->cube2_y, params->cube2_z},
            {params->cube3_x, params->cube3_y, params->cube3_z},
            {params->cube4_x, params->cube4_y, params->cube4_z}
        };
        const double hs[4] = {params->cube1_h, params->cube2_h, params->cube3_h, params->cube4_h};
        const double ds[4] = {params->cube1_density, params->cube2_density, params->cube3_density, params->cube4_density};
        for (int q = 0; q < 4; ++q) {
            const double sx = std::max(1e-9, dims[q][0]);
            const double sy = std::max(1e-9, dims[q][1]);
            const double sz = std::max(1e-9, dims[q][2]);
            const double cx = params->center_x + positions[q][0];
            const double cy = params->center_y + positions[q][1];
            const double cz = params->center_z - hs[q] - sz * 0.5;
            const double density = (std::abs(ds[q]) > 0.0) ? ds[q] : params->density;
            append_grid_local(cx, cy, cz, sx, sy, sz, density);
        }
    } else if (params->model_type == QUAD_MODEL_FAULTED_BLOCK_UNSTRUCTURED_TETRAHEDRAL) {
        // Mirror generate_faulted_block_sources_hexahedral — axis-aligned cells (no vertex shear).
        const double sx = std::max(1e-12, params->size_x);
        const double sy = std::max(1e-12, params->size_y);
        const double sz = std::max(1e-12, params->size_z);
        const double dx = sx / nx;
        const double dy = sy / ny;
        const double dz = sz / nz;
        const double x_start = params->center_x - sx / 2.0 + dx / 2.0;
        const double y_start = params->center_y - sy / 2.0 + dy / 2.0;
        const double z_start = params->center_z - sz / 2.0 + dz / 2.0;
        const double fault = params->fault_offset;
        const double rho = params->density;

        for (int i = 0; i < nx; ++i) {
            const double x = x_start + i * dx;
            const bool left_block = (x < params->center_x);
            for (int j = 0; j < ny; ++j) {
                for (int k = 0; k < nz; ++k) {
                    const double dens = left_block ? rho : (0.7 * rho);
                    const double x0 = params->center_x - sx * 0.5 + i * dx;
                    const double y0 = params->center_y - sy * 0.5 + j * dy;
                    const double z0 = params->center_z - sz * 0.5 + k * dz;
                    const double z1 = z0 + dz;
                    const double z_lo = left_block ? z0 : (z0 - fault);
                    const double z_hi = left_block ? z1 : (z1 - fault);
                    append_five_tetra_from_cell(x0, x0 + dx, y0, y0 + dy, z_lo, z_hi, dens, cells);
                }
            }
        }
    } else {
        const double sx = params->size_x > 0.0 ? params->size_x : (2.0 * params->radius);
        const double sy = params->size_y > 0.0 ? params->size_y : (2.0 * params->radius);
        const double sz = params->size_z > 0.0 ? params->size_z : (2.0 * params->radius);
        append_grid_local(params->center_x, params->center_y, params->center_z, sx, sy, sz, params->density);
    }

    if (params->model_type == QUAD_MODEL_SPHERE_UNSTRUCTURED_TETRAHEDRAL) {
        const double r = std::max(1e-12, params->radius);
        const double r2 = r * r;
        cells.erase(std::remove_if(cells.begin(), cells.end(), [&](const TetraCell& t) {
            double x, y, z;
            tetra_centroid(t, x, y, z);
            const double dx0 = x - params->center_x;
            const double dy0 = y - params->center_y;
            const double dz0 = z - params->center_z;
            return (dx0 * dx0 + dy0 * dy0 + dz0 * dz0) > r2;
        }), cells.end());
        scale_density_for_target_mass(cells, (4.0 / 3.0) * PI * r * r * r);
    } else if (params->model_type == QUAD_MODEL_ELLIPSOID_UNSTRUCTURED_TETRAHEDRAL) {
        const double a = std::max(1e-12, params->a);
        const double b = std::max(1e-12, params->b);
        const double c = std::max(1e-12, params->c);
        cells.erase(std::remove_if(cells.begin(), cells.end(), [&](const TetraCell& t) {
            double x, y, z;
            tetra_centroid(t, x, y, z);
            const double nxv = (x - params->center_x) / a;
            const double nyv = (y - params->center_y) / b;
            const double nzv = (z - params->center_z) / c;
            return (nxv * nxv + nyv * nyv + nzv * nzv) > 1.0;
        }), cells.end());
        scale_density_for_target_mass(cells, (4.0 / 3.0) * PI * a * b * c);
    } else if (params->model_type == QUAD_MODEL_VERTICAL_CYLINDER_UNSTRUCTURED_TETRAHEDRAL) {
        const double r = std::max(1e-12, params->cylinder_radius);
        const double half_h = std::max(1e-12, params->cylinder_height) * 0.5;
        const double r2 = r * r;
        cells.erase(std::remove_if(cells.begin(), cells.end(), [&](const TetraCell& t) {
            double x, y, z;
            tetra_centroid(t, x, y, z);
            const double rx = x - params->center_x;
            const double ry = y - params->center_y;
            const double rz = z - params->center_z;
            return (rx * rx + ry * ry) > r2 || std::abs(rz) > half_h;
        }), cells.end());
        scale_density_for_target_mass(cells, PI * r * r * (2.0 * half_h));
    } else if (params->model_type == QUAD_MODEL_HORIZONTAL_CYLINDER_UNSTRUCTURED_TETRAHEDRAL) {
        const double r = std::max(1e-12, params->h_cylinder_radius);
        const double half_l = std::max(1e-12, params->h_cylinder_length) * 0.5;
        const double r2 = r * r;
        cells.erase(std::remove_if(cells.begin(), cells.end(), [&](const TetraCell& t) {
            double x, y, z;
            tetra_centroid(t, x, y, z);
            const double lx = x - params->center_x;
            const double ry = y - params->center_y;
            const double rz = z - params->center_z;
            return (ry * ry + rz * rz) > r2 || std::abs(lx) > half_l;
        }), cells.end());
        scale_density_for_target_mass(cells, PI * r * r * (2.0 * half_l));
    }

    apply_unstructured_jitter(cells, 1.0);

    // Vertex jitter changes tet volumes; without renormalization bulk mass drifts (worst near surface / shallow bodies).
    switch (params->model_type) {
        case QUAD_MODEL_SPHERE_UNSTRUCTURED_TETRAHEDRAL: {
            const double r = std::max(1e-12, params->radius);
            scale_density_for_target_mass(cells, (4.0 / 3.0) * PI * r * r * r);
            break;
        }
        case QUAD_MODEL_ELLIPSOID_UNSTRUCTURED_TETRAHEDRAL: {
            const double a = std::max(1e-12, params->a);
            const double b = std::max(1e-12, params->b);
            const double c = std::max(1e-12, params->c);
            scale_density_for_target_mass(cells, (4.0 / 3.0) * PI * a * b * c);
            break;
        }
        case QUAD_MODEL_VERTICAL_CYLINDER_UNSTRUCTURED_TETRAHEDRAL: {
            const double r = std::max(1e-12, params->cylinder_radius);
            const double half_h = std::max(1e-12, params->cylinder_height) * 0.5;
            scale_density_for_target_mass(cells, PI * r * r * (2.0 * half_h));
            break;
        }
        case QUAD_MODEL_HORIZONTAL_CYLINDER_UNSTRUCTURED_TETRAHEDRAL: {
            const double r = std::max(1e-12, params->h_cylinder_radius);
            const double half_l = std::max(1e-12, params->h_cylinder_length) * 0.5;
            scale_density_for_target_mass(cells, PI * r * r * (2.0 * half_l));
            break;
        }
        default:
            break;
    }

    return !cells.empty();
}

} // namespace detail
} // namespace quadrature_second_order

