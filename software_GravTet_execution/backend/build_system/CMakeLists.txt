cmake_minimum_required(VERSION 3.15)
project(Backend)

# Default to an optimized build. Without this, CMake leaves CMAKE_BUILD_TYPE
# empty, which compiles with NO optimization (-O0) and makes the gravity
# solvers dramatically slower at runtime. Callers can still override with
# -DCMAKE_BUILD_TYPE=Debug.
if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
  set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type (Release = -O3 -DNDEBUG)" FORCE)
  message(STATUS "No build type specified; defaulting to Release (-O3).")
endif()

set(BACKEND_ROOT "${CMAKE_CURRENT_LIST_DIR}/..")

# Build synthetic_gravity first: the shared, solver-neutral discretization
# library every forward method links against. Each forward method below is
# built independently and only depends on synthetic_gravity/common/mesh --
# never on a sibling forward-method folder -- so any one of them can be
# removed without affecting the others.
add_subdirectory("${BACKEND_ROOT}/gravity/synthetic_gravity" "${CMAKE_BINARY_DIR}/synthetic_gravity")

# Direct Newton (links synthetic_gravity; its own CMakeLists.txt sets up the link)
add_subdirectory("${BACKEND_ROOT}/gravity/forward_methods/direct_newton" "${CMAKE_BINARY_DIR}/direct_newton_gravity")

# AMFM (links synthetic_gravity; its own CMakeLists.txt sets up the link)
add_subdirectory("${BACKEND_ROOT}/gravity/forward_methods/amfm" "${CMAKE_BINARY_DIR}/amfm_gravity")

# Barnes-Hut (links synthetic_gravity + its own octree lib)
add_subdirectory("${BACKEND_ROOT}/gravity/forward_methods/barnes_hut" "${CMAKE_BINARY_DIR}/barnes_hut_gravity")

# Quadrature second-order gravity (no dependency on synthetic_gravity)
add_subdirectory("${BACKEND_ROOT}/gravity/forward_methods/quadrature" "${CMAKE_BINARY_DIR}/quadrature_second_order_gravity")

