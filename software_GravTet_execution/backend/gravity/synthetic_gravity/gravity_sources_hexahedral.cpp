// gravity_sources_hexahedral.cpp: synthetic gravity — discrete sources for forward models.
#include "gravity_sources_hexahedral.h"
#include <cmath>
#include <algorithm>

constexpr double PI = 3.14159265358979323846;

double valley_mountain_display_relief_x(
    double x_rel,
    double size_x,
    double mountain_height,
    double valley_depth
) {
    const double mountain_center = -0.22 * size_x;
    const double valley_center = 0.24 * size_x;
    const double mountain_sigma = std::max(1e-9, 0.16 * size_x);
    const double valley_sigma = std::max(1e-9, 0.17 * size_x);
    const double mountain = mountain_height * std::exp(
        -((x_rel - mountain_center) * (x_rel - mountain_center)) /
        (2.0 * mountain_sigma * mountain_sigma)
    );
    const double valley = valley_depth * std::exp(
        -((x_rel - valley_center) * (x_rel - valley_center)) /
        (2.0 * valley_sigma * valley_sigma)
    );
    return mountain - valley;
}

// ============================================================================
// Unified Coordinate System: (X, Y, Z=depth)
// This file implements hexahedral source generation using direct mapping.
// center_x -> X (horizontal)
// center_y -> Y (horizontal)
// center_z -> Z (vertical depth)
// ============================================================================

std::vector<Source> generate_cube_sources_hexahedral(
    double center_x, double center_y, double center_z,
    double size_x, double size_y, double size_z,
    double density,
    int num_sources_x, int num_sources_y, int num_sources_z
) {
    std::vector<Source> sources;
    
    double dx = size_x / num_sources_x;
    double dy = size_y / num_sources_y;
    double dz = size_z / num_sources_z;
    double voxel_volume = dx * dy * dz;
    
    double x_start = center_x - size_x / 2.0 + dx / 2.0;
    double y_start = center_y - size_y / 2.0 + dy / 2.0;
    double z_start = center_z - size_z / 2.0 + dz / 2.0;
    
    for (int i = 0; i < num_sources_x; i++) {
        for (int j = 0; j < num_sources_y; j++) {
            for (int k = 0; k < num_sources_z; k++) {
                Source s;
                s.x = x_start + i * dx;
                s.y = y_start + j * dy;
                s.z = z_start + k * dz;
                s.density = density;
                s.volume = voxel_volume;
                sources.push_back(s);
            }
        }
    }
    return sources;
}

std::vector<Source> generate_sphere_sources_hexahedral(
    double center_x, double center_y, double center_z,
    double radius,
    double density,
    int num_sources_radial, int num_sources_theta, int num_sources_phi
) {
    std::vector<Source> sources;
    double dr = radius / num_sources_radial;
    double dtheta = 2.0 * PI / num_sources_theta;
    double dphi = PI / num_sources_phi;
    
    for (int i = 0; i < num_sources_radial; i++) {
        double r_inner = i * dr;
        double r_outer = (i + 1) * dr;
        double r_avg = (r_inner + r_outer) / 2.0;
        double dr_actual = r_outer - r_inner;
        
        for (int j = 0; j < num_sources_theta; j++) {
            double theta = j * dtheta;
            for (int k = 0; k < num_sources_phi; k++) {
                double phi = k * dphi + dphi / 2.0;
                double volume = r_avg * r_avg * sin(phi) * dr_actual * dtheta * dphi;
                
                Source s;
                s.x = center_x + r_avg * sin(phi) * cos(theta);
                s.y = center_y + r_avg * sin(phi) * sin(theta);
                s.z = center_z + r_avg * cos(phi);
                s.density = density;
                s.volume = volume;
                sources.push_back(s);
            }
        }
    }
    return sources;
}

std::vector<Source> generate_ellipsoid_sources_hexahedral(
    double center_x, double center_y, double center_z,
    double a, double b, double c,
    double density,
    int num_sources_x, int num_sources_y, int num_sources_z
) {
    std::vector<Source> sources;
    double dx = 2.0 * a / num_sources_x;
    double dy = 2.0 * b / num_sources_y;
    double dz = 2.0 * c / num_sources_z;
    double voxel_vol = dx * dy * dz;
    
    double x_start = center_x - a + dx / 2.0;
    double y_start = center_y - b + dy / 2.0;
    double z_start = center_z - c + dz / 2.0;
    
    for (int i = 0; i < num_sources_x; i++) {
        for (int j = 0; j < num_sources_y; j++) {
            for (int k = 0; k < num_sources_z; k++) {
                double x = x_start + i * dx;
                double y = y_start + j * dy;
                double z = z_start + k * dz;
                
                double normalized_dist = std::pow((x - center_x)/a, 2) + 
                                       std::pow((y - center_y)/b, 2) + 
                                       std::pow((z - center_z)/c, 2);
                
                if (normalized_dist <= 1.0) {
                    Source s;
                    s.x = x; s.y = y; s.z = z;
                    s.density = density;
                    s.volume = voxel_vol;
                    sources.push_back(s);
                }
            }
        }
    }
    return sources;
}

std::vector<Source> generate_vertical_cylinder_sources_hexahedral(
    double center_x, double center_y, double center_z,
    double radius, double height,
    double density,
    int num_sources_radial, int num_sources_theta, int num_sources_z
) {
    std::vector<Source> sources;
    double dr = radius / num_sources_radial;
    double dtheta = 2.0 * PI / num_sources_theta;
    double dz = height / num_sources_z;
    double z_start = center_z - height / 2.0 + dz / 2.0;
    
    for (int i = 0; i < num_sources_radial; i++) {
        double r_avg = (i + 0.5) * dr;
        for (int j = 0; j < num_sources_theta; j++) {
            double theta = j * dtheta;
            for (int k = 0; k < num_sources_z; k++) {
                Source s;
                s.x = center_x + r_avg * cos(theta);
                s.y = center_y + r_avg * sin(theta);
                s.z = z_start + k * dz;
                s.density = density;
                s.volume = r_avg * dr * dtheta * dz;
                sources.push_back(s);
            }
        }
    }
    return sources;
}

std::vector<Source> generate_horizontal_cylinder_sources_hexahedral(
    double center_x, double center_y, double center_z,
    double radius, double length,
    double density,
    int num_sources_radial, int num_sources_theta, int num_sources_length
) {
    std::vector<Source> sources;
    double dr = radius / num_sources_radial;
    double dtheta = 2.0 * PI / num_sources_theta;
    double dl = length / num_sources_length;
    double l_start = center_x - length / 2.0 + dl / 2.0;
    
    for (int i = 0; i < num_sources_radial; i++) {
        double r_avg = (i + 0.5) * dr;
        for (int j = 0; j < num_sources_theta; j++) {
            double theta = j * dtheta;
            for (int k = 0; k < num_sources_length; k++) {
                Source s;
                s.x = l_start + k * dl;
                s.y = center_y + r_avg * cos(theta);
                s.z = center_z + r_avg * sin(theta);
                s.density = density;
                s.volume = r_avg * dr * dtheta * dl;
                sources.push_back(s);
            }
        }
    }
    return sources;
}

std::vector<Source> generate_salt_dome_sources_hexahedral(
    double center_x, double center_y, double center_z,
    double base_radius, double top_radius, double height,
    double density,
    int num_sources_radial, int num_sources_theta, int num_sources_z
) {
    std::vector<Source> sources;
    double dz = height / num_sources_z;
    double dtheta = 2.0 * PI / num_sources_theta;
    double z_start = center_z - height / 2.0 + dz / 2.0;
    
    for (int k = 0; k < num_sources_z; k++) {
        double z = z_start + k * dz;
        double z_normalized = (z - (center_z - height / 2.0)) / height;
        double radius_at_z = base_radius + (top_radius - base_radius) * z_normalized;
        double dr = radius_at_z / num_sources_radial;
        
        for (int i = 0; i < num_sources_radial; i++) {
            double r_avg = (i + 0.5) * dr;
            for (int j = 0; j < num_sources_theta; j++) {
                double theta = j * dtheta;
                Source s;
                s.x = center_x + r_avg * cos(theta);
                s.y = center_y + r_avg * sin(theta);
                s.z = z;
                s.density = density;
                s.volume = r_avg * dr * dtheta * dz;
                sources.push_back(s);
            }
        }
    }
    return sources;
}

std::vector<Source> generate_faulted_block_sources_hexahedral(
    double center_x, double center_y, double center_z,
    double size_x, double size_y, double size_z,
    double fault_offset,
    double density,
    int num_sources_x, int num_sources_y, int num_sources_z
) {
    std::vector<Source> sources;
    double dx = size_x / num_sources_x;
    double dy = size_y / num_sources_y;
    double dz = size_z / num_sources_z;
    double vol = dx * dy * dz;
    
    double x_start = center_x - size_x / 2.0 + dx / 2.0;
    double y_start = center_y - size_y / 2.0 + dy / 2.0;
    double z_start = center_z - size_z / 2.0 + dz / 2.0;
    
    for (int i = 0; i < num_sources_x; i++) {
        for (int j = 0; j < num_sources_y; j++) {
            for (int k = 0; k < num_sources_z; k++) {
                double x = x_start + i * dx;
                double y = y_start + j * dy;
                double z = z_start + k * dz;
                
                Source s;
                s.x = x; s.y = y;
                const bool left_block = (x < center_x);
                s.z = left_block ? z : z - fault_offset;
                // Keep positive density on both sides and express contrast via throw
                // (and a mild right-side density reduction). This avoids destructive
                // cancellation in fast solvers while preserving higher/lower response.
                s.density = left_block ? density : (0.7 * density);
                s.volume = vol;
                sources.push_back(s);
            }
        }
    }
    return sources;
}

std::vector<Source> generate_layered_basin_sources_hexahedral(
    double center_x, double center_y, double center_z,
    double size_x, double size_y,
    double layer1_thickness, double layer2_thickness, double layer3_thickness,
    double layer1_density, double layer2_density, double layer3_density,
    int num_sources_x, int num_sources_y, int num_sources_z,
    double relief_wavelength
) {
    std::vector<Source> sources;
    const bool valley_relief_mode =
        (layer3_density < -0.5) &&
        (layer1_density > 0.0) &&
        (layer2_density > 0.0);

    if (valley_relief_mode) {
        // Match Gmsh / catalog tetra: padded half-space host + relief-trimmed anomaly block.
        const double block_z = std::max(1e-9, std::abs(layer3_thickness));
        const double pad_x = 100.0;
        const double pad_y = 50.0;
        const double pad_z = 30.0;
        const double hs_x = size_x + 2.0 * pad_x;
        const double hs_y = size_y + 2.0 * pad_y;
        const double hs_z = block_z + pad_z;
        const int nx_hs = std::max(
            1,
            static_cast<int>(std::lround(num_sources_x * hs_x / std::max(1e-9, size_x)))
        );
        const int ny_hs = std::max(
            1,
            static_cast<int>(std::lround(num_sources_y * hs_y / std::max(1e-9, size_y)))
        );
        const int nz_hs = std::max(
            1,
            static_cast<int>(std::lround(num_sources_z * hs_z / block_z))
        );

        const double dx = hs_x / nx_hs;
        const double dy = hs_y / ny_hs;
        const double dz = hs_z / nz_hs;
        const double x_min = center_x - hs_x * 0.5;
        const double y_min = center_y - hs_y * 0.5;
        const double z_min = center_z - hs_z * 0.5;
        const double z_ref = center_z + block_z * 0.5;
        const double z_surface = 0.0;
        const double ax = size_x * 0.5;
        const double ay = size_y * 0.5;
        const double mountain_rho = std::abs(layer1_density);
        const double half_rho = std::abs(layer2_density);

        for (int i = 0; i < nx_hs; i++) {
            const double x = x_min + (i + 0.5) * dx;
            const double x_rel = x - center_x;
            for (int j = 0; j < ny_hs; j++) {
                const double y = y_min + (j + 0.5) * dy;
                const double y_rel = y - center_y;
                const bool in_anomaly = std::abs(x_rel) <= ax && std::abs(y_rel) <= ay;
                const double relief = in_anomaly
                    ? valley_mountain_display_relief_x(
                        x_rel,
                        std::max(1e-9, std::abs(size_x)),
                        std::abs(layer1_thickness),
                        std::abs(layer2_thickness)
                    )
                    : 0.0;
                const double z_top = z_ref + relief;
                for (int k = 0; k < nz_hs; k++) {
                    const double z = z_min + (k + 0.5) * dz;
                    if (z > z_surface + 1e-6 || z > z_top + 1e-6) {
                        continue;
                    }
                    const double density = in_anomaly
                        ? ((relief >= 0.0) ? mountain_rho : half_rho)
                        : half_rho;
                    Source s;
                    s.x = x;
                    s.y = y;
                    s.z = z;
                    s.density = density;
                    s.volume = dx * dy * dz;
                    sources.push_back(s);
                }
            }
        }
        return sources;
    }

    double total_h = layer1_thickness + layer2_thickness + layer3_thickness;
    double dx = size_x / num_sources_x;
    double dy = size_y / num_sources_y;
    double dz = total_h / num_sources_z;
    
    double x_start = center_x - size_x / 2.0 + dx / 2.0;
    double y_start = center_y - size_y / 2.0 + dy / 2.0;
    double z_start = center_z - total_h / 2.0 + dz / 2.0;
    const bool valley_sine_topography_mode =
        (layer3_density < -0.5) &&
        (layer1_density > 0.0) &&
        (layer2_density > 0.0);
    const bool valley_fault_style_mode =
        !valley_sine_topography_mode &&
        (std::abs(layer3_thickness) < 1e-12) &&
        (std::abs(layer3_density) < 1e-12) &&
        (layer1_thickness > 0.0) &&
        (layer2_thickness > 0.0) &&
        (layer1_density > 0.0) &&
        (layer2_density > 0.0);
    
    for (int i = 0; i < num_sources_x; i++) {
        for (int j = 0; j < num_sources_y; j++) {
            for (int k = 0; k < num_sources_z; k++) {
                double z = z_start + k * dz;
                double depth_from_top = (center_z + total_h / 2.0) - z;
                
                double density = (depth_from_top <= layer1_thickness) ? layer1_density :
                                (depth_from_top <= layer1_thickness + layer2_thickness) ? layer2_density :
                                layer3_density;
                if (valley_sine_topography_mode) {
                    const double x_rel = (x_start + i * dx) - center_x;
                    const double A = 0.5 * (std::abs(layer1_thickness) + std::abs(layer2_thickness));
                    const double lambda = std::max(
                        1e-6,
                        relief_wavelength > 0.0 ? relief_wavelength : std::abs(size_x)
                    );
                    const double relief = A * std::sin(2.0 * M_PI * x_rel / lambda);
                    density = (relief >= 0.0) ? std::abs(layer1_density) : std::abs(layer2_density);
                } else if (valley_fault_style_mode) {
                    double x = x_start + i * dx;
                    density = (x < center_x) ? std::abs(layer1_density) : std::abs(layer2_density);
                    z += (x < center_x) ? (0.5 * std::abs(layer1_thickness)) : (-0.5 * std::abs(layer2_thickness));
                }
                
                Source s;
                s.x = x_start + i * dx;
                s.y = y_start + j * dy;
                s.z = z;
                s.density = density;
                s.volume = dx * dy * dz;
                sources.push_back(s);
            }
        }
    }
    return sources;
}

std::vector<Source> generate_voxel_density_sources_hexahedral(
    double center_x, double center_y, double center_z,
    double size_x, double size_y, double size_z,
    double voxel_size,
    double density,
    int num_sources_x, int num_sources_y, int num_sources_z
) {
    std::vector<Source> sources;
    int nx = std::min(num_sources_x, (int)(size_x / voxel_size));
    int ny = std::min(num_sources_y, (int)(size_y / voxel_size));
    int nz = std::min(num_sources_z, (int)(size_z / voxel_size));
    double vol = std::pow(voxel_size, 3);
    
    // Center the voxel grid at (center_x, center_y, center_z) to match frontend display
    // Frontend uses: posX = (i - numVoxelsX / 2) * voxelSize + voxelSize / 2
    // This centers the grid at the origin when center_x = 0
    // We calculate the actual extent of the voxel grid and center it
    double actual_extent_x = nx * voxel_size;
    double actual_extent_y = ny * voxel_size;
    double actual_extent_z = nz * voxel_size;
    
    double x_start = center_x - actual_extent_x / 2.0 + voxel_size / 2.0;
    double y_start = center_y - actual_extent_y / 2.0 + voxel_size / 2.0;
    double z_start = center_z - actual_extent_z / 2.0 + voxel_size / 2.0;
    
    for (int i = 0; i < nx; i++) {
        for (int j = 0; j < ny; j++) {
            for (int k = 0; k < nz; k++) {
                Source s;
                s.x = x_start + i * voxel_size;
                s.y = y_start + j * voxel_size;
                s.z = z_start + k * voxel_size;
                s.density = density;
                s.volume = vol;
                sources.push_back(s);
            }
        }
    }
    return sources;
}

std::vector<Receiver> generate_surface_receivers(
    double x_min, double x_max,
    double y_min, double y_max,
    double z_surface,
    int num_receivers_x, int num_receivers_y
) {
    // Extent [x_min,x_max] x [y_min,y_max] is fixed; only grid density (num_receivers_x/y) changes.
    std::vector<Receiver> receivers;
    double dx = (num_receivers_x > 1) ? (x_max - x_min) / (num_receivers_x - 1) : 0.0;
    double dy = (num_receivers_y > 1) ? (y_max - y_min) / (num_receivers_y - 1) : 0.0;
    
    for (int i = 0; i < num_receivers_x; i++) {
        for (int j = 0; j < num_receivers_y; j++) {
            Receiver r;
            r.x = x_min + i * dx;
            r.y = y_min + j * dy;
            r.z = z_surface;
            receivers.push_back(r);
        }
    }
    return receivers;
}

std::vector<Source> generate_four_cubes_sources_hexahedral(
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
    std::vector<Source> sources;
    
    // Calculate positions for 4 cubes in a 2x2 grid with offsets
    // Base positions relative to center:
    // Cube 1: top-left    (-spacing_x/2, -spacing_y/2)
    // Cube 2: top-right   ( spacing_x/2, -spacing_y/2)
    // Cube 3: bottom-left (-spacing_x/2,  spacing_y/2)
    // Cube 4: bottom-right( spacing_x/2,  spacing_y/2)
    // Then add individual X and Y offsets
    
    double cube_positions[4][2] = {
        {-spacing_x / 2.0 + cube1_offset_x, -spacing_y / 2.0 + cube1_offset_y},  // Cube 1
        { spacing_x / 2.0 + cube2_offset_x, -spacing_y / 2.0 + cube2_offset_y},  // Cube 2
        {-spacing_x / 2.0 + cube3_offset_x,  spacing_y / 2.0 + cube3_offset_y},  // Cube 3
        { spacing_x / 2.0 + cube4_offset_x,  spacing_y / 2.0 + cube4_offset_y}   // Cube 4
    };
    
    double cube_dims[4][3] = {
        {cube1_x, cube1_y, cube1_z},
        {cube2_x, cube2_y, cube2_z},
        {cube3_x, cube3_y, cube3_z},
        {cube4_x, cube4_y, cube4_z}
    };
    
    double cube_depths[4] = {cube1_h, cube2_h, cube3_h, cube4_h};
    double cube_densities[4] = {cube1_density, cube2_density, cube3_density, cube4_density};
    
    // Generate sources for each cube
    for (int cube_idx = 0; cube_idx < 4; cube_idx++) {
        double cube_center_x = center_x + cube_positions[cube_idx][0];
        double cube_center_y = center_y + cube_positions[cube_idx][1];
        double cube_center_z = center_z - cube_depths[cube_idx] - cube_dims[cube_idx][2] / 2.0;
        
        double size_x = cube_dims[cube_idx][0];
        double size_y = cube_dims[cube_idx][1];
        double size_z = cube_dims[cube_idx][2];
        double density = cube_densities[cube_idx];
        
        // Generate sources for this cube
        double dx = size_x / num_sources_x;
        double dy = size_y / num_sources_y;
        double dz = size_z / num_sources_z;
        double voxel_volume = dx * dy * dz;
        
        double x_start = cube_center_x - size_x / 2.0 + dx / 2.0;
        double y_start = cube_center_y - size_y / 2.0 + dy / 2.0;
        double z_start = cube_center_z - size_z / 2.0 + dz / 2.0;
        
        for (int i = 0; i < num_sources_x; i++) {
            for (int j = 0; j < num_sources_y; j++) {
                for (int k = 0; k < num_sources_z; k++) {
                    Source s;
                    s.x = x_start + i * dx;
                    s.y = y_start + j * dy;
                    s.z = z_start + k * dz;
                    s.density = density;
                    s.volume = voxel_volume;
                    sources.push_back(s);
                }
            }
        }
    }
    
    return sources;
}
