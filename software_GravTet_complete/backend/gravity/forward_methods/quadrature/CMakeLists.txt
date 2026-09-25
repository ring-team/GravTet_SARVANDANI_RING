cmake_minimum_required(VERSION 3.15)
project(QuadratureSecondOrderGravity)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(quadrature_second_order_gravity SHARED
    step02_quadrature_second_order_model_params.cpp
    step03_quadrature_second_order_mesh_build.cpp
    step02_quadrature_second_order_tetra_geometry.cpp
    step03_quadrature_second_order_tetra_cell_kernel.cpp
    step04_quadrature_second_order_scalar_kernel.cpp
    step05_quadrature_second_order_mode_dispatch.cpp
    step07_quadrature_second_order_reference.cpp
    step08_quadrature_second_order_reference_tiled.cpp
    step09_quadrature_second_order_simd.cpp
    step10_quadrature_second_order_simd_tiled.cpp
    step11_quadrature_second_order_simd_threading_tiled.cpp
    step06_quadrature_second_order_ffi.cpp
)

set_target_properties(quadrature_second_order_gravity PROPERTIES
    LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib
    RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin
)

target_include_directories(quadrature_second_order_gravity PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}
)

option(QUADRATURE_SECOND_ORDER_SCALAR_ONLY "Disable SIMD and force scalar path" OFF)
if(QUADRATURE_SECOND_ORDER_SCALAR_ONLY)
    target_compile_definitions(quadrature_second_order_gravity PRIVATE QUADRATURE_SECOND_ORDER_SCALAR_ONLY)
    message(STATUS "Quadrature second-order: scalar only (SIMD disabled)")
elseif(CMAKE_SYSTEM_PROCESSOR MATCHES "x86_64|AMD64|i686")
    # AVX2 alone is not enough: _mm256_fmadd_pd needs -mfma (GCC target mismatch otherwise).
    # Runtime-dispatched SSE2/AVX2/AVX-512 kernels; no global AVX requirement.
    message(STATUS "Quadrature second-order: Runtime SIMD dispatch enabled (x86)")
elseif(CMAKE_SYSTEM_PROCESSOR MATCHES "aarch64|arm64|ARM64")
    message(STATUS "Quadrature second-order: NEON used (ARM)")
endif()
