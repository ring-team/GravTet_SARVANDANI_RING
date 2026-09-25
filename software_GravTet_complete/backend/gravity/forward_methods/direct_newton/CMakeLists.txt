cmake_minimum_required(VERSION 3.15)
project(DirectNewtonGravity)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Create a shared library for Direct Newton method
add_library(direct_newton_gravity SHARED
    step09_direct_newton_mode_dispatch.cpp
    step08_direct_newton_scalar_kernel.cpp
    step10_direct_newton_reference.cpp
    step06_direct_newton_distance_kernel_dispatch.cpp
    step11_direct_newton_reference_tiled.cpp
    step12_direct_newton_simd.cpp
    step13_direct_newton_simd_tiled.cpp
    step14_direct_newton_simd_threading_tiled.cpp
    step05_direct_newton_ffi.cpp
)

# Set output directory
set_target_properties(direct_newton_gravity PROPERTIES
    LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib
    RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin
)

# SIMD: enable AVX2 on x86, or use NEON on ARM. Set DIRECT_NEWTON_SCALAR_ONLY=ON to force scalar path.
option(DIRECT_NEWTON_SCALAR_ONLY "Disable SIMD and force scalar execution path" OFF)
if(DIRECT_NEWTON_SCALAR_ONLY)
    target_compile_definitions(direct_newton_gravity PRIVATE DIRECT_NEWTON_SCALAR_ONLY)
    message(STATUS "Direct Newton: scalar only (SIMD disabled)")
elseif(CMAKE_SYSTEM_PROCESSOR MATCHES "x86_64|AMD64|i686")
    # AVX2 alone is not enough: _mm256_fmadd_pd needs -mfma (GCC target mismatch otherwise).
    target_compile_options(direct_newton_gravity PRIVATE -mavx2 -mfma)
    message(STATUS "Direct Newton: AVX2+FMA enabled (x86)")
elseif(CMAKE_SYSTEM_PROCESSOR MATCHES "aarch64|arm64|ARM64")
    message(STATUS "Direct Newton: NEON used (ARM)")
endif()

# Include directories - need synthetic_gravity for FFI includes
target_include_directories(direct_newton_gravity PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/../../synthetic_gravity
)

# Link with synthetic_gravity target from top-level build graph.
if(TARGET synthetic_gravity)
    target_link_libraries(direct_newton_gravity synthetic_gravity)
    message(STATUS "Linked direct_newton_gravity with synthetic_gravity target")
else()
    message(WARNING "synthetic_gravity target not found in current build graph.")
endif()

