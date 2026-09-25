/**
 * Step 09 — ModelParams / TetraMeshInput entry points for AMFM.
 *
 * This mirrors Barnes–Hut's model/mesh FFI: Python passes model or mesh params,
 * C++ builds source/receiver arrays, then calls the existing AMFM kernel.
 */
#include "step08_amfm_ffi.h"
#include "../../common/model_params.h"

extern "C" {

static double* amfm_from_source_arrays(
    SourceArray* sources_ptr,
    SourceArray* receivers_ptr,
    double critical_distance_factor,
    int max_depth,
    int max_sources_per_node,
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

    AMFMParams params{};
    params.source_x = sources.x;
    params.source_y = sources.y;
    params.source_z = sources.z;
    params.source_density = sources.density;
    params.source_volume = sources.volume;
    params.num_sources = sources.size;
    params.receiver_x = receivers.x;
    params.receiver_y = receivers.y;
    params.receiver_z = receivers.z;
    params.num_receivers = receivers.size;
    params.critical_distance_factor = critical_distance_factor;
    params.max_depth = max_depth;
    params.max_sources_per_node = max_sources_per_node;

    return amfm_compute_gravity(&params, result_size);
}

double* amfm_forward_gravity_model(
    const ModelParams* params,
    double critical_distance_factor,
    int max_depth,
    int max_sources_per_node,
    int* result_size
) {
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
    double* out = amfm_from_source_arrays(
        sources_ptr,
        receivers_ptr,
        critical_distance_factor,
        max_depth,
        max_sources_per_node,
        result_size
    );
    free_source_array(sources_ptr);
    free_source_array(receivers_ptr);
    return out;
}

double* amfm_forward_gravity_tetra_mesh(
    const TetraMeshInput* mesh,
    double critical_distance_factor,
    int max_depth,
    int max_sources_per_node,
    int* result_size
) {
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
    double* out = amfm_from_source_arrays(
        sources_ptr,
        receivers_ptr,
        critical_distance_factor,
        max_depth,
        max_sources_per_node,
        result_size
    );
    free_source_array(sources_ptr);
    free_source_array(receivers_ptr);
    return out;
}

}  // extern "C"
