// Step 02 — Direct Newton-only FFI declarations.
//
// The shared `ModelParams`/`SourceArray` FFI contract and the neutral synthetic
// source/receiver generation entry points now live in the solver-neutral
// ../../common/model_params.h so AMFM and Barnes–Hut do not need to depend on
// Direct Newton to discretize a model.
#pragma once

#include "step01_direct_newton_continuous_gravity.h"
#include "../../common/model_params.h"
#include "../../mesh/mesh_types.h"
#include <vector>

extern "C" {
    // -------------------------------------------------------------------------
    // Direct Newton-only exported C ABI (not used by other solvers).
    // -------------------------------------------------------------------------
    double* forward_gravity_model(const ModelParams* params, int* result_size);
    double* forward_gravity_tetra_mesh_direct(const TetraMeshInput* mesh, int* result_size);
    void free_gravity_result(double* result);
    int count_sources_for_tetra_mesh(const TetraMeshInput* mesh);
}

// Discretization helpers (ModelParams -> Source list) live in
// `synthetic_gravity::synthetic_gravity_detail` (see
// ../../synthetic_gravity/source_build_internal.h). Direct Newton links
// against `synthetic_gravity` and calls those directly rather than owning
// its own copy.
