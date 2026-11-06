#!/bin/bash

# Unified build script for backend gravity libraries.
# Uses a single build root: backend/build

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
GRAVITY_DIR="$BACKEND_DIR/gravity"
BUILD_DIR="$BACKEND_DIR/build"

echo "=========================================="
echo "Building Backend (single build folder)"
echo "=========================================="
echo ""

# Clean old module-local builds first (keep only backend/build as canonical output)
echo "Cleaning all module-local build folders under gravity/..."
rm -rf "$GRAVITY_DIR"/*/build "$GRAVITY_DIR"/*/build_local

# Automatic stale cache cleanup (useful if sources are copied/moved between machines or OSes)
if [ -f "$BUILD_DIR/CMakeCache.txt" ]; then
  recorded=$(grep -E '^# For build in directory:' "$BUILD_DIR/CMakeCache.txt" 2>/dev/null | head -1 | sed 's/.*: //' | tr -d ' \r' || echo "")
  if [ -n "$recorded" ] && [ "$recorded" != "$BUILD_DIR" ]; then
    echo "Stale CMake cache from different path ($recorded). Auto-cleaning cache..."
    rm -f "$BUILD_DIR/CMakeCache.txt" "$BUILD_DIR/Makefile" "$BUILD_DIR/cmake_install.cmake"
    rm -rf "$BUILD_DIR/CMakeFiles"
  fi
fi

echo ""
echo "Configuring CMake in: $BUILD_DIR"
# Release => -O3 -DNDEBUG. Optimization is essential here; an unoptimized
# (-O0) build makes the gravity solvers many times slower at runtime.
cmake -S "$BACKEND_DIR/build_system" -B "$BUILD_DIR" -DCMAKE_BUILD_TYPE=Release

echo ""
echo "Building all targets..."
cmake --build "$BUILD_DIR" -j

echo ""
echo "=========================================="
echo "✓ Backend libraries built successfully!"
echo "=========================================="
echo ""
echo "Libraries are in:"
echo "  - build/lib/"
echo ""
echo "Binaries/tests are in: build/bin/"
