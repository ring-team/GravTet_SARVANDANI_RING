// Step 06 — bridge Source vector <-> FFI SourceArray.
#include "source_build_internal.h"

namespace synthetic_gravity_detail {

SourceArray* sources_to_array(const std::vector<Source>& sources) {
    if (sources.empty()) {
        return nullptr;
    }

    SourceArray* arr = new SourceArray;
    arr->size = sources.size();
    arr->x = new double[arr->size];
    arr->y = new double[arr->size];
    arr->z = new double[arr->size];
    arr->density = new double[arr->size];
    arr->volume = new double[arr->size];

    for (size_t i = 0; i < sources.size(); i++) {
        arr->x[i] = sources[i].x;
        arr->y[i] = sources[i].y;
        arr->z[i] = sources[i].z;
        arr->density[i] = sources[i].density;
        arr->volume[i] = sources[i].volume;
    }
    return arr;
}

} // namespace synthetic_gravity_detail

extern "C" {

void free_source_array(SourceArray* arr) {
    if (!arr) return;
    if (arr->x) delete[] arr->x;
    if (arr->y) delete[] arr->y;
    if (arr->z) delete[] arr->z;
    if (arr->density) delete[] arr->density;
    if (arr->volume) delete[] arr->volume;
    delete arr;
}

} // extern "C"
