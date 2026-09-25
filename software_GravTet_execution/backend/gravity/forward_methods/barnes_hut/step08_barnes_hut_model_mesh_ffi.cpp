/**
 * Step 08 — ModelParams / TetraMeshInput entry points (same pattern as Direct Newton / Quadrature).
 * Discretization reuses the shared `synthetic_gravity` FFI helpers; Barnes–Hut kernel unchanged.
 */
#include "../../common/model_params.h"

extern "C" {

double* barnes_hut_compute_gravity(
    const double* source_x,
    const double* source_y,
    const double* source_z,
    const double* source_density,
    const double* source_volume,
    int num_sources,
    const double* receiver_x,
    const double* receiver_y,
    const double* receiver_z,
    int num_receivers,
    double theta0,
    int* result_size
);

static double* barnes_hut_from_source_arrays(
    SourceArray* sources_ptr,
    SourceArray* receivers_ptr,
    double theta0,
    int* result_size
) {
    if (!sources_ptr || !receivers_ptr || !result_size) {
        if (result_size) {
            *result_size = 0;
        }
        return nullptr;
    }
    SourceArray& sources = *sources_ptr;
    SourceArray& receivers = *receivers_ptr;
    return barnes_hut_compute_gravity(
        sources.x,
        sources.y,
        sources.z,
        sources.density,
        sources.volume,
        sources.size,
        receivers.x,
        receivers.y,
        receivers.z,
        receivers.size,
        theta0,
        result_size
    );
}

double* barnes_hut_forward_gravity_model(const ModelParams* params, double theta0, int* result_size) {
    if (!params || !result_size) {
        if (result_size) {
            *result_size = 0;
        }
        return nullptr;
    }
    SourceArray* sources_ptr = generate_sources_for_model(params);
    if (!sources_ptr) {
        *result_size = 0;
        return nullptr;
    }
    SourceArray* receivers_ptr = generate_receivers_for_model(
        params->surface_x_min,
        params->surface_x_max,
        params->surface_y_min,
        params->surface_y_max,
        params->surface_z,
        params->num_receivers_x,
        params->num_receivers_y
    );
    if (!receivers_ptr) {
        free_source_array(sources_ptr);
        *result_size = 0;
        return nullptr;
    }
    double* out = barnes_hut_from_source_arrays(sources_ptr, receivers_ptr, theta0, result_size);
    free_source_array(sources_ptr);
    free_source_array(receivers_ptr);
    return out;
}

double* barnes_hut_forward_gravity_tetra_mesh(const TetraMeshInput* mesh, double theta0, int* result_size) {
    if (!mesh || !result_size) {
        if (result_size) {
            *result_size = 0;
        }
        return nullptr;
    }
    SourceArray* sources_ptr = generate_sources_for_tetra_mesh(mesh);
    if (!sources_ptr) {
        *result_size = 0;
        return nullptr;
    }
    SourceArray* receivers_ptr = generate_receivers_for_model(
        mesh->surface_x_min,
        mesh->surface_x_max,
        mesh->surface_y_min,
        mesh->surface_y_max,
        mesh->surface_z,
        mesh->num_receivers_x,
        mesh->num_receivers_y
    );
    if (!receivers_ptr) {
        free_source_array(sources_ptr);
        *result_size = 0;
        return nullptr;
    }
    double* out = barnes_hut_from_source_arrays(sources_ptr, receivers_ptr, theta0, result_size);
    free_source_array(sources_ptr);
    free_source_array(receivers_ptr);
    return out;
}

}  // extern "C"
