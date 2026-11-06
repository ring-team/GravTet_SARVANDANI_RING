#pragma once

#include "step01_quadrature_second_order_types_and_api.h"

namespace quadrature_second_order {
namespace detail {

struct QuadPoint {
    double x, y, z;
    double weight; // physical weight in m^3 (V/4)
};

// Step 2 geometry helper: tetra volume via scalar triple product.
double tetra_volume(const TetraCell& cell);

// Step 2 geometry helper: 4-point symmetric Hammer rule in physical tetra.
// Produces 4 points with equal weights V/4.
void tetra_quadrature_points(const TetraCell& cell, QuadPoint out_points[4]);

struct PreparedTetra {
    // Four quadrature points and their density-weighted volumes (rho * V/4).
    double qx[4];
    double qy[4];
    double qz[4];
    double rho_w[4];
};

std::vector<PreparedTetra> prepare_tetra_cells(const std::vector<TetraCell>& cells);

// Step 4 baseline: scalar accumulation on precomputed quadrature points.
double gz_scalar_prepared_one(const Receiver& receiver, const std::vector<PreparedTetra>& prepared);
double gz_scalar_prepared_range(const Receiver& receiver, const std::vector<PreparedTetra>& prepared,
                                std::size_t start, std::size_t end);

// Pure reference path: no tiling, no SIMD, no threading.
std::vector<double> forward_quadrature_reference_mode(const std::vector<Receiver>& receivers,
                                                      const std::vector<PreparedTetra>& prepared);

// Pure unprepared reference path: no precompute, no tiling, no SIMD, no threading.
std::vector<double> forward_quadrature_reference_unprepared_mode(const std::vector<Receiver>& receivers,
                                                                 const std::vector<TetraCell>& cells);

// Step 7: SIMD accumulation over prepared tetra cells.
double gz_simd_prepared_range(const Receiver& receiver, const std::vector<PreparedTetra>& prepared,
                              std::size_t start, std::size_t end, int simd_lanes = 0);

// Step 7 dispatch (scalar fallback when SIMD disabled/unavailable).
double receiver_gz_dispatch(const Receiver& receiver, const std::vector<PreparedTetra>& prepared,
                           std::size_t start, std::size_t end, int simd_lanes = 0);

// Step 9: blocking/tiling (single-thread scalar/simd modes).
// receiver_block_size / source_block_size: 0 => defaults (64 / 128), then clamped to [1, N].
std::vector<double> forward_quadrature_scalar_mode(const std::vector<Receiver>& receivers,
                                                   const std::vector<PreparedTetra>& prepared,
                                                   int receiver_block_size = 0,
                                                   int source_block_size = 0);
std::vector<double> forward_quadrature_simd_mode(const std::vector<Receiver>& receivers,
                                                 const std::vector<PreparedTetra>& prepared,
                                                 int receiver_block_size = 0,
                                                 int source_block_size = 0, int simd_lanes = 0);

// Step 8: multithreaded receiver orchestration (simd inside).
std::vector<double> forward_quadrature_simd_threads_mode(const std::vector<Receiver>& receivers,
                                                         const std::vector<PreparedTetra>& prepared,
                                                         int num_threads,
                                                         int receiver_block_size = 0,
                                                         int source_block_size = 0, int simd_lanes = 0);

// Unstructured-tetra mesh generation stage (step-style separation).
bool is_unstructured_tetra_model_type(int model_type);
bool generate_unstructured_tetra_cells_from_params(const QuadratureModelParams* params,
                                                   std::vector<TetraCell>& cells);

} // namespace detail
} // namespace quadrature_second_order

extern "C" int quadrature_simd_lanes();
extern "C" int quadrature_simd_supports(int lanes);
