#pragma once

// Internal source-discretization helpers for `synthetic_gravity`.
//
// This is the one place that turns a synthetic `ModelParams` into a flat
// list of `Source` points (structured or unstructured). It is implemented
// entirely inside `synthetic_gravity` so that no forward-method folder
// (Direct Newton, AMFM, Barnes-Hut, Quadrature) needs to exist for this
// library to build. Any solver may call the neutral extern "C" entry points
// in ../common/model_params.h without depending on this header directly.
#include "../common/model_params.h"
#include "../common/source_types.h"
#include <vector>

namespace synthetic_gravity_detail {

bool is_unstructured_model_type(int model_type);
bool generate_unstructured_sources(const ModelParams* params, std::vector<Source>& sources);
bool generate_structured_sources(const ModelParams* params, std::vector<Source>& sources);
bool fill_all_sources_from_params(const ModelParams* params, std::vector<Source>& sources);
SourceArray* sources_to_array(const std::vector<Source>& sources);

} // namespace synthetic_gravity_detail
