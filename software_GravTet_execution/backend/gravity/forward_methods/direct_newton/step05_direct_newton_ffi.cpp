// Step 05 — exported direct Newton forward-model FFI entry.
#include "step02_direct_newton_model_params.h"
#include "../../synthetic_gravity/gravity_sources_structured_hexahedral.h"
#include "../../synthetic_gravity/gravity_sources_tetrahedral.h"
#include "../../synthetic_gravity/source_build_internal.h"

namespace {

std::vector<Receiver> generate_receivers_from_mesh(const TetraMeshInput* mesh) {
    return generate_surface_receivers(
        mesh->surface_x_min,
        mesh->surface_x_max,
        mesh->surface_y_min,
        mesh->surface_y_max,
        mesh->surface_z,
        mesh->num_receivers_x,
        mesh->num_receivers_y);
}

bool build_sources_from_tetra_mesh(const TetraMeshInput* mesh, std::vector<Source>& sources) {
    if (!mesh || !mesh->nodes || !mesh->elements) {
        return false;
    }
    if (mesh->num_nodes <= 0 || mesh->num_elements <= 0) {
        return false;
    }
    sources.clear();
    sources.reserve(static_cast<std::size_t>(mesh->num_elements));
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
        if (!ok) {
            continue;
        }
        const MeshNode& v1 = mesh->nodes[te.i0];
        const MeshNode& v2 = mesh->nodes[te.i1];
        const MeshNode& v3 = mesh->nodes[te.i2];
        const MeshNode& v4 = mesh->nodes[te.i3];
        const double vol = tetrahedron_volume(
            v1.x, v1.y, v1.z,
            v2.x, v2.y, v2.z,
            v3.x, v3.y, v3.z,
            v4.x, v4.y, v4.z);
        if (vol <= 1e-18) {
            continue;
        }
        double cx = 0.0;
        double cy = 0.0;
        double cz = 0.0;
        tetrahedron_centroid(
            v1.x, v1.y, v1.z,
            v2.x, v2.y, v2.z,
            v3.x, v3.y, v3.z,
            v4.x, v4.y, v4.z,
            cx, cy, cz);
        Source s{};
        s.x = cx;
        s.y = cy;
        s.z = cz;
        s.density = te.density;
        s.volume = vol;
        sources.push_back(s);
    }
    return !sources.empty();
}

DirectNewtonExecutionMode mesh_execution_mode(const TetraMeshInput* mesh) {
    if (!mesh) {
        return DirectNewtonExecutionMode::SIMDTiledThreading;
    }
    if (mesh->execution_mode == 0) {
        return DirectNewtonExecutionMode::Tiled;
    }
    if (mesh->execution_mode == 1) {
        return DirectNewtonExecutionMode::SIMDTiled;
    }
    if (mesh->execution_mode == 3) {
        return DirectNewtonExecutionMode::Reference;
    }
    return DirectNewtonExecutionMode::SIMDTiledThreading;
}

} // namespace

extern "C" {

double* forward_gravity_model(const ModelParams* params, int* result_size) {
    std::vector<Source> sources;
    if (!synthetic_gravity_detail::fill_all_sources_from_params(params, sources)) {
        *result_size = 0;
        return nullptr;
    }

    std::vector<Receiver> receivers = generate_surface_receivers(
        params->surface_x_min,
        params->surface_x_max,
        params->surface_y_min,
        params->surface_y_max,
        params->surface_z,
        params->num_receivers_x,
        params->num_receivers_y
    );

    DirectNewtonExecutionMode mode = DirectNewtonExecutionMode::SIMDTiledThreading;
    if (params->execution_mode == 0) {
        mode = DirectNewtonExecutionMode::Tiled;
    } else if (params->execution_mode == 1) {
        mode = DirectNewtonExecutionMode::SIMDTiled;
    } else if (params->execution_mode == 3) {
        mode = DirectNewtonExecutionMode::Reference;
    }
    std::vector<double> gravity_si =
        forward_gravity_with_mode(
            receivers,
            sources,
            mode,
            params->num_threads,
            params->receiver_block_size,
            params->source_block_size);

    *result_size = gravity_si.size();
    double* result = new double[*result_size];
    for (size_t i = 0; i < gravity_si.size(); i++) {
        result[i] = to_mGal(gravity_si[i]);
    }
    return result;
}

int count_sources_for_tetra_mesh(const TetraMeshInput* mesh) {
    std::vector<Source> sources;
    if (!build_sources_from_tetra_mesh(mesh, sources)) {
        return -1;
    }
    return static_cast<int>(sources.size());
}

double* forward_gravity_tetra_mesh_direct(const TetraMeshInput* mesh, int* result_size) {
    if (!result_size) {
        return nullptr;
    }
    *result_size = 0;
    if (!mesh) {
        return nullptr;
    }
    std::vector<Source> sources;
    if (!build_sources_from_tetra_mesh(mesh, sources)) {
        return nullptr;
    }
    std::vector<Receiver> receivers = generate_receivers_from_mesh(mesh);
    if (receivers.empty()) {
        return nullptr;
    }
    const DirectNewtonExecutionMode mode = mesh_execution_mode(mesh);
    std::vector<double> gravity_si =
        forward_gravity_with_mode(
            receivers,
            sources,
            mode,
            mesh->num_threads,
            mesh->receiver_block_size,
            mesh->source_block_size);
    if (gravity_si.empty()) {
        return nullptr;
    }
    *result_size = static_cast<int>(gravity_si.size());
    double* result = new double[*result_size];
    for (int i = 0; i < *result_size; ++i) {
        result[i] = to_mGal(gravity_si[static_cast<std::size_t>(i)]);
    }
    return result;
}

void free_gravity_result(double* result) {
    delete[] result;
}

} // extern "C"

