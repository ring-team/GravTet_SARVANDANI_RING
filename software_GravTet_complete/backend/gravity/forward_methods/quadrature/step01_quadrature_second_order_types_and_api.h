#ifndef STEP01_QUADRATURE_SECOND_ORDER_TYPES_AND_API_H
#define STEP01_QUADRATURE_SECOND_ORDER_TYPES_AND_API_H

#include "../../mesh/mesh_types.h"
#include <vector>

/**
 * Unstructured tetrahedral source cell for second-order quadrature.
 * This module is intentionally restricted to tetrahedra only.
 */
struct TetraCell {
    // Vertex 1
    double x1, y1, z1;
    // Vertex 2
    double x2, y2, z2;
    // Vertex 3
    double x3, y3, z3;
    // Vertex 4
    double x4, y4, z4;
    // Piecewise-constant density in this tetra cell (kg/m^3)
    double density;
};

struct Receiver {
    double x, y, z; // position (m)
};

extern "C" {
// Unstructured-tetra-only model identifiers for quadrature mesh generation.
enum QuadratureModelType {
    QUAD_MODEL_CUBE_UNSTRUCTURED_TETRAHEDRAL = 33,
    QUAD_MODEL_CUBOID_UNSTRUCTURED_TETRAHEDRAL = 34,
    QUAD_MODEL_SPHERE_UNSTRUCTURED_TETRAHEDRAL = 35,
    QUAD_MODEL_ELLIPSOID_UNSTRUCTURED_TETRAHEDRAL = 36,
    QUAD_MODEL_VERTICAL_CYLINDER_UNSTRUCTURED_TETRAHEDRAL = 37,
    QUAD_MODEL_HORIZONTAL_CYLINDER_UNSTRUCTURED_TETRAHEDRAL = 38,
    QUAD_MODEL_FAULTED_BLOCK_UNSTRUCTURED_TETRAHEDRAL = 40,
    QUAD_MODEL_VALLEY_MOUNTAIN_UNSTRUCTURED_TETRAHEDRAL = 41,
    QUAD_MODEL_VOXEL_DENSITY_UNSTRUCTURED_TETRAHEDRAL = 42,
    QUAD_MODEL_FOUR_CUBES_UNSTRUCTURED_TETRAHEDRAL = 43
};

struct QuadratureModelParams {
    int model_type;
    double center_x, center_y, center_z;
    double density;
    int num_sources_x, num_sources_y, num_sources_z;
    int num_receivers_x, num_receivers_y;
    double surface_x_min, surface_x_max;
    double surface_y_min, surface_y_max;
    double surface_z;
    double size_x, size_y, size_z;
    double radius;
    double a, b, c;
    double cylinder_radius, cylinder_height;
    double h_cylinder_radius, h_cylinder_length;
    double fault_offset;
    double layer1_thickness, layer2_thickness, layer3_thickness;
    double layer1_density, layer2_density, layer3_density;
    double voxel_size;
    double cube1_x, cube1_y, cube1_z, cube1_h, cube1_density;
    double cube2_x, cube2_y, cube2_z, cube2_h, cube2_density;
    double cube3_x, cube3_y, cube3_z, cube3_h, cube3_density;
    double cube4_x, cube4_y, cube4_z, cube4_h, cube4_density;
    double spacing_x, spacing_y;
    double cube1_offset_x, cube1_offset_y;
    double cube2_offset_x, cube2_offset_y;
    double cube3_offset_x, cube3_offset_y;
    double cube4_offset_x, cube4_offset_y;
    int num_threads;    // 0 => auto (hardware_concurrency), otherwise requested thread count
    int execution_mode; // 0=tiled, 1=simd_tiled, 2=simd_tiled_threading, 3=reference
    int receiver_block_size; // 0 => default 64; clamped to [1, N_r] in tiled modes
    int source_block_size;   // 0 => default 128; clamped to [1, N_T] in tiled modes
    int simd_lanes = 0; // 0 selects the widest supported kernel
};
}

enum class QuadratureExecutionMode {
    Reference = 3,
    Tiled = 0,
    SIMDTiled = 1,
    SIMDTiledThreading = 2,
};

// Step 3: one tetra-cell contribution at one receiver (SI units, m/s^2).
double compute_gz_tetra_quadrature(const Receiver& receiver, const TetraCell& cell);

// Step 4: sum all tetra-cell contributions for one receiver (SI units, m/s^2).
double compute_gz_quadrature(const Receiver& receiver, const std::vector<TetraCell>& cells);

// Step 5: compute all receivers (SI units, m/s^2).
std::vector<double> forward_gravity_quadrature(
    const std::vector<Receiver>& receivers,
    const std::vector<TetraCell>& cells
);

// Step 8/9 accelerated orchestration with explicit execution mode.
std::vector<double> forward_gravity_quadrature_with_mode(
    const std::vector<Receiver>& receivers,
    const std::vector<TetraCell>& cells,
    QuadratureExecutionMode mode,
    int num_threads,
    int receiver_block_size = 0,
    int source_block_size = 0,
    int simd_lanes = 0
);

// Convert SI acceleration to mGal.
double to_mGal(double g_si);

extern "C" {
// Simple C ABI entry for later Python/ctypes wiring.
double* forward_gravity_quadrature_unstructured_tetra(
    const TetraCell* cells,
    int num_cells,
    const Receiver* receivers,
    int num_receivers,
    int output_in_mgal,
    int* result_size
);

void free_quadrature_result(double* result);

// Model-based forward entry with internal unstructured-tetra mesh generation.
double* forward_gravity_quadrature_model(
    const QuadratureModelParams* params,
    int* result_size
);

int count_quadrature_cells_for_tetra_mesh(const TetraMeshInput* mesh);

double* forward_gravity_tetra_mesh_quadrature(
    const TetraMeshInput* mesh,
    int* result_size
);
}

#endif // STEP01_QUADRATURE_SECOND_ORDER_TYPES_AND_API_H
