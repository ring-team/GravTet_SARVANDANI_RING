// gravity_sources_polyhedral.h: synthetic gravity — discrete sources for forward models.
#ifndef GRAVITY_SOURCES_POLYHEDRAL_H
#define GRAVITY_SOURCES_POLYHEDRAL_H

#include "../common/source_types.h"
#include "gravity_sources_hexahedral.h"  // Need hexahedral functions for subdivision

// ============================================================================
// Helper Functions for Polyhedral Meshing
// ============================================================================

// Compute pyramid volume (base is a quadrilateral, apex is a point)
double pyramid_volume(double base_x1, double base_y1, double base_z1,
                      double base_x2, double base_y2, double base_z2,
                      double base_x3, double base_y3, double base_z3,
                      double base_x4, double base_y4, double base_z4,
                      double apex_x, double apex_y, double apex_z);

// Compute pyramid centroid (center of mass)
void pyramid_centroid(double base_x1, double base_y1, double base_z1,
                      double base_x2, double base_y2, double base_z2,
                      double base_x3, double base_y3, double base_z3,
                      double base_x4, double base_y4, double base_z4,
                      double apex_x, double apex_y, double apex_z,
                      double& cx, double& cy, double& cz);

// Helper function to subdivide a hexahedral source into 6 pyramids (one per face)
void subdivide_hexahedron_to_pyramids(
    double x, double y, double z, double volume, double density,
    std::vector<Source>& poly_sources);

// ============================================================================
// POLYHEDRAL Source Generation Functions
// ============================================================================
// These functions generate sources using polyhedral elements
// by subdividing hexahedral elements into 6 pyramids each
// ============================================================================

std::vector<Source> generate_cube_sources_polyhedral(
    double center_x, double center_y, double center_z,
    double size_x, double size_y, double size_z,
    double density,
    int num_sources_x, int num_sources_y, int num_sources_z
);

std::vector<Source> generate_sphere_sources_polyhedral(
    double center_x, double center_y, double center_z,
    double radius,
    double density,
    int num_sources_radial, int num_sources_theta, int num_sources_phi
);

std::vector<Source> generate_ellipsoid_sources_polyhedral(
    double center_x, double center_y, double center_z,
    double a, double b, double c,
    double density,
    int num_sources_x, int num_sources_y, int num_sources_z
);

std::vector<Source> generate_vertical_cylinder_sources_polyhedral(
    double center_x, double center_y, double center_z,
    double radius, double height,
    double density,
    int num_sources_radial, int num_sources_theta, int num_sources_z
);

std::vector<Source> generate_horizontal_cylinder_sources_polyhedral(
    double center_x, double center_y, double center_z,
    double radius, double length,
    double density,
    int num_sources_radial, int num_sources_theta, int num_sources_length
);

std::vector<Source> generate_salt_dome_sources_polyhedral(
    double center_x, double center_y, double center_z,
    double base_radius, double top_radius, double height,
    double density,
    int num_sources_radial, int num_sources_theta, int num_sources_z
);

std::vector<Source> generate_faulted_block_sources_polyhedral(
    double center_x, double center_y, double center_z,
    double size_x, double size_y, double size_z,
    double fault_offset,
    double density,
    int num_sources_x, int num_sources_y, int num_sources_z
);

std::vector<Source> generate_layered_basin_sources_polyhedral(
    double center_x, double center_y, double center_z,
    double size_x, double size_y,
    double layer1_thickness, double layer2_thickness, double layer3_thickness,
    double layer1_density, double layer2_density, double layer3_density,
    int num_sources_x, int num_sources_y, int num_sources_z,
    double relief_wavelength = 0.0
);

std::vector<Source> generate_voxel_density_sources_polyhedral(
    double center_x, double center_y, double center_z,
    double size_x, double size_y, double size_z,
    double voxel_size,
    double density,
    int num_sources_x, int num_sources_y, int num_sources_z
);

std::vector<Source> generate_four_cubes_sources_polyhedral(
    double center_x, double center_y, double center_z,
    double cube1_x, double cube1_y, double cube1_z, double cube1_h, double cube1_density,
    double cube2_x, double cube2_y, double cube2_z, double cube2_h, double cube2_density,
    double cube3_x, double cube3_y, double cube3_z, double cube3_h, double cube3_density,
    double cube4_x, double cube4_y, double cube4_z, double cube4_h, double cube4_density,
    double spacing_x, double spacing_y,
    double cube1_offset_x, double cube1_offset_y,
    double cube2_offset_x, double cube2_offset_y,
    double cube3_offset_x, double cube3_offset_y,
    double cube4_offset_x, double cube4_offset_y,
    int num_sources_x, int num_sources_y, int num_sources_z
);

#endif // GRAVITY_SOURCES_POLYHEDRAL_H
