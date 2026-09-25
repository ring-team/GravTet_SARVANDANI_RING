// ============================================================================
// Adaptive Multilevel Fast Multipole (amfm) Workflow - Phase 6: FFI Interface
// Step 6.1: amfm_compute_gravity → C++ core → return array; amfm_free_result
// ============================================================================
// Converts C arrays to C++ vectors, runs full two-tree AMFM pipeline, returns
// gravity in mGal; caller must call amfm_free_result() on the returned pointer.
// ============================================================================

#include "step08_amfm_ffi.h"
#include "step07_amfm_near_far_orchestration.h"
#include "step01_amfm_types.h"
#include <vector>
#include <cstddef>

extern "C" {

// ============================================================================
// SECTION 1: Main FFI Function
// ============================================================================

double* amfm_compute_gravity(const AMFMParams* params, int* result_size) {
    // Validate input parameters
    if (!params || !result_size) {
        return nullptr;
    }
    
    // Validate array sizes
    if (params->num_sources <= 0 || params->num_receivers <= 0) {
        *result_size = 0;
        return nullptr;
    }
    
    // Validate array pointers
    if (!params->source_x || !params->source_y || !params->source_z ||
        !params->source_density || !params->source_volume ||
        !params->receiver_x || !params->receiver_y || !params->receiver_z) {
        *result_size = 0;
        return nullptr;
    }
    
    // ============================================================================
    // Convert C arrays to C++ vectors: Sources
    // ============================================================================
    
    std::vector<AMFMSource> sources;
    sources.reserve(params->num_sources);  // Pre-allocate for efficiency
    
    for (int i = 0; i < params->num_sources; i++) {
        AMFMSource src;
        
        // Set source position from C arrays
        src.position = Point3D(
            params->source_x[i],
            params->source_y[i],
            params->source_z[i]
        );
        
        // Set source physical properties
        src.density = params->source_density[i];
        src.volume = params->source_volume[i];
        
        sources.push_back(src);
    }
    
    // ============================================================================
    // Convert C arrays to C++ vectors: Receivers
    // ============================================================================
    
    std::vector<AMFMReceiver> receivers;
    receivers.reserve(params->num_receivers);  // Pre-allocate for efficiency
    
    for (int i = 0; i < params->num_receivers; i++) {
        AMFMReceiver rec;
        
        // Set receiver position from C arrays
        rec.position = Point3D(
            params->receiver_x[i],
            params->receiver_y[i],
            params->receiver_z[i]
        );
        
        // Initialize gravity value (will be computed)
        rec.gravity_value = 0.0;
        
        receivers.push_back(rec);
    }
    
    // ============================================================================
    // Create adaptive multilevel fast multipole (amfm) core with specified parameters
    // ============================================================================
    
    AMFMCore amfm(
        params->critical_distance_factor,  // Near-field/far-field boundary factor
        params->max_depth,                  // Maximum octree depth
        params->max_sources_per_node        // Max sources per node
    );
    
    // ============================================================================
    // Compute gravity at all receivers
    // ============================================================================
    
    std::vector<double> results = amfm.compute_gravity(sources, receivers);
    
    // Validate results size matches expected number of receivers
    if (results.size() != static_cast<size_t>(params->num_receivers)) {
        *result_size = 0;
        return nullptr;
    }
    
    // ============================================================================
    // Convert C++ vector to C array for return
    // ============================================================================
    
    *result_size = static_cast<int>(results.size());
    double* result = new double[*result_size];
    
    for (size_t i = 0; i < results.size(); i++) {
        result[i] = results[i];
    }
    
    return result;
}

// ============================================================================
// SECTION 2: Memory Management
// ============================================================================

void amfm_free_result(double* result) {
    // Safe to call with nullptr (no-op)
    if (result) {
        delete[] result;
    }
}

} // extern "C"
