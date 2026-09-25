# ============================================================================
# Adaptive Multilevel Fast Multipole (amfm) Workflow - Phase 6: Build System
# Step 6.2: CMake lists all sources; ./build.sh builds lib
# ============================================================================
# Creates libamfm_gravity.dylib (macOS) / libamfm_gravity.so (Linux) and
# Library only; no test executables.
# ============================================================================

cmake_minimum_required(VERSION 3.15)
project(AMFMGravity)

# C++17: shared `gravity/common/gravity_constants.hpp` uses inline constexpr; matches other solvers.
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ============================================================================
# Create shared library
# ============================================================================
# Build all source files into a shared library (.dylib on macOS, .so on Linux)
# This library can be linked from Rust via FFI
# ============================================================================

add_library(amfm_gravity SHARED
    step01_amfm_types.cpp      # Core data structures (header-only, minimal .cpp)
    step02_amfm_utils.cpp      # Utility functions
    step03_amfm_far_field_two_octrees.cpp          # Octree implementation
    step04_amfm_far_field_spherical.cpp  # Step 3.1: R_nm, S_nm spherical harmonics (Eq. 7)
    step05_amfm_near_field.cpp  # Near-field gravity calculations
    step06_amfm_far_field.cpp   # Far-field multipole calculations
    step07_amfm_near_far_orchestration.cpp       # Main adaptive multilevel fast multipole (amfm) algorithm
    step08_amfm_ffi.cpp        # Foreign Function Interface
    step09_amfm_model_mesh_ffi.cpp # ModelParams / TetraMeshInput FFI
)

# ============================================================================
# Include directories
# ============================================================================
# Make header files available to the library and any code that links to it
# ============================================================================

target_include_directories(amfm_gravity PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/../../mesh
)

target_link_libraries(amfm_gravity PRIVATE synthetic_gravity)

# SIMD: AVX2 on x86, NEON on ARM (same as Direct Newton / Barnes–Hut)
option(AMFM_SCALAR_ONLY "Disable SIMD in AMFM near-field direct sum" OFF)
if(AMFM_SCALAR_ONLY)
    target_compile_definitions(amfm_gravity PRIVATE AMFM_SCALAR_ONLY)
elseif(CMAKE_SYSTEM_PROCESSOR MATCHES "x86_64|AMD64|i686")
    # AVX2 alone is not enough: _mm256_fmadd_pd needs -mfma (GCC target mismatch otherwise).
    target_compile_options(amfm_gravity PRIVATE -mavx2 -mfma)
endif()

# ============================================================================
# Set output directories
# ============================================================================
# Library files go to build/lib/
# Executables (if any) go to build/bin/
# ============================================================================

set_target_properties(amfm_gravity PROPERTIES
    LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib
    RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin
)

