// Step 03 — generate unstructured tetrahedral/polyhedral source lists.
#include "source_build_internal.h"
#include "gravity_sources_unstructured_tetrahedral.h"
#include "gravity_sources_unstructured_polyhedral.h"

namespace synthetic_gravity_detail {

bool generate_unstructured_sources(const ModelParams* params, std::vector<Source>& sources) {
    switch (params->model_type) {
        case MODEL_CUBE_UNSTRUCTURED_TETRAHEDRAL:
        case MODEL_CUBOID_UNSTRUCTURED_TETRAHEDRAL:
            sources = generate_cube_sources_unstructured_tetrahedral(
                params->center_x, params->center_y, params->center_z,
                params->size_x, params->size_y, params->size_z,
                params->density,
                params->num_sources_x, params->num_sources_y, params->num_sources_z
            );
            return true;
        case MODEL_SPHERE_UNSTRUCTURED_TETRAHEDRAL:
            sources = generate_sphere_sources_unstructured_tetrahedral(
                params->center_x, params->center_y, params->center_z,
                params->radius, params->density,
                params->num_sources_radial, params->num_sources_theta, params->num_sources_phi
            );
            return true;
        case MODEL_ELLIPSOID_UNSTRUCTURED_TETRAHEDRAL:
            sources = generate_ellipsoid_sources_unstructured_tetrahedral(
                params->center_x, params->center_y, params->center_z,
                params->a, params->b, params->c, params->density,
                params->num_sources_x, params->num_sources_y, params->num_sources_z
            );
            return true;
        case MODEL_VERTICAL_CYLINDER_UNSTRUCTURED_TETRAHEDRAL:
            sources = generate_vertical_cylinder_sources_unstructured_tetrahedral(
                params->center_x, params->center_y, params->center_z,
                params->cylinder_radius, params->cylinder_height, params->density,
                params->num_sources_radial_cyl, params->num_sources_theta_cyl, params->num_sources_z
            );
            return true;
        case MODEL_HORIZONTAL_CYLINDER_UNSTRUCTURED_TETRAHEDRAL:
            sources = generate_horizontal_cylinder_sources_unstructured_tetrahedral(
                params->center_x, params->center_y, params->center_z,
                params->h_cylinder_radius, params->h_cylinder_length, params->density,
                params->num_sources_radial_hcyl, params->num_sources_theta_hcyl, params->num_sources_length
            );
            return true;
        case MODEL_FAULTED_BLOCK_UNSTRUCTURED_TETRAHEDRAL:
            sources = generate_faulted_block_sources_unstructured_tetrahedral(
                params->center_x, params->center_y, params->center_z,
                params->size_x, params->size_y, params->size_z,
                params->fault_offset, params->density,
                params->num_sources_x, params->num_sources_y, params->num_sources_z
            );
            return true;
        case MODEL_LAYERED_BASIN_UNSTRUCTURED_TETRAHEDRAL: {
            const double relief_wavelength =
                (params->layer3_density < -0.5 && params->spacing_x > 1e-6)
                    ? params->spacing_x
                    : 0.0;
            sources = generate_layered_basin_sources_unstructured_tetrahedral(
                params->center_x, params->center_y, params->center_z,
                params->size_x, params->size_y,
                params->layer1_thickness, params->layer2_thickness, params->layer3_thickness,
                params->layer1_density, params->layer2_density, params->layer3_density,
                params->num_sources_x, params->num_sources_y, params->num_sources_z,
                relief_wavelength
            );
            return true;
        }
        case MODEL_VOXEL_DENSITY_UNSTRUCTURED_TETRAHEDRAL:
            sources = generate_voxel_density_sources_unstructured_tetrahedral(
                params->center_x, params->center_y, params->center_z,
                params->size_x, params->size_y, params->size_z,
                params->voxel_size, params->density,
                params->num_sources_x, params->num_sources_y, params->num_sources_z
            );
            return true;
        case MODEL_FOUR_CUBES_UNSTRUCTURED_TETRAHEDRAL:
            sources = generate_four_cubes_sources_unstructured_tetrahedral(
                params->center_x, params->center_y, params->center_z,
                params->cube1_x, params->cube1_y, params->cube1_z, params->cube1_h, params->cube1_density,
                params->cube2_x, params->cube2_y, params->cube2_z, params->cube2_h, params->cube2_density,
                params->cube3_x, params->cube3_y, params->cube3_z, params->cube3_h, params->cube3_density,
                params->cube4_x, params->cube4_y, params->cube4_z, params->cube4_h, params->cube4_density,
                params->spacing_x, params->spacing_y,
                params->cube1_offset_x, params->cube1_offset_y,
                params->cube2_offset_x, params->cube2_offset_y,
                params->cube3_offset_x, params->cube3_offset_y,
                params->cube4_offset_x, params->cube4_offset_y,
                params->num_sources_x, params->num_sources_y, params->num_sources_z
            );
            return true;
        case MODEL_CUBE_UNSTRUCTURED_POLYHEDRAL:
        case MODEL_CUBOID_UNSTRUCTURED_POLYHEDRAL:
            sources = generate_cube_sources_unstructured_polyhedral(
                params->center_x, params->center_y, params->center_z,
                params->size_x, params->size_y, params->size_z,
                params->density,
                params->num_sources_x, params->num_sources_y, params->num_sources_z
            );
            return true;
        case MODEL_SPHERE_UNSTRUCTURED_POLYHEDRAL:
            sources = generate_sphere_sources_unstructured_polyhedral(
                params->center_x, params->center_y, params->center_z,
                params->radius, params->density,
                params->num_sources_radial, params->num_sources_theta, params->num_sources_phi
            );
            return true;
        case MODEL_ELLIPSOID_UNSTRUCTURED_POLYHEDRAL:
            sources = generate_ellipsoid_sources_unstructured_polyhedral(
                params->center_x, params->center_y, params->center_z,
                params->a, params->b, params->c, params->density,
                params->num_sources_x, params->num_sources_y, params->num_sources_z
            );
            return true;
        case MODEL_VERTICAL_CYLINDER_UNSTRUCTURED_POLYHEDRAL:
            sources = generate_vertical_cylinder_sources_unstructured_polyhedral(
                params->center_x, params->center_y, params->center_z,
                params->cylinder_radius, params->cylinder_height, params->density,
                params->num_sources_radial_cyl, params->num_sources_theta_cyl, params->num_sources_z
            );
            return true;
        case MODEL_HORIZONTAL_CYLINDER_UNSTRUCTURED_POLYHEDRAL:
            sources = generate_horizontal_cylinder_sources_unstructured_polyhedral(
                params->center_x, params->center_y, params->center_z,
                params->h_cylinder_radius, params->h_cylinder_length, params->density,
                params->num_sources_radial_hcyl, params->num_sources_theta_hcyl, params->num_sources_length
            );
            return true;
        case MODEL_FAULTED_BLOCK_UNSTRUCTURED_POLYHEDRAL:
            sources = generate_faulted_block_sources_unstructured_polyhedral(
                params->center_x, params->center_y, params->center_z,
                params->size_x, params->size_y, params->size_z,
                params->fault_offset, params->density,
                params->num_sources_x, params->num_sources_y, params->num_sources_z
            );
            return true;
        case MODEL_LAYERED_BASIN_UNSTRUCTURED_POLYHEDRAL: {
            const double relief_wavelength =
                (params->layer3_density < -0.5 && params->spacing_x > 1e-6)
                    ? params->spacing_x
                    : 0.0;
            sources = generate_layered_basin_sources_unstructured_polyhedral(
                params->center_x, params->center_y, params->center_z,
                params->size_x, params->size_y,
                params->layer1_thickness, params->layer2_thickness, params->layer3_thickness,
                params->layer1_density, params->layer2_density, params->layer3_density,
                params->num_sources_x, params->num_sources_y, params->num_sources_z,
                relief_wavelength
            );
            return true;
        }
        case MODEL_VOXEL_DENSITY_UNSTRUCTURED_POLYHEDRAL:
            sources = generate_voxel_density_sources_unstructured_polyhedral(
                params->center_x, params->center_y, params->center_z,
                params->size_x, params->size_y, params->size_z,
                params->voxel_size, params->density,
                params->num_sources_x, params->num_sources_y, params->num_sources_z
            );
            return true;
        case MODEL_FOUR_CUBES_UNSTRUCTURED_POLYHEDRAL:
            sources = generate_four_cubes_sources_unstructured_polyhedral(
                params->center_x, params->center_y, params->center_z,
                params->cube1_x, params->cube1_y, params->cube1_z, params->cube1_h, params->cube1_density,
                params->cube2_x, params->cube2_y, params->cube2_z, params->cube2_h, params->cube2_density,
                params->cube3_x, params->cube3_y, params->cube3_z, params->cube3_h, params->cube3_density,
                params->cube4_x, params->cube4_y, params->cube4_z, params->cube4_h, params->cube4_density,
                params->spacing_x, params->spacing_y,
                params->cube1_offset_x, params->cube1_offset_y,
                params->cube2_offset_x, params->cube2_offset_y,
                params->cube3_offset_x, params->cube3_offset_y,
                params->cube4_offset_x, params->cube4_offset_y,
                params->num_sources_x, params->num_sources_y, params->num_sources_z
            );
            return true;
        default:
            return false;
    }
}

} // namespace synthetic_gravity_detail

