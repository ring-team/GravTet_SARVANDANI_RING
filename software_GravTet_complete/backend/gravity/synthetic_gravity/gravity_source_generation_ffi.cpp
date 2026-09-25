// Shared synthetic source/receiver generation FFI (neutral names + legacy aliases).
//
// Also owns tetrahedral-mesh source discretization (`generate_sources_for_tetra_mesh`)
// so AMFM and Barnes–Hut do not need to link against Direct Newton to run their
// mesh-based (TetraMeshInput) forward-model entry points.
#include "source_build_internal.h"
#include "gravity_sources_structured_hexahedral.h"
#include "gravity_sources_tetrahedral.h"

namespace {

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

} // namespace

extern "C" {

SourceArray* generate_sources_for_model(const ModelParams* params) {
    std::vector<Source> sources;
    if (!synthetic_gravity_detail::fill_all_sources_from_params(params, sources)) {
        return nullptr;
    }
    return synthetic_gravity_detail::sources_to_array(sources);
}

SourceArray* generate_receivers_for_model(
    double surface_x_min, double surface_x_max,
    double surface_y_min, double surface_y_max,
    double surface_z,
    int num_receivers_x, int num_receivers_y
) {
    std::vector<Receiver> receivers = generate_surface_receivers(
        surface_x_min, surface_x_max,
        surface_y_min, surface_y_max,
        surface_z,
        num_receivers_x, num_receivers_y
    );
    if (receivers.empty()) {
        return nullptr;
    }

    SourceArray* arr = new SourceArray;
    arr->size = receivers.size();
    arr->x = new double[arr->size];
    arr->y = new double[arr->size];
    arr->z = new double[arr->size];
    arr->density = nullptr;
    arr->volume = nullptr;
    for (size_t i = 0; i < receivers.size(); i++) {
        arr->x[i] = receivers[i].x;
        arr->y[i] = receivers[i].y;
        arr->z[i] = receivers[i].z;
    }
    return arr;
}

int count_sources_for_model(const ModelParams* params) {
    std::vector<Source> sources;
    if (!synthetic_gravity_detail::fill_all_sources_from_params(params, sources)) {
        return -1;
    }
    return static_cast<int>(sources.size());
}

SourceArray* generate_sources_for_tetra_mesh(const TetraMeshInput* mesh) {
    std::vector<Source> sources;
    if (!build_sources_from_tetra_mesh(mesh, sources)) {
        return nullptr;
    }
    return synthetic_gravity_detail::sources_to_array(sources);
}

} // extern "C"
