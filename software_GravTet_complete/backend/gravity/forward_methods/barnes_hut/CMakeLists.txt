cmake_minimum_required(VERSION 3.15)
project(BarnesHut LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Barnes-Hut core library with explicit separated steps
add_library(barnes_hut_octree
    step02_barnes_hut_far_field_octree_build.cpp
    step03_barnes_hut_far_field_cell_moments.cpp
    step04_barnes_hut_near_field_pairwise_kernel.cpp
    step05_barnes_hut_far_field_mac.cpp
    step06_barnes_hut_all_receivers.cpp
)
target_include_directories(barnes_hut_octree PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})

# SIMD: AVX2 on x86, NEON on ARM. Scalar-only option for benchmarking.
option(BARNES_HUT_SCALAR_ONLY "Disable SIMD in Barnes–Hut leaf sum" OFF)
if(BARNES_HUT_SCALAR_ONLY)
    target_compile_definitions(barnes_hut_octree PRIVATE BARNES_HUT_SCALAR_ONLY)
elseif(CMAKE_SYSTEM_PROCESSOR MATCHES "x86_64|AMD64|i686")
    # AVX2 alone is not enough: _mm256_fmadd_pd needs -mfma (GCC target mismatch otherwise).
    target_compile_options(barnes_hut_octree PRIVATE -mavx2 -mfma)
endif()

# Static archive is linked into libbarnes_hut_gravity.so; Linux requires -fPIC.
set_target_properties(barnes_hut_octree PROPERTIES
    POSITION_INDEPENDENT_CODE ON
    LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib
    RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin
)

# Step 07–08: shared library for API (C FFI)
add_library(barnes_hut_gravity SHARED
    step07_barnes_hut_ffi.cpp
    step08_barnes_hut_model_mesh_ffi.cpp
)
target_link_libraries(barnes_hut_gravity PRIVATE barnes_hut_octree synthetic_gravity)
target_include_directories(barnes_hut_gravity PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/../../mesh
)
set_target_properties(barnes_hut_gravity PROPERTIES
    LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib
    RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin
)

