#include "quadrature_second_order_detail.h"

namespace quadrature_second_order {
namespace detail {

namespace {

/** Map catalog Tetrahedral IDs (55–63) used by Python back to QUAD_MODEL_* (33–43). */
int canonicalize_quad_model_type(int model_type) {
    switch (model_type) {
        case 55: return QUAD_MODEL_CUBE_UNSTRUCTURED_TETRAHEDRAL;
        case 56: return QUAD_MODEL_CUBOID_UNSTRUCTURED_TETRAHEDRAL;
        case 57: return QUAD_MODEL_SPHERE_UNSTRUCTURED_TETRAHEDRAL;
        case 58: return QUAD_MODEL_ELLIPSOID_UNSTRUCTURED_TETRAHEDRAL;
        case 59: return QUAD_MODEL_VERTICAL_CYLINDER_UNSTRUCTURED_TETRAHEDRAL;
        case 60: return QUAD_MODEL_HORIZONTAL_CYLINDER_UNSTRUCTURED_TETRAHEDRAL;
        case 61: return QUAD_MODEL_FAULTED_BLOCK_UNSTRUCTURED_TETRAHEDRAL;
        case 62: return QUAD_MODEL_VALLEY_MOUNTAIN_UNSTRUCTURED_TETRAHEDRAL;
        case 63: return QUAD_MODEL_FOUR_CUBES_UNSTRUCTURED_TETRAHEDRAL;
        default: return model_type;
    }
}

} // namespace

bool is_unstructured_tetra_model_type(int model_type) {
    switch (canonicalize_quad_model_type(model_type)) {
        case QUAD_MODEL_CUBE_UNSTRUCTURED_TETRAHEDRAL:
        case QUAD_MODEL_CUBOID_UNSTRUCTURED_TETRAHEDRAL:
        case QUAD_MODEL_SPHERE_UNSTRUCTURED_TETRAHEDRAL:
        case QUAD_MODEL_ELLIPSOID_UNSTRUCTURED_TETRAHEDRAL:
        case QUAD_MODEL_VERTICAL_CYLINDER_UNSTRUCTURED_TETRAHEDRAL:
        case QUAD_MODEL_HORIZONTAL_CYLINDER_UNSTRUCTURED_TETRAHEDRAL:
        case QUAD_MODEL_FAULTED_BLOCK_UNSTRUCTURED_TETRAHEDRAL:
        case QUAD_MODEL_VALLEY_MOUNTAIN_UNSTRUCTURED_TETRAHEDRAL:
        case QUAD_MODEL_VOXEL_DENSITY_UNSTRUCTURED_TETRAHEDRAL:
        case QUAD_MODEL_FOUR_CUBES_UNSTRUCTURED_TETRAHEDRAL:
            return true;
        default:
            return false;
    }
}

} // namespace detail
} // namespace quadrature_second_order
