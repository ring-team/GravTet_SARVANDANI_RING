// Model-type classification helper for discretization routing.
#include "source_build_internal.h"

namespace synthetic_gravity_detail {

bool is_unstructured_model_type(int model_type) {
    return model_type >= MODEL_CUBE_UNSTRUCTURED_TETRAHEDRAL &&
           model_type <= MODEL_FOUR_CUBES_UNSTRUCTURED_POLYHEDRAL;
}

} // namespace synthetic_gravity_detail
