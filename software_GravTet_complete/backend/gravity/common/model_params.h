#pragma once

// Shared synthetic-model FFI contract used by every forward solver (Direct Newton,
// AMFM, Barnes-Hut, and the shared discretization code in `synthetic_gravity`).
//
// This header intentionally belongs to no single solver: any one forward method
// should be removable without breaking the others' ability to discretize a
// synthetic model or build receiver arrays. Keep it that way — do not add
// solver-specific declarations here.
//
// Keep in sync with:
// - backend/api/gravity/sources/model_params.py :: ModelParams / SourceArray
// - backend/api/gravity/shared/helpers.py :: model_type_to_int / create_model_params

#include "../mesh/mesh_types.h"

extern "C" {

// Synthetic model identifiers shared across all forward solvers.
enum ModelType {
    MODEL_CUBE_HEXAHEDRAL = 0,
    MODEL_CUBOID_HEXAHEDRAL = 1,
    MODEL_SPHERE_HEXAHEDRAL = 2,
    MODEL_ELLIPSOID_HEXAHEDRAL = 3,
    MODEL_VERTICAL_CYLINDER_HEXAHEDRAL = 4,
    MODEL_HORIZONTAL_CYLINDER_HEXAHEDRAL = 5,
    MODEL_SALT_DOME_HEXAHEDRAL = 6,
    MODEL_FAULTED_BLOCK_HEXAHEDRAL = 7,
    MODEL_LAYERED_BASIN_HEXAHEDRAL = 8,
    MODEL_VOXEL_DENSITY_HEXAHEDRAL = 9,
    MODEL_CUBE_TETRAHEDRAL = 10,
    MODEL_CUBOID_TETRAHEDRAL = 11,
    MODEL_SPHERE_TETRAHEDRAL = 12,
    MODEL_ELLIPSOID_TETRAHEDRAL = 13,
    MODEL_VERTICAL_CYLINDER_TETRAHEDRAL = 14,
    MODEL_HORIZONTAL_CYLINDER_TETRAHEDRAL = 15,
    MODEL_SALT_DOME_TETRAHEDRAL = 16,
    MODEL_FAULTED_BLOCK_TETRAHEDRAL = 17,
    MODEL_LAYERED_BASIN_TETRAHEDRAL = 18,
    MODEL_VOXEL_DENSITY_TETRAHEDRAL = 19,
    MODEL_CUBE_POLYHEDRAL = 20,
    MODEL_CUBOID_POLYHEDRAL = 21,
    MODEL_SPHERE_POLYHEDRAL = 22,
    MODEL_ELLIPSOID_POLYHEDRAL = 23,
    MODEL_VERTICAL_CYLINDER_POLYHEDRAL = 24,
    MODEL_HORIZONTAL_CYLINDER_POLYHEDRAL = 25,
    MODEL_SALT_DOME_POLYHEDRAL = 26,
    MODEL_FAULTED_BLOCK_POLYHEDRAL = 27,
    MODEL_LAYERED_BASIN_POLYHEDRAL = 28,
    MODEL_VOXEL_DENSITY_POLYHEDRAL = 29,
    MODEL_FOUR_CUBES_HEXAHEDRAL = 30,
    MODEL_FOUR_CUBES_TETRAHEDRAL = 31,
    MODEL_FOUR_CUBES_POLYHEDRAL = 32,
    MODEL_CUBE_UNSTRUCTURED_TETRAHEDRAL = 33,
    MODEL_CUBOID_UNSTRUCTURED_TETRAHEDRAL = 34,
    MODEL_SPHERE_UNSTRUCTURED_TETRAHEDRAL = 35,
    MODEL_ELLIPSOID_UNSTRUCTURED_TETRAHEDRAL = 36,
    MODEL_VERTICAL_CYLINDER_UNSTRUCTURED_TETRAHEDRAL = 37,
    MODEL_HORIZONTAL_CYLINDER_UNSTRUCTURED_TETRAHEDRAL = 38,
    MODEL_SALT_DOME_UNSTRUCTURED_TETRAHEDRAL = 39,
    MODEL_FAULTED_BLOCK_UNSTRUCTURED_TETRAHEDRAL = 40,
    MODEL_LAYERED_BASIN_UNSTRUCTURED_TETRAHEDRAL = 41,
    MODEL_VOXEL_DENSITY_UNSTRUCTURED_TETRAHEDRAL = 42,
    MODEL_FOUR_CUBES_UNSTRUCTURED_TETRAHEDRAL = 43,
    MODEL_CUBE_UNSTRUCTURED_POLYHEDRAL = 44,
    MODEL_CUBOID_UNSTRUCTURED_POLYHEDRAL = 45,
    MODEL_SPHERE_UNSTRUCTURED_POLYHEDRAL = 46,
    MODEL_ELLIPSOID_UNSTRUCTURED_POLYHEDRAL = 47,
    MODEL_VERTICAL_CYLINDER_UNSTRUCTURED_POLYHEDRAL = 48,
    MODEL_HORIZONTAL_CYLINDER_UNSTRUCTURED_POLYHEDRAL = 49,
    MODEL_SALT_DOME_UNSTRUCTURED_POLYHEDRAL = 50,
    MODEL_FAULTED_BLOCK_UNSTRUCTURED_POLYHEDRAL = 51,
    MODEL_LAYERED_BASIN_UNSTRUCTURED_POLYHEDRAL = 52,
    MODEL_VOXEL_DENSITY_UNSTRUCTURED_POLYHEDRAL = 53,
    MODEL_FOUR_CUBES_UNSTRUCTURED_POLYHEDRAL = 54
};

struct ModelParams {
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
    int num_sources_radial, num_sources_theta, num_sources_phi;
    double a, b, c;
    double cylinder_radius, cylinder_height;
    int num_sources_radial_cyl, num_sources_theta_cyl;
    double h_cylinder_radius, h_cylinder_length;
    int num_sources_radial_hcyl, num_sources_theta_hcyl, num_sources_length;
    double base_radius, top_radius, dome_height;
    int num_sources_radial_dome, num_sources_theta_dome;
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
    int num_threads;   // 0 => auto (hardware_concurrency)
    int execution_mode; // 0=reference_tiled, 1=simd_tiled, 2=simd_threading_tiled, 3=reference
    int receiver_block_size; // 0 => default 64; clamped to [1, N_r]
    int source_block_size;   // 0 => default 128; clamped to [1, N_s]
};

struct SourceArray {
    double* x;
    double* y;
    double* z;
    double* density;
    double* volume;
    int size;
};

// -----------------------------------------------------------------------------
// Shared synthetic source/receiver generation (implemented in `synthetic_gravity`).
// Any forward solver may call these without depending on another solver's library.
// -----------------------------------------------------------------------------
SourceArray* generate_sources_for_model(const ModelParams* params);
SourceArray* generate_receivers_for_model(
    double surface_x_min, double surface_x_max,
    double surface_y_min, double surface_y_max,
    double surface_z,
    int num_receivers_x, int num_receivers_y
);
int count_sources_for_model(const ModelParams* params);
void free_source_array(SourceArray* arr);
SourceArray* generate_sources_for_tetra_mesh(const TetraMeshInput* mesh);

} // extern "C"
