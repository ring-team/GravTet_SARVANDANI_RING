cmake_minimum_required(VERSION 3.15)
project(SyntheticGravity)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Create a shared library for source generation. Every file compiled here
# lives in this folder (or in ../common/, ../mesh/) -- no forward-method
# folder needs to exist for synthetic_gravity to build.
add_library(synthetic_gravity SHARED
    gravity_sources_structured_hexahedral.cpp
    gravity_sources_structured_tetrahedral.cpp
    gravity_sources_polyhedral.cpp
    gravity_sources_unstructured_tetrahedral.cpp
    gravity_sources_unstructured_polyhedral.cpp
    source_build_classify.cpp
    source_build_unstructured.cpp
    source_build_structured.cpp
    source_array_bridge.cpp
    gravity_source_generation_ffi.cpp
)

# Set output directory
set_target_properties(synthetic_gravity PROPERTIES
    LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib
    RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin
)

# Include directories - only neutral shared folders, never a forward-method folder.
target_include_directories(synthetic_gravity PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/../mesh
)
