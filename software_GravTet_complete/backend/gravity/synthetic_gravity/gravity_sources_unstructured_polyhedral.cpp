// gravity_sources_unstructured_polyhedral.cpp: synthetic gravity — discrete sources for forward models.
#include "gravity_sources_unstructured_polyhedral.h"
#include "gravity_sources_polyhedral.h"

// Unstructured polyhedral uses the same symmetric pyramid subdivision as structured
// polyhedral (6 face pyramids per hexahedral cell, apex at cell center). Position jitter
// was removed because it biased closed-form error maps off-center on coarse grids.

std::vector<Source> generate_cube_sources_unstructured_polyhedral(
    double center_x, double center_y, double center_z, double size_x, double size_y, double size_z,
    double density, int num_sources_x, int num_sources_y, int num_sources_z) {
    return generate_cube_sources_polyhedral(
        center_x, center_y, center_z, size_x, size_y, size_z, density, num_sources_x, num_sources_y, num_sources_z);
}

std::vector<Source> generate_sphere_sources_unstructured_polyhedral(
    double center_x, double center_y, double center_z, double radius, double density,
    int num_sources_radial, int num_sources_theta, int num_sources_phi) {
    return generate_sphere_sources_polyhedral(
        center_x, center_y, center_z, radius, density, num_sources_radial, num_sources_theta, num_sources_phi);
}

std::vector<Source> generate_ellipsoid_sources_unstructured_polyhedral(
    double center_x, double center_y, double center_z, double a, double b, double c, double density,
    int num_sources_x, int num_sources_y, int num_sources_z) {
    return generate_ellipsoid_sources_polyhedral(
        center_x, center_y, center_z, a, b, c, density, num_sources_x, num_sources_y, num_sources_z);
}

std::vector<Source> generate_vertical_cylinder_sources_unstructured_polyhedral(
    double center_x, double center_y, double center_z, double radius, double height, double density,
    int num_sources_radial, int num_sources_theta, int num_sources_z) {
    return generate_vertical_cylinder_sources_polyhedral(
        center_x, center_y, center_z, radius, height, density, num_sources_radial, num_sources_theta, num_sources_z);
}

std::vector<Source> generate_horizontal_cylinder_sources_unstructured_polyhedral(
    double center_x, double center_y, double center_z, double radius, double length, double density,
    int num_sources_radial, int num_sources_theta, int num_sources_length) {
    return generate_horizontal_cylinder_sources_polyhedral(
        center_x, center_y, center_z, radius, length, density, num_sources_radial, num_sources_theta, num_sources_length);
}

std::vector<Source> generate_salt_dome_sources_unstructured_polyhedral(
    double center_x, double center_y, double center_z, double base_radius, double top_radius, double height, double density,
    int num_sources_radial, int num_sources_theta, int num_sources_z) {
    return generate_salt_dome_sources_polyhedral(
        center_x, center_y, center_z, base_radius, top_radius, height, density, num_sources_radial, num_sources_theta, num_sources_z);
}

std::vector<Source> generate_faulted_block_sources_unstructured_polyhedral(
    double center_x, double center_y, double center_z, double size_x, double size_y, double size_z,
    double fault_offset, double density, int num_sources_x, int num_sources_y, int num_sources_z) {
    return generate_faulted_block_sources_polyhedral(
        center_x, center_y, center_z, size_x, size_y, size_z, fault_offset, density, num_sources_x, num_sources_y, num_sources_z);
}

std::vector<Source> generate_layered_basin_sources_unstructured_polyhedral(
    double center_x, double center_y, double center_z, double size_x, double size_y,
    double layer1_thickness, double layer2_thickness, double layer3_thickness,
    double layer1_density, double layer2_density, double layer3_density,
    int num_sources_x, int num_sources_y, int num_sources_z,
    double relief_wavelength) {
    return generate_layered_basin_sources_polyhedral(
        center_x, center_y, center_z, size_x, size_y, layer1_thickness, layer2_thickness, layer3_thickness,
        layer1_density, layer2_density, layer3_density, num_sources_x, num_sources_y, num_sources_z,
        relief_wavelength);
}

std::vector<Source> generate_voxel_density_sources_unstructured_polyhedral(
    double center_x, double center_y, double center_z, double size_x, double size_y, double size_z,
    double voxel_size, double density, int num_sources_x, int num_sources_y, int num_sources_z) {
    return generate_voxel_density_sources_polyhedral(
        center_x, center_y, center_z, size_x, size_y, size_z, voxel_size, density, num_sources_x, num_sources_y, num_sources_z);
}

std::vector<Source> generate_four_cubes_sources_unstructured_polyhedral(
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
    int num_sources_x, int num_sources_y, int num_sources_z) {
    return generate_four_cubes_sources_polyhedral(
        center_x, center_y, center_z,
        cube1_x, cube1_y, cube1_z, cube1_h, cube1_density,
        cube2_x, cube2_y, cube2_z, cube2_h, cube2_density,
        cube3_x, cube3_y, cube3_z, cube3_h, cube3_density,
        cube4_x, cube4_y, cube4_z, cube4_h, cube4_density,
        spacing_x, spacing_y,
        cube1_offset_x, cube1_offset_y, cube2_offset_x, cube2_offset_y,
        cube3_offset_x, cube3_offset_y, cube4_offset_x, cube4_offset_y,
        num_sources_x, num_sources_y, num_sources_z);
}
