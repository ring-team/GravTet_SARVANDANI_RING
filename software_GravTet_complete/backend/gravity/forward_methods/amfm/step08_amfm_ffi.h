// step08_amfm_ffi.h: adaptive multilevel fast multipole (AMFM) gravity.
#ifndef AMFM_FFI_H
#define AMFM_FFI_H

// ============================================================================
// Adaptive Multilevel Fast Multipole (amfm) Workflow - Phase 6: FFI Interface
// Step 6.1: C-compatible struct (sources, receivers, params); amfm_compute_gravity; amfm_free_result
// ============================================================================
// This file provides a C-compatible interface for Python (ctypes), Rust, and other
// languages that can call C functions. The FFI uses C-style arrays and structs;
// the caller must free the result array with amfm_free_result() to avoid leaks.
// ============================================================================

#ifdef __cplusplus
extern "C" {
#endif

// ============================================================================
// SECTION 1: Parameter Structure
// ============================================================================

/**
 * AMFMParams - Structure containing all parameters for adaptive multilevel fast multipole (amfm) gravity calculation
 * 
 * This structure is designed to be compatible with C and can be easily
 * constructed from Rust or other languages. All arrays are passed as pointers
 * with explicit size information.
 */
struct AMFMParams {
    // Source parameters (arrays of length num_sources)
    double* source_x;        // X coordinates of source points (meters)
    double* source_y;        // Y coordinates of source points (meters)
    double* source_z;        // Z coordinates of source points (meters)
    double* source_density;   // Density of each source (kg/m³)
    double* source_volume;    // Volume of each source (m³)
    int num_sources;          // Number of source points
    
    // Receiver parameters (arrays of length num_receivers)
    double* receiver_x;       // X coordinates of receiver points (meters)
    double* receiver_y;       // Y coordinates of receiver points (meters)
    double* receiver_z;       // Z coordinates of receiver points (meters)
    int num_receivers;        // Number of receiver points
    
    // Adaptive multilevel fast multipole (amfm)-specific algorithm parameters
    double critical_distance_factor;  // Factor for near-field/far-field boundary
                                      // (typically 2.0-3.0, default: 2.5)
    int max_depth;                    // Maximum octree depth (default: 10)
    int max_sources_per_node;         // Max sources per node before subdivision
                                      // (default: 10)
};

// ============================================================================
// SECTION 2: FFI Function Declarations
// ============================================================================

/**
 * Compute gravity using adaptive multilevel fast multipole (amfm) algorithm
 * 
 * This is the main entry point for the adaptive multilevel fast multipole (amfm) FFI. It:
 * 1. Converts C arrays to C++ vectors
 * 2. Creates AMFMCore instance with specified parameters
 * 3. Computes gravity at all receivers
 * 4. Returns results as a C array
 * 
 * Memory management:
 * - The returned array is allocated with `new[]` and must be freed using
 *   `amfm_free_result()` to prevent memory leaks
 * - The input parameters are not modified
 * 
 * @param params Pointer to AMFMParams structure containing all input data
 * @param result_size Output parameter: will be set to the number of results
 *                    (should equal num_receivers)
 * @return Pointer to array of gravity values in mGal, or nullptr on error
 *         The caller is responsible for freeing this memory with amfm_free_result()
 */
double* amfm_compute_gravity(const AMFMParams* params, int* result_size);

/**
 * Free memory allocated by amfm_compute_gravity()
 * 
 * This function must be called to free the result array returned by
 * `amfm_compute_gravity()` to prevent memory leaks.
 * 
 * @param result Pointer to result array returned by amfm_compute_gravity()
 *               Safe to call with nullptr (no-op)
 */
void amfm_free_result(double* result);

#ifdef __cplusplus
}
#endif

#endif // AMFM_FFI_H
