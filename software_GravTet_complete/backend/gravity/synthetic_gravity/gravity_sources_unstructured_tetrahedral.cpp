// gravity_sources_unstructured_tetrahedral.cpp: synthetic gravity — discrete sources for forward models.
#include "gravity_sources_unstructured_tetrahedral.h"
#include "gravity_sources_tetrahedral.h"
#include <algorithm>
#include <cmath>

namespace {
double hash01(int idx, int salt) {
    const double n = std::sin((idx + 1) * 127.1 + salt * 311.7) * 43758.5453123;
    return n - std::floor(n);
}

void apply_unstructured_jitter(std::vector<Source>& sources, double strength) {
    if (sources.empty()) return;
    double min_x = sources[0].x, max_x = sources[0].x;
    double min_y = sources[0].y, max_y = sources[0].y;
    double min_z = sources[0].z, max_z = sources[0].z;
    double mean_vol = 0.0;
    for (const auto& s : sources) {
        min_x = std::min(min_x, s.x); max_x = std::max(max_x, s.x);
        min_y = std::min(min_y, s.y); max_y = std::max(max_y, s.y);
        min_z = std::min(min_z, s.z); max_z = std::max(max_z, s.z);
        mean_vol += s.volume;
    }
    mean_vol /= static_cast<double>(sources.size());
    const double bbox_scale = std::max(1e-6, std::min(max_x - min_x, std::min(max_y - min_y, max_z - min_z)));
    const double vol_scale = std::max(1e-6, std::cbrt(std::abs(mean_vol)));
    const double amp = std::max(1e-6, std::min(bbox_scale * 0.05, vol_scale)) * strength;

    double sx = 0.0, sy = 0.0, sz = 0.0;
    std::vector<double> dx(sources.size()), dy(sources.size()), dz(sources.size());
    for (size_t i = 0; i < sources.size(); i++) {
        dx[i] = (hash01(static_cast<int>(i), 17) - 0.5) * amp;
        dy[i] = (hash01(static_cast<int>(i), 43) - 0.5) * amp;
        dz[i] = (hash01(static_cast<int>(i), 97) - 0.5) * amp;
        sx += dx[i]; sy += dy[i]; sz += dz[i];
    }
    sx /= static_cast<double>(sources.size());
    sy /= static_cast<double>(sources.size());
    sz /= static_cast<double>(sources.size());
    for (size_t i = 0; i < sources.size(); i++) {
        sources[i].x += dx[i] - sx;
        sources[i].y += dy[i] - sy;
        sources[i].z += dz[i] - sz;
    }
}
} // namespace

std::vector<Source> generate_cube_sources_unstructured_tetrahedral(
    double center_x, double center_y, double center_z, double size_x, double size_y, double size_z,
    double density, int num_sources_x, int num_sources_y, int num_sources_z) {
    auto sources = generate_cube_sources_tetrahedral(
        center_x, center_y, center_z, size_x, size_y, size_z, density, num_sources_x, num_sources_y, num_sources_z);
    apply_unstructured_jitter(sources, 1.0);
    return sources;
}

std::vector<Source> generate_sphere_sources_unstructured_tetrahedral(
    double center_x, double center_y, double center_z, double radius, double density,
    int num_sources_radial, int num_sources_theta, int num_sources_phi) {
    auto sources = generate_sphere_sources_tetrahedral(
        center_x, center_y, center_z, radius, density, num_sources_radial, num_sources_theta, num_sources_phi);
    apply_unstructured_jitter(sources, 0.8);
    return sources;
}

std::vector<Source> generate_ellipsoid_sources_unstructured_tetrahedral(
    double center_x, double center_y, double center_z, double a, double b, double c, double density,
    int num_sources_x, int num_sources_y, int num_sources_z) {
    auto sources = generate_ellipsoid_sources_tetrahedral(
        center_x, center_y, center_z, a, b, c, density, num_sources_x, num_sources_y, num_sources_z);
    apply_unstructured_jitter(sources, 0.9);
    return sources;
}

std::vector<Source> generate_vertical_cylinder_sources_unstructured_tetrahedral(
    double center_x, double center_y, double center_z, double radius, double height, double density,
    int num_sources_radial, int num_sources_theta, int num_sources_z) {
    auto sources = generate_vertical_cylinder_sources_tetrahedral(
        center_x, center_y, center_z, radius, height, density, num_sources_radial, num_sources_theta, num_sources_z);
    apply_unstructured_jitter(sources, 0.9);
    return sources;
}

std::vector<Source> generate_horizontal_cylinder_sources_unstructured_tetrahedral(
    double center_x, double center_y, double center_z, double radius, double length, double density,
    int num_sources_radial, int num_sources_theta, int num_sources_length) {
    auto sources = generate_horizontal_cylinder_sources_tetrahedral(
        center_x, center_y, center_z, radius, length, density, num_sources_radial, num_sources_theta, num_sources_length);
    apply_unstructured_jitter(sources, 0.9);
    return sources;
}

std::vector<Source> generate_salt_dome_sources_unstructured_tetrahedral(
    double center_x, double center_y, double center_z, double base_radius, double top_radius, double height, double density,
    int num_sources_radial, int num_sources_theta, int num_sources_z) {
    auto sources = generate_salt_dome_sources_tetrahedral(
        center_x, center_y, center_z, base_radius, top_radius, height, density, num_sources_radial, num_sources_theta, num_sources_z);
    apply_unstructured_jitter(sources, 0.85);
    return sources;
}

std::vector<Source> generate_faulted_block_sources_unstructured_tetrahedral(
    double center_x, double center_y, double center_z, double size_x, double size_y, double size_z,
    double fault_offset, double density, int num_sources_x, int num_sources_y, int num_sources_z) {
    auto sources = generate_faulted_block_sources_tetrahedral(
        center_x, center_y, center_z, size_x, size_y, size_z, fault_offset, density, num_sources_x, num_sources_y, num_sources_z);
    apply_unstructured_jitter(sources, 1.0);
    return sources;
}

std::vector<Source> generate_layered_basin_sources_unstructured_tetrahedral(
    double center_x, double center_y, double center_z, double size_x, double size_y,
    double layer1_thickness, double layer2_thickness, double layer3_thickness,
    double layer1_density, double layer2_density, double layer3_density,
    int num_sources_x, int num_sources_y, int num_sources_z,
    double relief_wavelength) {
    auto sources = generate_layered_basin_sources_tetrahedral(
        center_x, center_y, center_z, size_x, size_y, layer1_thickness, layer2_thickness, layer3_thickness,
        layer1_density, layer2_density, layer3_density, num_sources_x, num_sources_y, num_sources_z,
        relief_wavelength);
    apply_unstructured_jitter(sources, 0.75);
    return sources;
}

std::vector<Source> generate_voxel_density_sources_unstructured_tetrahedral(
    double center_x, double center_y, double center_z, double size_x, double size_y, double size_z,
    double voxel_size, double density, int num_sources_x, int num_sources_y, int num_sources_z) {
    auto sources = generate_voxel_density_sources_tetrahedral(
        center_x, center_y, center_z, size_x, size_y, size_z, voxel_size, density, num_sources_x, num_sources_y, num_sources_z);
    apply_unstructured_jitter(sources, 0.7);
    return sources;
}

std::vector<Source> generate_four_cubes_sources_unstructured_tetrahedral(
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
    auto sources = generate_four_cubes_sources_tetrahedral(
        center_x, center_y, center_z,
        cube1_x, cube1_y, cube1_z, cube1_h, cube1_density,
        cube2_x, cube2_y, cube2_z, cube2_h, cube2_density,
        cube3_x, cube3_y, cube3_z, cube3_h, cube3_density,
        cube4_x, cube4_y, cube4_z, cube4_h, cube4_density,
        spacing_x, spacing_y,
        cube1_offset_x, cube1_offset_y, cube2_offset_x, cube2_offset_y,
        cube3_offset_x, cube3_offset_y, cube4_offset_x, cube4_offset_y,
        num_sources_x, num_sources_y, num_sources_z);
    apply_unstructured_jitter(sources, 0.95);
    return sources;
}
