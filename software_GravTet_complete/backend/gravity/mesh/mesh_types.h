#pragma once

// Shared mesh FFI structs used across gravity solvers.
// Keep aligned with:
// - backend/gravity/mesh/types.py
// - backend/api/gravity/ffi_types.py (re-export layer)

#ifdef __cplusplus
extern "C" {
#endif

struct MeshNode {
    double x;
    double y;
    double z;
};

struct TetraElement {
    int i0;
    int i1;
    int i2;
    int i3;
    double density;
};

struct TetraMeshInput {
    const MeshNode* nodes;
    int num_nodes;
    const TetraElement* elements;
    int num_elements;
    int num_receivers_x, num_receivers_y;
    double surface_x_min, surface_x_max;
    double surface_y_min, surface_y_max;
    double surface_z;
    int execution_mode; // 0=tiled, 1=simd_tiled, 2=simd_tiled_threading, 3=reference
    int num_threads;    // 0 => auto (hardware_concurrency) for threaded quadrature mesh path
    int receiver_block_size; // 0 => default 64
    int source_block_size;   // 0 => default 128
    int simd_lanes = 0; // 0 selects the widest supported kernel
};

#ifdef __cplusplus
}
#endif

