// gravity_sources_tetrahedral.h: synthetic gravity — discrete sources for forward models.
#ifndef GRAVITY_SOURCES_TETRAHEDRAL_H
#define GRAVITY_SOURCES_TETRAHEDRAL_H

#include "../common/source_types.h"
#include "gravity_sources_hexahedral.h"  // Need hexahedral functions for subdivision

// ============================================================================
// Helper Functions for Tetrahedral Meshing
// ============================================================================

// Compute tetrahedron volume using scalar triple product
double tetrahedron_volume(double x1, double y1, double z1,
                         double x2, double y2, double z2,
                         double x3, double y3, double z3,
                         double x4, double y4, double z4);

// Compute tetrahedron centroid (center of mass)
void tetrahedron_centroid(double x1, double y1, double z1,
                         double x2, double y2, double z2,
                         double x3, double y3, double z3,
                         double x4, double y4, double z4,
                         double& cx, double& cy, double& cz);

// Helper function to subdivide a hexahedral source into 5 tetrahedra
void subdivide_hexahedron_to_tetrahedra(
    double x, double y, double z, double volume, double density,
    std::vector<Source>& tetra_sources);

// ============================================================================
// TETRAHEDRAL Source Generation Functions
// ============================================================================
// These functions generate sources using unstructured tetrahedral elements
// by subdividing hexahedral elements into 5 tetrahedra each
// ============================================================================

std::vector<Source> generate_cube_sources_tetrahedral(
    double center_x, double center_y, double center_z,
    double size_x, double size_y, double size_z,
    double density,
    int num_sources_x, int num_sources_y, int num_sources_z
);

std::vector<Source> generate_sphere_sources_tetrahedral(
    double center_x, double center_y, double center_z,
    double radius,
    double density,
    int num_sources_radial, int num_sources_theta, int num_sources_phi
);

std::vector<Source> generate_ellipsoid_sources_tetrahedral(
    double center_x, double center_y, double center_z,
    double a, double b, double c,
    double density,
    int num_sources_x, int num_sources_y, int num_sources_z
);

std::vector<Source> generate_vertical_cylinder_sources_tetrahedral(
    double center_x, double center_y, double center_z,
    double radius, double height,
    double density,
    int num_sources_radial, int num_sources_theta, int num_sources_z
);

std::vector<Source> generate_horizontal_cylinder_sources_tetrahedral(
    double center_x, double center_y, double center_z,
    double radius, double length,
    double density,
    int num_sources_radial, int num_sources_theta, int num_sources_length
);

std::vector<Source> generate_salt_dome_sources_tetrahedral(
    double center_x, double center_y, double center_z,
    double base_radius, double top_radius, double height,
    double density,
    int num_sources_radial, int num_sources_theta, int num_sources_z
);

std::vector<Source> generate_faulted_block_sources_tetrahedral(
    double center_x, double center_y, double center_z,
    double size_x, double size_y, double size_z,
    double fault_offset,
    double density,
    int num_sources_x, int num_sources_y, int num_sources_z
);

std::vector<Source> generate_layered_basin_sources_tetrahedral(
    double center_x, double center_y, double center_z,
    double size_x, double size_y,
    double layer1_thickness, double layer2_thickness, double layer3_thickness,
    double layer1_density, double layer2_density, double layer3_density,
    int num_sources_x, int num_sources_y, int num_sources_z,
    double relief_wavelength = 0.0
);

std::vector<Source> generate_voxel_density_sources_tetrahedral(
    double center_x, double center_y, double center_z,
    double size_x, double size_y, double size_z,
    double voxel_size,
    double density,
    int num_sources_x, int num_sources_y, int num_sources_z
);

std::vector<Source> generate_four_cubes_sources_tetrahedral(
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

#endif // GRAVITY_SOURCES_TETRAHEDRAL_H
