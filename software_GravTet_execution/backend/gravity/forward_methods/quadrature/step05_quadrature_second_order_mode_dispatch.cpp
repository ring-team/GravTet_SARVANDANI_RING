#include "step01_quadrature_second_order_types_and_api.h"
#include "quadrature_second_order_detail.h"
#include <stdexcept>

std::vector<double> forward_gravity_quadrature(
    const std::vector<Receiver>& receivers,
    const std::vector<TetraCell>& cells
) {
    return forward_gravity_quadrature_with_mode(
        receivers,
        cells,
        QuadratureExecutionMode::SIMDTiledThreading,
        /*num_threads=*/0,
        /*receiver_block_size=*/0,
        /*source_block_size=*/0
    );
}

std::vector<double> forward_gravity_quadrature_with_mode(
    const std::vector<Receiver>& receivers,
    const std::vector<TetraCell>& cells,
    QuadratureExecutionMode mode,
    int num_threads,
    int receiver_block_size,
    int source_block_size,
    int simd_lanes
) {
    using quadrature_second_order::detail::forward_quadrature_scalar_mode;
    using quadrature_second_order::detail::forward_quadrature_simd_mode;
    using quadrature_second_order::detail::forward_quadrature_simd_threads_mode;
    using quadrature_second_order::detail::forward_quadrature_reference_unprepared_mode;

    if (mode == QuadratureExecutionMode::Reference) {
        return forward_quadrature_reference_unprepared_mode(receivers, cells);
    }

    if ((mode == QuadratureExecutionMode::SIMDTiled || mode == QuadratureExecutionMode::SIMDTiledThreading)
        && simd_lanes != 0 && !quadrature_simd_supports(simd_lanes)) {
        throw std::invalid_argument("Unsupported SIMD lane width");
    }

    const auto prepared = quadrature_second_order::detail::prepare_tetra_cells(cells);

    switch (mode) {
        case QuadratureExecutionMode::Tiled:
            return forward_quadrature_scalar_mode(
                receivers, prepared, receiver_block_size, source_block_size);
        case QuadratureExecutionMode::SIMDTiled:
            return forward_quadrature_simd_mode(
                receivers, prepared, receiver_block_size, source_block_size, simd_lanes);
        case QuadratureExecutionMode::SIMDTiledThreading:
        default:
            return forward_quadrature_simd_threads_mode(
                receivers, prepared, num_threads, receiver_block_size, source_block_size, simd_lanes);
    }
}

double to_mGal(double g_si) {
    return g_si * 1e5;
}
