cmake_minimum_required(VERSION 3.15)
project(InitialModelGravity)

# MVP scaffold: this library is not yet wired into backend/CMakeLists.txt.
# It exists so you can later add C++ helpers like primitive->sources conversion.

add_library(initial_model_gravity STATIC
  initial_model_stub.cpp
)

target_include_directories(initial_model_gravity PUBLIC
  ${CMAKE_CURRENT_SOURCE_DIR}
)

set_target_properties(initial_model_gravity PROPERTIES
  ARCHIVE_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib
)

