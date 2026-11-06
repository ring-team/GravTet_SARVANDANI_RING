// gravity_sources_polyhedral.cpp: synthetic gravity — discrete sources for forward models.
#include "gravity_sources_polyhedral.h"
#include <cmath>
#include <algorithm>

// ============================================================================
// Unified Coordinate System: (X, Y, Z=depth)
// This file implements polyhedral source generation by subdividing hexahedral
// elements into 6 pyramids each (one per face).
// ============================================================================

// ============================================================================
// Helper Functions for Polyhedral Meshing
// ============================================================================

// Compute pyramid volume (base is a quadrilateral, apex is a point)
// Volume = (1/3) * base_area * height
double pyramid_volume(double base_x1, double base_y1, double base_z1,
                      double base_x2, double base_y2, double base_z2,
                      double base_x3, double base_y3, double base_z3,
                      double base_x4, double base_y4, double base_z4,
                      double apex_x, double apex_y, double apex_z) {
    // Compute base area using cross product of two triangles
    // Split quadrilateral into two triangles: (1,2,3) and (1,3,4)
    
    // Triangle 1: (base_x1, base_y1, base_z1), (base_x2, base_y2, base_z2), (base_x3, base_y3, base_z3)
    double v21x = base_x2 - base_x1, v21y = base_y2 - base_y1, v21z = base_z2 - base_z1;
    double v31x = base_x3 - base_x1, v31y = base_y3 - base_y1, v31z = base_z3 - base_z1;
    double cross1_x = v21y * v31z - v21z * v31y;
    double cross1_y = v21z * v31x - v21x * v31z;
    double cross1_z = v21x * v31y - v21y * v31x;
    double area1 = 0.5 * std::sqrt(cross1_x * cross1_x + cross1_y * cross1_y + cross1_z * cross1_z);
    
    // Triangle 2: (base_x1, base_y1, base_z1), (base_x3, base_y3, base_z3), (base_x4, base_y4, base_z4)
    double v41x = base_x4 - base_x1, v41y = base_y4 - base_y1, v41z = base_z4 - base_z1;
    double cross2_x = v31y * v41z - v31z * v41y;
    double cross2_y = v31z * v41x - v31x * v41z;
    double cross2_z = v31x * v41y - v31y * v41x;
    double area2 = 0.5 * std::sqrt(cross2_x * cross2_x + cross2_y * cross2_y + cross2_z * cross2_z);
    
    double base_area = area1 + area2;
    
    // Compute height: distance from apex to base plane
    // Use triangle 1 to define the plane
    double normal_x = cross1_x, normal_y = cross1_y, normal_z = cross1_z;
    double norm = std::sqrt(normal_x * normal_x + normal_y * normal_y + normal_z * normal_z);
    if (norm < 1e-10) return 0.0;
    normal_x /= norm; normal_y /= norm; normal_z /= norm;
    
    // Distance from apex to plane through base_x1
    double plane_d = normal_x * base_x1 + normal_y * base_y1 + normal_z * base_z1;
    double height = std::abs(normal_x * apex_x + normal_y * apex_y + normal_z * apex_z - plane_d);
    
    return (1.0 / 3.0) * base_area * height;
}

// Compute pyramid centroid (center of mass)
void pyramid_centroid(double base_x1, double base_y1, double base_z1,
                      double base_x2, double base_y2, double base_z2,
                      double base_x3, double base_y3, double base_z3,
                      double base_x4, double base_y4, double base_z4,
                      double apex_x, double apex_y, double apex_z,
                      double& cx, double& cy, double& cz) {
    // Centroid of pyramid = (centroid of base + apex) / 2
    double base_cx = (base_x1 + base_x2 + base_x3 + base_x4) / 4.0;
    double base_cy = (base_y1 + base_y2 + base_y3 + base_y4) / 4.0;
    double base_cz = (base_z1 + base_z2 + base_z3 + base_z4) / 4.0;
    
    cx = (base_cx + apex_x) / 2.0;
    cy = (base_cy + apex_y) / 2.0;
    cz = (base_cz + apex_z) / 2.0;
}

// Helper function to subdivide a hexahedral source into 6 pyramids (one per face)
void subdivide_hexahedron_to_pyramids(
    double x, double y, double z, double volume, double density,
    std::vector<Source>& poly_sources) {
    double cube_size = std::pow(volume, 1.0/3.0);
    double half_size = cube_size / 2.0;
    double x0 = x - half_size, x1 = x + half_size;
    double y0 = y - half_size, y1 = y + half_size;
    double z0 = z - half_size, z1 = z + half_size;
    
    // Center point (apex for all pyramids)
    double cx = x, cy = y, cz = z;
    
    // Pyramid 1: Base face at x = x0 (front face)
    double vol1 = pyramid_volume(x0,y0,z0, x0,y1,z0, x0,y1,z1, x0,y0,z1, cx, cy, cz);
    double cx1, cy1, cz1;
    pyramid_centroid(x0,y0,z0, x0,y1,z0, x0,y1,z1, x0,y0,z1, cx, cy, cz, cx1, cy1, cz1);
    Source s1; s1.x = cx1; s1.y = cy1; s1.z = cz1; s1.density = density; s1.volume = vol1;
    poly_sources.push_back(s1);
    
    // Pyramid 2: Base face at x = x1 (back face)
    double vol2 = pyramid_volume(x1,y0,z0, x1,y0,z1, x1,y1,z1, x1,y1,z0, cx, cy, cz);
    double cx2, cy2, cz2;
    pyramid_centroid(x1,y0,z0, x1,y0,z1, x1,y1,z1, x1,y1,z0, cx, cy, cz, cx2, cy2, cz2);
    Source s2; s2.x = cx2; s2.y = cy2; s2.z = cz2; s2.density = density; s2.volume = vol2;
    poly_sources.push_back(s2);
    
    // Pyramid 3: Base face at y = y0 (left face)
    double vol3 = pyramid_volume(x0,y0,z0, x1,y0,z0, x1,y0,z1, x0,y0,z1, cx, cy, cz);
    double cx3, cy3, cz3;
    pyramid_centroid(x0,y0,z0, x1,y0,z0, x1,y0,z1, x0,y0,z1, cx, cy, cz, cx3, cy3, cz3);
    Source s3; s3.x = cx3; s3.y = cy3; s3.z = cz3; s3.density = density; s3.volume = vol3;
    poly_sources.push_back(s3);
    
    // Pyramid 4: Base face at y = y1 (right face)
    double vol4 = pyramid_volume(x0,y1,z0, x0,y1,z1, x1,y1,z1, x1,y1,z0, cx, cy, cz);
    double cx4, cy4, cz4;
    pyramid_centroid(x0,y1,z0, x0,y1,z1, x1,y1,z1, x1,y1,z0, cx, cy, cz, cx4, cy4, cz4);
    Source s4; s4.x = cx4; s4.y = cy4; s4.z = cz4; s4.density = density; s4.volume = vol4;
    poly_sources.push_back(s4);
    
    // Pyramid 5: Base face at z = z0 (bottom face)
    double vol5 = pyramid_volume(x0,y0,z0, x0,y1,z0, x1,y1,z0, x1,y0,z0, cx, cy, cz);
    double cx5, cy5, cz5;
    pyramid_centroid(x0,y0,z0, x0,y1,z0, x1,y1,z0, x1,y0,z0, cx, cy, cz, cx5, cy5, cz5);
    Source s5; s5.x = cx5; s5.y = cy5; s5.z = cz5; s5.density = density; s5.volume = vol5;
    poly_sources.push_back(s5);
    
    // Pyramid 6: Base face at z = z1 (top face)
    double vol6 = pyramid_volume(x0,y0,z1, x1,y0,z1, x1,y1,z1, x0,y1,z1, cx, cy, cz);
    double cx6, cy6, cz6;
    pyramid_centroid(x0,y0,z1, x1,y0,z1, x1,y1,z1, x0,y1,z1, cx, cy, cz, cx6, cy6, cz6);
    Source s6; s6.x = cx6; s6.y = cy6; s6.z = cz6; s6.density = density; s6.volume = vol6;
    poly_sources.push_back(s6);
}

// ============================================================================
// POLYHEDRAL Source Generation Functions
// ============================================================================

std::vector<Source> generate_cube_sources_polyhedral(
    double center_x, double center_y, double center_z,
    double size_x, double size_y, double size_z,
    double density,
    int num_sources_x, int num_sources_y, int num_sources_z
) {
    std::vector<Source> sources;
    
    double dx = size_x / num_sources_x;
    double dy = size_y / num_sources_y;
    double dz = size_z / num_sources_z;
    double volume_per_cell = dx * dy * dz;
    
    double x0 = center_x - size_x / 2.0;
    double y0 = center_y - size_y / 2.0;
    double z0 = center_z - size_z / 2.0;
    
    for (int i = 0; i < num_sources_x; i++) {
        for (int j = 0; j < num_sources_y; j++) {
            for (int k = 0; k < num_sources_z; k++) {
                double x = x0 + (i + 0.5) * dx;
                double y = y0 + (j + 0.5) * dy;
                double z = z0 + (k + 0.5) * dz;
                
                subdivide_hexahedron_to_pyramids(x, y, z, volume_per_cell, density, sources);
            }
        }
    }
    
    return sources;
}

// For other shapes, generate hexahedral sources first, then subdivide
std::vector<Source> generate_sphere_sources_polyhedral(
    double center_x, double center_y, double center_z,
    double radius,
    double density,
    int num_sources_radial, int num_sources_theta, int num_sources_phi
) {
    // Generate hexahedral sources first, then subdivide
    std::vector<Source> hex_sources = generate_sphere_sources_hexahedral(
        center_x, center_y, center_z, radius, density,
        num_sources_radial, num_sources_theta, num_sources_phi
    );
    
    std::vector<Source> poly_sources;
    for (const auto& hex : hex_sources) {
        subdivide_hexahedron_to_pyramids(hex.x, hex.y, hex.z, hex.volume, hex.density, poly_sources);
    }
    
    return poly_sources;
}

std::vector<Source> generate_ellipsoid_sources_polyhedral(
    double center_x, double center_y, double center_z,
    double a, double b, double c,
    double density,
    int num_sources_x, int num_sources_y, int num_sources_z
) {
    std::vector<Source> hex_sources = generate_ellipsoid_sources_hexahedral(
        center_x, center_y, center_z, a, b, c, density,
        num_sources_x, num_sources_y, num_sources_z
    );
    
    std::vector<Source> poly_sources;
    for (const auto& hex : hex_sources) {
        subdivide_hexahedron_to_pyramids(hex.x, hex.y, hex.z, hex.volume, hex.density, poly_sources);
    }
    
    return poly_sources;
}

std::vector<Source> generate_vertical_cylinder_sources_polyhedral(
    double center_x, double center_y, double center_z,
    double radius, double height,
    double density,
    int num_sources_radial, int num_sources_theta, int num_sources_z
) {
    std::vector<Source> hex_sources = generate_vertical_cylinder_sources_hexahedral(
        center_x, center_y, center_z, radius, height, density,
        num_sources_radial, num_sources_theta, num_sources_z
    );
    
    std::vector<Source> poly_sources;
    for (const auto& hex : hex_sources) {
        subdivide_hexahedron_to_pyramids(hex.x, hex.y, hex.z, hex.volume, hex.density, poly_sources);
    }
    
    return poly_sources;
}

std::vector<Source> generate_horizontal_cylinder_sources_polyhedral(
    double center_x, double center_y, double center_z,
    double radius, double length,
    double density,
    int num_sources_radial, int num_sources_theta, int num_sources_length
) {
    std::vector<Source> hex_sources = generate_horizontal_cylinder_sources_hexahedral(
        center_x, center_y, center_z, radius, length, density,
        num_sources_radial, num_sources_theta, num_sources_length
    );
    
    std::vector<Source> poly_sources;
    for (const auto& hex : hex_sources) {
        subdivide_hexahedron_to_pyramids(hex.x, hex.y, hex.z, hex.volume, hex.density, poly_sources);
    }
    
    return poly_sources;
}

std::vector<Source> generate_salt_dome_sources_polyhedral(
    double center_x, double center_y, double center_z,
    double base_radius, double top_radius, double height,
    double density,
    int num_sources_radial, int num_sources_theta, int num_sources_z
) {
    std::vector<Source> hex_sources = generate_salt_dome_sources_hexahedral(
        center_x, center_y, center_z, base_radius, top_radius, height, density,
        num_sources_radial, num_sources_theta, num_sources_z
    );
    
    std::vector<Source> poly_sources;
    for (const auto& hex : hex_sources) {
        subdivide_hexahedron_to_pyramids(hex.x, hex.y, hex.z, hex.volume, hex.density, poly_sources);
    }
    
    return poly_sources;
}

std::vector<Source> generate_faulted_block_sources_polyhedral(
    double center_x, double center_y, double center_z,
    double size_x, double size_y, double size_z,
    double fault_offset,
    double density,
    int num_sources_x, int num_sources_y, int num_sources_z
) {
    std::vector<Source> hex_sources = generate_faulted_block_sources_hexahedral(
        center_x, center_y, center_z, size_x, size_y, size_z, fault_offset, density,
        num_sources_x, num_sources_y, num_sources_z
    );
    
    std::vector<Source> poly_sources;
    for (const auto& hex : hex_sources) {
        subdivide_hexahedron_to_pyramids(hex.x, hex.y, hex.z, hex.volume, hex.density, poly_sources);
    }
    
    return poly_sources;
}

std::vector<Source> generate_layered_basin_sources_polyhedral(
    double center_x, double center_y, double center_z,
    double size_x, double size_y,
    double layer1_thickness, double layer2_thickness, double layer3_thickness,
    double layer1_density, double layer2_density, double layer3_density,
    int num_sources_x, int num_sources_y, int num_sources_z,
    double relief_wavelength
) {
    std::vector<Source> hex_sources = generate_layered_basin_sources_hexahedral(
        center_x, center_y, center_z, size_x, size_y,
        layer1_thickness, layer2_thickness, layer3_thickness,
        layer1_density, layer2_density, layer3_density,
        num_sources_x, num_sources_y, num_sources_z,
        relief_wavelength
    );
    
    std::vector<Source> poly_sources;
    for (const auto& hex : hex_sources) {
        subdivide_hexahedron_to_pyramids(hex.x, hex.y, hex.z, hex.volume, hex.density, poly_sources);
    }
    
    return poly_sources;
}

std::vector<Source> generate_voxel_density_sources_polyhedral(
    double center_x, double center_y, double center_z,
    double size_x, double size_y, double size_z,
    double voxel_size,
    double density,
    int num_sources_x, int num_sources_y, int num_sources_z
) {
    std::vector<Source> hex_sources = generate_voxel_density_sources_hexahedral(
        center_x, center_y, center_z, size_x, size_y, size_z, voxel_size, density,
        num_sources_x, num_sources_y, num_sources_z
    );
    
    std::vector<Source> poly_sources;
    for (const auto& hex : hex_sources) {
        subdivide_hexahedron_to_pyramids(hex.x, hex.y, hex.z, hex.volume, hex.density, poly_sources);
    }
    
    return poly_sources;
}

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
) {
    // Generate hexahedral sources first
    std::vector<Source> hex_sources = generate_four_cubes_sources_hexahedral(
        center_x, center_y, center_z,
        cube1_x, cube1_y, cube1_z, cube1_h, cube1_density,
        cube2_x, cube2_y, cube2_z, cube2_h, cube2_density,
        cube3_x, cube3_y, cube3_z, cube3_h, cube3_density,
        cube4_x, cube4_y, cube4_z, cube4_h, cube4_density,
        spacing_x, spacing_y,
        cube1_offset_x, cube1_offset_y,
        cube2_offset_x, cube2_offset_y,
        cube3_offset_x, cube3_offset_y,
        cube4_offset_x, cube4_offset_y,
        num_sources_x, num_sources_y, num_sources_z
    );
    
    // Subdivide each hexahedral source into 6 pyramids
    std::vector<Source> poly_sources;
    for (const auto& hex : hex_sources) {
        subdivide_hexahedron_to_pyramids(hex.x, hex.y, hex.z, hex.volume, hex.density, poly_sources);
    }
    return poly_sources;
}
