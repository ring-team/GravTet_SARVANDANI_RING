"""Cube unstructured mesh analysis must be left–right symmetric vs closed-form reference."""

import pytest

from api.gravity.shared.helpers import create_tetra_mesh_input
from gravity.forward_methods.analytical_closedform.dispatcher import solve_analytical_closedform
from gravity.analysis_gravity.metrics import global_l2_normalized_pointwise_percent
from gravity.analysis_gravity.solvers import compute_direct_newton_mesh, compute_quadrature_mesh


def _build_symmetric_dual_cube_mesh(center_z: float):
    ix = iy = 40
    iz = 20
    sx = sy = sz = 100.0
    rho = 2500.0
    half = rho * 0.5
    dx, dy, dz = sx / ix, sy / iy, sz / iz
    x_min, y_min, z_min = -sx * 0.5, -sy * 0.5, -sz * 0.5

    def idx(i, j, k):
        return i * (iy + 1) * (iz + 1) + j * (iz + 1) + k

    nodes = []
    for i in range(ix + 1):
        for j in range(iy + 1):
            for k in range(iz + 1):
                nodes.append([x_min + i * dx, y_min + j * dy, center_z + z_min + k * dz])

    elements = []
    for i in range(ix):
        for j in range(iy):
            for k in range(iz):
                n0 = idx(i, j, k)
                n1 = idx(i + 1, j, k)
                n2 = idx(i, j + 1, k)
                n3 = idx(i + 1, j + 1, k)
                n4 = idx(i, j, k + 1)
                n5 = idx(i + 1, j, k + 1)
                n6 = idx(i, j + 1, k + 1)
                n7 = idx(i + 1, j + 1, k + 1)
                elements += [
                    [n0, n1, n2, n6, half],
                    [n0, n2, n3, n6, half],
                    [n0, n3, n7, n6, half],
                    [n0, n7, n4, n6, half],
                    [n0, n4, n5, n6, half],
                    [n0, n5, n1, n6, half],
                    [n1, n0, n4, n7, half],
                    [n1, n4, n5, n7, half],
                    [n1, n5, n6, n7, half],
                    [n1, n6, n2, n7, half],
                    [n1, n2, n3, n7, half],
                    [n1, n3, n0, n7, half],
                ]
    return nodes, elements


def _libs_available():
    from api.gravity.shared.libraries import load_libraries

    libs = load_libraries()
    return libs.direct_newton is not None and libs.quadrature_second_order is not None


@pytest.mark.skipif(not _libs_available(), reason="Native gravity libraries are not loaded.")
@pytest.mark.parametrize("solver", ["direct_newton", "quadrature_second_order"])
def test_cube_unstructured_error_map_is_x_symmetric(solver):
    from api.gravity.shared.libraries import load_libraries

    h = 200.0
    center_z = -h - 50.0
    nodes, elements = _build_symmetric_dual_cube_mesh(center_z)
    data = {
        "modelType": "Cube - Tetrahedral",
        "cubeX": 100.0,
        "cubeY": 100.0,
        "cubeZ": 100.0,
        "centerX": 0.0,
        "centerY": 0.0,
        "centerZ": center_z,
        "h": h,
        "density": 2500.0,
        "numReceiversX": 100,
        "numReceiversY": 100,
        "surfaceXMin": -165.0,
        "surfaceXMax": 165.0,
        "surfaceYMin": -150.0,
        "surfaceYMax": 150.0,
        "surfaceZ": 0.0,
        "executionMode": "simd_threads",
        "mesh": {"nodes": nodes, "elements": elements},
    }
    reference = solve_analytical_closedform(data)
    mesh_params, _, _ = create_tetra_mesh_input(data)
    libs = load_libraries()
    if solver == "direct_newton":
        mesh_params.execution_mode = 2
        candidate, _ = compute_direct_newton_mesh(libs, mesh_params)
    else:
        candidate, _ = compute_quadrature_mesh(libs, mesh_params)

    err = global_l2_normalized_pointwise_percent(reference, candidate)
    ny = 100
    left = err[39 * ny + 50]
    right = err[60 * ny + 50]
    assert left > 0.0 and right > 0.0
    assert right / left == pytest.approx(1.0, rel=1e-3, abs=1e-9)
