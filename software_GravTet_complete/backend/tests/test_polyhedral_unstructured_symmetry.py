"""Unstructured polyhedral symmetry vs closed-form."""

import pytest

from api.gravity.shared.helpers import create_model_params
from gravity.forward_methods.analytical_closedform.dispatcher import solve_analytical_closedform
from gravity.analysis_gravity.metrics import global_l2_normalized_pointwise_percent
from gravity.analysis_gravity.solvers import compute_direct_newton


def _libs_available():
    from api.gravity.shared.libraries import load_libraries

    return load_libraries().direct_newton is not None


@pytest.mark.skipif(not _libs_available(), reason="Native gravity libraries are not loaded.")
@pytest.mark.parametrize(
    "model_type",
    [
        "Cube - Unstructured Polyhedral",
        "Sphere - Unstructured Polyhedral",
    ],
)
def test_polyhedral_error_map_is_x_symmetric(model_type):
    from api.gravity.shared.libraries import load_libraries

    h = 200.0
    center_z = -h - 50.0
    data = {
        "modelType": model_type,
        "cubeX": 100.0,
        "cubeY": 100.0,
        "cubeZ": 100.0,
        "sphereRadius": 100.0,
        "centerX": 0.0,
        "centerY": 0.0,
        "centerZ": center_z,
        "sphereH": h,
        "h": h,
        "density": 2500.0,
        "numReceiversX": 100,
        "numReceiversY": 100,
        "numSourcesX": 40,
        "numSourcesY": 40,
        "numSourcesZ": 20,
        "surfaceXMin": -165.0,
        "surfaceXMax": 165.0,
        "surfaceYMin": -150.0,
        "surfaceYMax": 150.0,
        "surfaceZ": 0.0,
        "executionMode": "simd_tiled_threading",
    }
    reference = solve_analytical_closedform(data)
    params = create_model_params(data)
    libs = load_libraries()
    candidate, _ = compute_direct_newton(libs, params)
    err = global_l2_normalized_pointwise_percent(reference, candidate)
    ny = 100
    left = err[39 * ny + 50]
    right = err[60 * ny + 50]
    assert left > 0.0 and right > 0.0
    assert right / left == pytest.approx(1.0, rel=1e-3, abs=1e-9)
