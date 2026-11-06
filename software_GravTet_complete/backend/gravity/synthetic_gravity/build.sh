#!/bin/bash

# Build script for Synthetic Gravity source generation library

set -e

echo "Building Synthetic Gravity library..."

# Create build directory
mkdir -p build
cd build

# Run CMake
cmake ..

# Build
make

echo "✓ Synthetic Gravity library built successfully!"
echo "Library location: build/lib/"
