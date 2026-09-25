// gravity_sources_hexahedral.h: synthetic gravity — discrete sources for forward models.
#ifndef GRAVITY_SOURCES_HEXAHEDRAL_H
#define GRAVITY_SOURCES_HEXAHEDRAL_H

#include "../common/source_types.h"

// ============================================================================
// HEXAHEDRAL Source Generation Functions
// ============================================================================
// These functions generate sources using structured hexahedral (cubic/voxel) elements
// ============================================================================

std::vector<Source> generate_cube_sources_hexahedral(
    double center_x, double center_y, double center_z,
    double size_x, double size_y, double size_z,
    double density,
    int num_sources_x, int num_sources_y, int num_sources_z
);

std::vector<Source> generate_sphere_sources_hexahedral(
    double center_x, double center_y, double center_z,
    double radius,
    double density,
    int num_sources_radial, int num_sources_theta, int num_sources_phi
);

std::vector<Source> generate_ellipsoid_sources_hexahedral(
    double center_x, double center_y, double center_z,
    double a, double b, double c,
    double density,
    int num_sources_x, int num_sources_y, int num_sources_z
);

std::vector<Source> generate_vertical_cylinder_sources_hexahedral(
    double center_x, double center_y, double center_z,
    double radius, double height,
    double density,
    int num_sources_radial, int num_sources_theta, int num_sources_z
);

std::vector<Source> generate_horizontal_cylinder_sources_hexahedral(
    double center_x, double center_y, double center_z,
    double radius, double length,
    double density,
    int num_sources_radial, int num_sources_theta, int num_sources_length
);

std::vector<Source> generate_salt_dome_sources_hexahedral(
    double center_x, double center_y, double center_z,
    double base_radius, double top_radius, double height,
    double density,
    int num_sources_radial, int num_sources_theta, int num_sources_z
);

std::vector<Source> generate_faulted_block_sources_hexahedral(
    double center_x, double center_y, double center_z,
    double size_x, double size_y, double size_z,
    double fault_offset,
    double density,
    int num_sources_x, int num_sources_y, int num_sources_z
);

std::vector<Source> generate_layered_basin_sources_hexahedral(
    double center_x, double center_y, double center_z,
    double size_x, double size_y,
    double layer1_thickness, double layer2_thickness, double layer3_thickness,
    double layer1_density, double layer2_density, double layer3_density,
    int num_sources_x, int num_sources_y, int num_sources_z,
    double relief_wavelength = 0.0
);

std::vector<Source> generate_voxel_density_sources_hexahedral(
    double center_x, double center_y, double center_z,
    double size_x, double size_y, double size_z,
    double voxel_size,
    double density,
    int num_sources_x, int num_sources_y, int num_sources_z
);

std::vector<Source> generate_four_cubes_sources_hexahedral(
    double center_x, double center_y, double center_z,
    // Cube 1
    double cube1_x, double cube1_y, double cube1_z, double cube1_h, double cube1_density,
    // Cube 2
    double cube2_x, double cube2_y, double cube2_z, double cube2_h, double cube2_density,
    // Cube 3
    double cube3_x, double cube3_y, double cube3_z, double cube3_h, double cube3_density,
    // Cube 4
    double cube4_x, double cube4_y, double cube4_z, double cube4_h, double cube4_density,
    // Spacing between cubes
    double spacing_x, double spacing_y,
    // Cube offsets (X and Y distances from base grid position)
    double cube1_offset_x, double cube1_offset_y,
    double cube2_offset_x, double cube2_offset_y,
    double cube3_offset_x, double cube3_offset_y,
    double cube4_offset_x, double cube4_offset_y,
    // Mesh resolution
    int num_sources_x, int num_sources_y, int num_sources_z
);

// Generate receivers on a surface grid (shared by both hexahedral and tetrahedral)
std::vector<Receiver> generate_surface_receivers(
    double x_min, double x_max,
    double y_min, double y_max,
    double z_surface,
    int num_receivers_x, int num_receivers_y
);

#endif // GRAVITY_SOURCES_HEXAHEDRAL_H
