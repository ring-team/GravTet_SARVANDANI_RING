/**
 * Step 07 — Integration/FFI layer (not a near-field or far-field kernel).
 * C FFI for Barnes–Hut gravity: flat arrays in, g_z array out (mGal).
 * It calls Step 06, which already combines:
 *   total = near-field (Step 04) + far-field (Step 05).
 */
#include "step01_barnes_hut_types_and_api.h"
#include <cmath>
#include <cstdlib>
#include <vector>

namespace {
constexpr double TO_MGAL = 1e5;  // m/s^2 -> mGal (same as Direct Newton)
}

extern "C" {

/** Compute gravity via Barnes–Hut. Returns newly allocated array of g_z in mGal; caller must free with barnes_hut_free_result. */
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
) {
    if (!source_x || !source_y || !source_z || !source_density || !source_volume ||
        !receiver_x || !receiver_y || !receiver_z || num_sources <= 0 || num_receivers <= 0 || !result_size) {
        if (result_size) *result_size = 0;
        return nullptr;
    }

    std::vector<Source> sources;
    sources.reserve(static_cast<size_t>(num_sources));
    for (int i = 0; i < num_sources; i++) {
        Source s;
        s.x = source_x[i];
        s.y = source_y[i];
        s.z = source_z[i];
        s.density = source_density[i];
        s.volume = source_volume[i];
        sources.push_back(s);
    }

    std::vector<Receiver> receivers;
    receivers.reserve(static_cast<size_t>(num_receivers));
    for (int i = 0; i < num_receivers; i++) {
        Receiver r;
        r.x = receiver_x[i];
        r.y = receiver_y[i];
        r.z = receiver_z[i];
        receivers.push_back(r);
    }

    // Smaller leaves → less mass lumped per node → monopole approximation matches elongated
    // distributions (e.g. rectangular prisms) better vs direct Newton. Cost: slightly deeper trees.
    std::vector<double> gz_si = forward_gravity_barnes_hut(
        receivers, sources,
        theta0,
        4,   // max_sources_per_leaf (was 8; helps cuboid/prism footprint vs pairwise summation)
        32   // max_depth
    );

    if (gz_si.size() != static_cast<size_t>(num_receivers)) {
        *result_size = 0;
        return nullptr;
    }

    double* out = static_cast<double*>(std::malloc(static_cast<size_t>(num_receivers) * sizeof(double)));
    if (!out) {
        *result_size = 0;
        return nullptr;
    }
    for (int i = 0; i < num_receivers; i++) {
        out[i] = gz_si[static_cast<size_t>(i)] * TO_MGAL;
    }
    *result_size = num_receivers;
    return out;
}

void barnes_hut_free_result(double* ptr) {
    std::free(ptr);
}

}  // extern "C"
