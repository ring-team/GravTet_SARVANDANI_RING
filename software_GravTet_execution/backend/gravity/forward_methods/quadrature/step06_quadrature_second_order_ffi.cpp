#include "step01_quadrature_second_order_types_and_api.h"
#include "quadrature_second_order_detail.h"

namespace {
std::vector<Receiver> generate_surface_receivers_local(
    double x_min, double x_max,
    double y_min, double y_max,
    double z,
    int nx, int ny
) {
    std::vector<Receiver> out;
    if (nx <= 0 || ny <= 0) return out;
    out.reserve(static_cast<std::size_t>(nx * ny));
    const double dx = (nx > 1) ? (x_max - x_min) / (nx - 1) : 0.0;
    const double dy = (ny > 1) ? (y_max - y_min) / (ny - 1) : 0.0;
    for (int i = 0; i < nx; ++i) {
        for (int j = 0; j < ny; ++j) {
            out.push_back(Receiver{x_min + i * dx, y_min + j * dy, z});
        }
    }
    return out;
}

bool fill_cells_from_tetra_mesh_input(const TetraMeshInput* mesh, std::vector<TetraCell>& cells) {
    if (!mesh || !mesh->nodes || !mesh->elements) return false;
    if (mesh->num_nodes <= 0 || mesh->num_elements <= 0) return false;
    cells.clear();
    cells.reserve(static_cast<std::size_t>(mesh->num_elements));
    for (int e = 0; e < mesh->num_elements; ++e) {
        const TetraElement& te = mesh->elements[e];
        const int ids[4] = {te.i0, te.i1, te.i2, te.i3};
        bool ok = true;
        for (int k = 0; k < 4; ++k) {
            if (ids[k] < 0 || ids[k] >= mesh->num_nodes) {
                ok = false;
                break;
            }
        }
        if (!ok) continue;
        const MeshNode& v1 = mesh->nodes[te.i0];
        const MeshNode& v2 = mesh->nodes[te.i1];
        const MeshNode& v3 = mesh->nodes[te.i2];
        const MeshNode& v4 = mesh->nodes[te.i3];
        TetraCell c{
            v1.x, v1.y, v1.z,
            v2.x, v2.y, v2.z,
            v3.x, v3.y, v3.z,
            v4.x, v4.y, v4.z,
            te.density
        };
        if (quadrature_second_order::detail::tetra_volume(c) <= 1e-18) continue;
        cells.push_back(c);
    }
    return !cells.empty();
}
} // namespace

extern "C" {

int count_quadrature_cells_for_model(const QuadratureModelParams* params) {
    if (!params) return -1;
    std::vector<TetraCell> cells;
    if (!quadrature_second_order::detail::generate_unstructured_tetra_cells_from_params(params, cells)) {
        return -1;
    }
    return static_cast<int>(cells.size());
}

int count_quadrature_cells_for_tetra_mesh(const TetraMeshInput* mesh) {
    std::vector<TetraCell> cells;
    if (!fill_cells_from_tetra_mesh_input(mesh, cells)) return -1;
    return static_cast<int>(cells.size());
}

double* forward_gravity_quadrature_unstructured_tetra(
    const TetraCell* cells,
    int num_cells,
    const Receiver* receivers,
    int num_receivers,
    int output_in_mgal,
    int* result_size
) {
    if (!result_size || !cells || !receivers || num_cells <= 0 || num_receivers <= 0) {
        if (result_size) {
            *result_size = 0;
        }
        return nullptr;
    }

    std::vector<TetraCell> tetra_cells(cells, cells + num_cells);
    std::vector<Receiver> obs(receivers, receivers + num_receivers);

    std::vector<double> out = forward_gravity_quadrature(obs, tetra_cells);

    *result_size = static_cast<int>(out.size());
    double* result = new double[*result_size];
    for (int i = 0; i < *result_size; ++i) {
        result[i] = output_in_mgal ? to_mGal(out[static_cast<std::size_t>(i)]) : out[static_cast<std::size_t>(i)];
    }
    return result;
}

void free_quadrature_result(double* result) {
    delete[] result;
}

double* forward_gravity_quadrature_model(
    const QuadratureModelParams* params,
    int* result_size
) {
    if (!result_size || !params) {
        return nullptr;
    }

    std::vector<TetraCell> cells;
    if (!quadrature_second_order::detail::generate_unstructured_tetra_cells_from_params(params, cells)) {
        *result_size = 0;
        return nullptr;
    }

    std::vector<Receiver> receivers = generate_surface_receivers_local(
        params->surface_x_min,
        params->surface_x_max,
        params->surface_y_min,
        params->surface_y_max,
        params->surface_z,
        params->num_receivers_x,
        params->num_receivers_y
    );

    QuadratureExecutionMode mode = QuadratureExecutionMode::SIMDTiledThreading;
    if (params->execution_mode == 0) {
        mode = QuadratureExecutionMode::Tiled;
    } else if (params->execution_mode == 1) {
        mode = QuadratureExecutionMode::SIMDTiled;
    } else if (params->execution_mode == 3) {
        mode = QuadratureExecutionMode::Reference;
    }

    if ((mode == QuadratureExecutionMode::SIMDTiled || mode == QuadratureExecutionMode::SIMDTiledThreading)
        && params->simd_lanes != 0 && !quadrature_simd_supports(params->simd_lanes)) {
        *result_size = 0;
        return nullptr;
    }
    const std::vector<double> out = forward_gravity_quadrature_with_mode(
        receivers,
        cells,
        mode,
        params->num_threads,
        params->receiver_block_size,
        params->source_block_size,
        params->simd_lanes
    );

    *result_size = static_cast<int>(out.size());
    double* result = new double[*result_size];
    for (int i = 0; i < *result_size; ++i) {
        result[i] = to_mGal(out[static_cast<std::size_t>(i)]);
    }
    return result;
}

double* forward_gravity_tetra_mesh_quadrature(
    const TetraMeshInput* mesh,
    int* result_size
) {
    if (!result_size || !mesh) return nullptr;
    std::vector<TetraCell> cells;
    if (!fill_cells_from_tetra_mesh_input(mesh, cells)) {
        *result_size = 0;
        return nullptr;
    }
    std::vector<Receiver> receivers = generate_surface_receivers_local(
        mesh->surface_x_min,
        mesh->surface_x_max,
        mesh->surface_y_min,
        mesh->surface_y_max,
        mesh->surface_z,
        mesh->num_receivers_x,
        mesh->num_receivers_y
    );
    QuadratureExecutionMode mode = QuadratureExecutionMode::SIMDTiledThreading;
    if (mesh->execution_mode == 0) {
        mode = QuadratureExecutionMode::Tiled;
    } else if (mesh->execution_mode == 1) {
        mode = QuadratureExecutionMode::SIMDTiled;
    } else if (mesh->execution_mode == 3) {
        mode = QuadratureExecutionMode::Reference;
    }
    if ((mode == QuadratureExecutionMode::SIMDTiled || mode == QuadratureExecutionMode::SIMDTiledThreading)
        && mesh->simd_lanes != 0 && !quadrature_simd_supports(mesh->simd_lanes)) {
        *result_size = 0;
        return nullptr;
    }
    const std::vector<double> out = forward_gravity_quadrature_with_mode(
        receivers,
        cells,
        mode,
        mesh->num_threads,
        mesh->receiver_block_size,
        mesh->source_block_size,
        mesh->simd_lanes
    );
    *result_size = static_cast<int>(out.size());
    double* result = new double[*result_size];
    for (int i = 0; i < *result_size; ++i) {
        result[i] = to_mGal(out[static_cast<std::size_t>(i)]);
    }
    return result;
}

} // extern "C"
