// gravity_sources_tetrahedral.cpp: synthetic gravity — discrete sources for forward models.
#include "gravity_sources_tetrahedral.h"
#include <cmath>
#include <algorithm>

// ============================================================================
// Unified Coordinate System: (X, Y, Z=depth)
// This file implements tetrahedral source generation by subdividing hexahedral
// elements into 5 tetrahedra each.
// ============================================================================

// ============================================================================
// Helper Functions for Tetrahedral Meshing
// ============================================================================

// Compute tetrahedron volume using scalar triple product
double tetrahedron_volume(double x1, double y1, double z1,
                         double x2, double y2, double z2,
                         double x3, double y3, double z3,
                         double x4, double y4, double z4) {
    // Vectors from vertex 1 to vertices 2, 3, 4
    double v21x = x2 - x1, v21y = y2 - y1, v21z = z2 - z1;
    double v31x = x3 - x1, v31y = y3 - y1, v31z = z3 - z1;
    double v41x = x4 - x1, v41y = y4 - y1, v41z = z4 - z1;
    
    // Cross product: v21 × v31
    double cross_x = v21y * v31z - v21z * v31y;
    double cross_y = v21z * v31x - v21x * v31z;
    double cross_z = v21x * v31y - v21y * v31x;
    
    // Dot product with v41, then absolute value and divide by 6
    double volume = std::abs(cross_x * v41x + cross_y * v41y + cross_z * v41z) / 6.0;
    return volume;
}

// Compute tetrahedron centroid (center of mass)
void tetrahedron_centroid(double x1, double y1, double z1,
                         double x2, double y2, double z2,
                         double x3, double y3, double z3,
                         double x4, double y4, double z4,
                         double& cx, double& cy, double& cz) {
    cx = (x1 + x2 + x3 + x4) / 4.0;
    cy = (y1 + y2 + y3 + y4) / 4.0;
    cz = (z1 + z2 + z3 + z4) / 4.0;
}

static void append_six_tetra_from_cell(
    double x0, double x1, double y0, double y1, double z0, double z1,
    double density,
    std::vector<Source>& tetra_sources
) {
    auto push_tet = [&](double ax, double ay, double az,
                        double bx, double by, double bz,
                        double cx, double cy, double cz,
                        double dx, double dy, double dz) {
        double vol = tetrahedron_volume(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz);
        double cxm, cym, czm;
        tetrahedron_centroid(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, cxm, cym, czm);
        Source s;
        s.x = cxm;
        s.y = cym;
        s.z = czm;
        s.density = density;
        s.volume = vol;
        tetra_sources.push_back(s);
    };

    // Fixed-diagonal 6-tet split (apex at n7) — partitions the hexa exactly once.
    push_tet(x0,y0,z0, x1,y0,z0, x0,y1,z0, x1,y1,z1);
    push_tet(x0,y0,z0, x0,y1,z0, x1,y1,z0, x1,y1,z1);
    push_tet(x0,y0,z0, x0,y1,z0, x0,y0,z1, x1,y1,z1);
    push_tet(x0,y0,z0, x0,y0,z1, x1,y0,z1, x1,y1,z1);
    push_tet(x0,y0,z0, x1,y0,z0, x1,y0,z1, x1,y1,z1);
    push_tet(x0,y0,z0, x1,y0,z0, x1,y1,z0, x1,y1,z1);
}

static void append_five_tetra_from_cell(
    double x0, double x1, double y0, double y1, double z0, double z1,
    double density,
    std::vector<Source>& tetra_sources,
    bool flip_z
) {
    const double zl = flip_z ? z1 : z0;
    const double zh = flip_z ? z0 : z1;

    double vol1 = tetrahedron_volume(x0,y0,zl, x1,y0,zl, x0,y1,zl, x0,y0,zh);
    double cx1, cy1, cz1;
    tetrahedron_centroid(x0,y0,zl, x1,y0,zl, x0,y1,zl, x0,y0,zh, cx1, cy1, cz1);
    Source s1; s1.x = cx1; s1.y = cy1; s1.z = cz1; s1.density = density; s1.volume = vol1;
    tetra_sources.push_back(s1);

    double vol2 = tetrahedron_volume(x1,y1,zl, x1,y0,zl, x0,y1,zl, x1,y1,zh);
    double cx2, cy2, cz2;
    tetrahedron_centroid(x1,y1,zl, x1,y0,zl, x0,y1,zl, x1,y1,zh, cx2, cy2, cz2);
    Source s2; s2.x = cx2; s2.y = cy2; s2.z = cz2; s2.density = density; s2.volume = vol2;
    tetra_sources.push_back(s2);

    double vol3 = tetrahedron_volume(x1,y0,zh, x1,y0,zl, x0,y0,zh, x1,y1,zh);
    double cx3, cy3, cz3;
    tetrahedron_centroid(x1,y0,zh, x1,y0,zl, x0,y0,zh, x1,y1,zh, cx3, cy3, cz3);
    Source s3; s3.x = cx3; s3.y = cy3; s3.z = cz3; s3.density = density; s3.volume = vol3;
    tetra_sources.push_back(s3);

    double vol4 = tetrahedron_volume(x0,y1,zh, x0,y1,zl, x0,y0,zh, x1,y1,zh);
    double cx4, cy4, cz4;
    tetrahedron_centroid(x0,y1,zh, x0,y1,zl, x0,y0,zh, x1,y1,zh, cx4, cy4, cz4);
    Source s4; s4.x = cx4; s4.y = cy4; s4.z = cz4; s4.density = density; s4.volume = vol4;
    tetra_sources.push_back(s4);

    double vol5 = tetrahedron_volume(x0,y0,zh, x1,y0,zh, x0,y1,zh, x1,y1,zh);
    double cx5, cy5, cz5;
    tetrahedron_centroid(x0,y0,zh, x1,y0,zh, x0,y1,zh, x1,y1,zh, cx5, cy5, cz5);
    Source s5; s5.x = cx5; s5.y = cy5; s5.z = cz5; s5.density = density; s5.volume = vol5;
    tetra_sources.push_back(s5);
}

// Helper function to subdivide a hexahedral source into 5 tetrahedra
void subdivide_hexahedron_to_tetrahedra(
    double x, double y, double z, double volume, double density,
    std::vector<Source>& tetra_sources) {
    double cube_size = std::pow(volume, 1.0/3.0);
    double half_size = cube_size / 2.0;
    double x0 = x - half_size, x1 = x + half_size;
    double y0 = y - half_size, y1 = y + half_size;
    double z0 = z - half_size, z1 = z + half_size;
    append_six_tetra_from_cell(x0, x1, y0, y1, z0, z1, density, tetra_sources);
}

// ============================================================================
// TETRAHEDRAL Source Generation Functions
// ============================================================================

std::vector<Source> generate_cube_sources_tetrahedral(
    double center_x, double center_y, double center_z,
    double size_x, double size_y, double size_z,
    double density,
    int num_sources_x, int num_sources_y, int num_sources_z
) {
    std::vector<Source> sources;
    
    double dx = size_x / num_sources_x;
    double dy = size_y / num_sources_y;
    double dz = size_z / num_sources_z;
    
    double x_start = center_x - size_x / 2.0;
    double y_start = center_y - size_y / 2.0;
    double z_start = center_z - size_z / 2.0;
    
    // Subdivide each hexahedral element into 6 tetrahedra (exact partition).
    for (int i = 0; i < num_sources_x; i++) {
        for (int j = 0; j < num_sources_y; j++) {
            for (int k = 0; k < num_sources_z; k++) {
                // Hexahedron corners
                double x0 = x_start + i * dx;
                double y0 = y_start + j * dy;
                double z0 = z_start + k * dz;
                double x1 = x0 + dx;
                double y1 = y0 + dy;
                double z1 = z0 + dz;
                
                append_six_tetra_from_cell(x0, x1, y0, y1, z0, z1, density, sources);
            }
        }
    }
    return sources;
}

// For other shapes, we'll generate hexahedral elements first, then subdivide
// This is a simplified approach - in production, you'd want shape-specific tetrahedral meshing

std::vector<Source> generate_sphere_sources_tetrahedral(
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
    
    // For sphere, we approximate by treating each source as a small cube and subdividing
    // This is a simplified approach
    std::vector<Source> tetra_sources;
    for (const auto& hex_src : hex_sources) {
        subdivide_hexahedron_to_tetrahedra(hex_src.x, hex_src.y, hex_src.z, hex_src.volume, density, tetra_sources);
    }
    return tetra_sources;
}

// Similar approach for other shapes - generate hexahedral, then subdivide
std::vector<Source> generate_ellipsoid_sources_tetrahedral(
    double center_x, double center_y, double center_z,
    double a, double b, double c,
    double density,
    int num_sources_x, int num_sources_y, int num_sources_z
) {
    std::vector<Source> hex_sources = generate_ellipsoid_sources_hexahedral(
        center_x, center_y, center_z, a, b, c, density,
        num_sources_x, num_sources_y, num_sources_z
    );
    
    std::vector<Source> tetra_sources;
    for (const auto& hex_src : hex_sources) {
        subdivide_hexahedron_to_tetrahedra(hex_src.x, hex_src.y, hex_src.z, hex_src.volume, density, tetra_sources);
    }
    return tetra_sources;
}

std::vector<Source> generate_vertical_cylinder_sources_tetrahedral(
    double center_x, double center_y, double center_z,
    double radius, double height,
    double density,
    int num_sources_radial, int num_sources_theta, int num_sources_z
) {
    std::vector<Source> hex_sources = generate_vertical_cylinder_sources_hexahedral(
        center_x, center_y, center_z, radius, height, density,
        num_sources_radial, num_sources_theta, num_sources_z
    );
    std::vector<Source> tetra_sources;
    for (const auto& hex_src : hex_sources) {
        subdivide_hexahedron_to_tetrahedra(hex_src.x, hex_src.y, hex_src.z, hex_src.volume, density, tetra_sources);
    }
    return tetra_sources;
}

std::vector<Source> generate_horizontal_cylinder_sources_tetrahedral(
    double center_x, double center_y, double center_z,
    double radius, double length,
    double density,
    int num_sources_radial, int num_sources_theta, int num_sources_length
) {
    std::vector<Source> hex_sources = generate_horizontal_cylinder_sources_hexahedral(
        center_x, center_y, center_z, radius, length, density,
        num_sources_radial, num_sources_theta, num_sources_length
    );
    std::vector<Source> tetra_sources;
    for (const auto& hex_src : hex_sources) {
        subdivide_hexahedron_to_tetrahedra(hex_src.x, hex_src.y, hex_src.z, hex_src.volume, density, tetra_sources);
    }
    return tetra_sources;
}

std::vector<Source> generate_salt_dome_sources_tetrahedral(
    double center_x, double center_y, double center_z,
    double base_radius, double top_radius, double height,
    double density,
    int num_sources_radial, int num_sources_theta, int num_sources_z
) {
    std::vector<Source> hex_sources = generate_salt_dome_sources_hexahedral(
        center_x, center_y, center_z, base_radius, top_radius, height, density,
        num_sources_radial, num_sources_theta, num_sources_z
    );
    std::vector<Source> tetra_sources;
    for (const auto& hex_src : hex_sources) {
        subdivide_hexahedron_to_tetrahedra(hex_src.x, hex_src.y, hex_src.z, hex_src.volume, density, tetra_sources);
    }
    return tetra_sources;
}

std::vector<Source> generate_faulted_block_sources_tetrahedral(
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
    std::vector<Source> tetra_sources;
    for (const auto& hex_src : hex_sources) {
        subdivide_hexahedron_to_tetrahedra(hex_src.x, hex_src.y, hex_src.z, hex_src.volume, density, tetra_sources);
    }
    return tetra_sources;
}

std::vector<Source> generate_layered_basin_sources_tetrahedral(
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
    std::vector<Source> tetra_sources;
    for (const auto& hex_src : hex_sources) {
        subdivide_hexahedron_to_tetrahedra(hex_src.x, hex_src.y, hex_src.z, hex_src.volume, hex_src.density, tetra_sources);
    }
    return tetra_sources;
}

std::vector<Source> generate_voxel_density_sources_tetrahedral(
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
    std::vector<Source> tetra_sources;
    for (const auto& hex_src : hex_sources) {
        subdivide_hexahedron_to_tetrahedra(hex_src.x, hex_src.y, hex_src.z, hex_src.volume, density, tetra_sources);
    }
    return tetra_sources;
}

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
    
    // Subdivide each hexahedral source into 5 tetrahedra
    std::vector<Source> tetra_sources;
    for (const auto& hex_src : hex_sources) {
        subdivide_hexahedron_to_tetrahedra(hex_src.x, hex_src.y, hex_src.z, hex_src.volume, hex_src.density, tetra_sources);
    }
    return tetra_sources;
}
