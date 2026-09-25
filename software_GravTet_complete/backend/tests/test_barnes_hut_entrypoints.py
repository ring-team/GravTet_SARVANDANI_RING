"""Regression tests for Barnes–Hut model/mesh entry points."""

from __future__ import annotations

import ctypes

import pytest

from api.gravity.shared.helpers import create_model_params, create_tetra_mesh_input
from api.gravity.shared.libraries import load_libraries
from gravity.analysis_gravity.solvers import compute_barnes_hut, compute_barnes_hut_mesh


def _libs():
    libs = load_libraries()
    if not libs.barnes_hut:
        pytest.skip("Barnes–Hut library not loaded")
    if not hasattr(libs.barnes_hut, "barnes_hut_forward_gravity_model"):
        pytest.skip("barnes_hut_forward_gravity_model not exported (rebuild native libs)")
    return libs


def test_barnes_hut_forward_gravity_model_small_cube():
    libs = _libs()
    data = {
        "modelType": "Cube - Hexahedral",
        "numSourcesX": 4,
        "numSourcesY": 4,
        "numSourcesZ": 4,
        "numReceiversX": 12,
        "numReceiversY": 12,
        "cubeX": 100.0,
        "cubeY": 100.0,
        "cubeZ": 100.0,
        "density": 2500.0,
        "centerZ": -52.0,
        "theta0": 0.5,
    }
    params = create_model_params(data)
    result_size = ctypes.c_int(0)
    result_ptr = libs.barnes_hut.barnes_hut_forward_gravity_model(
        ctypes.byref(params),
        ctypes.c_double(0.5),
        ctypes.byref(result_size),
    )
    assert result_ptr is not None
    assert result_size.value == int(params.num_receivers_x) * int(params.num_receivers_y)
    values = [result_ptr[i] for i in range(result_size.value)]
    libs.barnes_hut.barnes_hut_free_result(result_ptr)
    assert any(abs(v) > 0 for v in values)


def test_barnes_hut_forward_gravity_tetra_mesh_small_cube():
    libs = _libs()
    if not hasattr(libs.barnes_hut, "barnes_hut_forward_gravity_tetra_mesh"):
        pytest.skip("barnes_hut_forward_gravity_tetra_mesh not exported (rebuild native libs)")
    data = {
        "mesh": {
            "nodes": [
                [0.0, 0.0, -1000.0],
                [2.0, 0.0, -1000.0],
                [0.0, 2.0, -1000.0],
                [0.0, 0.0, -1002.0],
            ],
            "elements": [[0, 1, 2, 3, 2500.0]],
        },
        "numReceiversX": 16,
        "numReceiversY": 16,
        "surfaceXMin": -100.0,
        "surfaceXMax": 100.0,
        "surfaceYMin": -100.0,
        "surfaceYMax": 100.0,
        "surfaceZ": 0.0,
    }
    mesh_params, node_arr, elem_arr = create_tetra_mesh_input(data)
    result_size = ctypes.c_int(0)
    _keepalive = (node_arr, elem_arr)
    result_ptr = libs.barnes_hut.barnes_hut_forward_gravity_tetra_mesh(
        ctypes.byref(mesh_params),
        ctypes.c_double(0.5),
        ctypes.byref(result_size),
    )
    assert result_ptr is not None
    assert result_size.value == int(mesh_params.num_receivers_x) * int(mesh_params.num_receivers_y)
    values = [result_ptr[i] for i in range(result_size.value)]
    libs.barnes_hut.barnes_hut_free_result(result_ptr)
    del _keepalive
    assert any(abs(v) > 0 for v in values)


def test_barnes_hut_model_matches_flat_array_path():
    """New ModelParams entry point must match legacy flat-array discretization."""
    libs = _libs()
    data = {
        "modelType": "Cube - Hexahedral",
        "numSourcesX": 6,
        "numSourcesY": 6,
        "numSourcesZ": 6,
        "numReceiversX": 24,
        "numReceiversY": 24,
        "cubeX": 100.0,
        "cubeY": 100.0,
        "cubeZ": 100.0,
        "density": 2500.0,
        "centerZ": -52.0,
        "theta0": 0.5,
    }
    params = create_model_params(data)
    legacy, _ = compute_barnes_hut(libs, params, data)
    result_size = ctypes.c_int(0)
    result_ptr = libs.barnes_hut.barnes_hut_forward_gravity_model(
        ctypes.byref(params),
        ctypes.c_double(0.5),
        ctypes.byref(result_size),
    )
    assert result_ptr is not None
    native = [result_ptr[i] for i in range(result_size.value)]
    libs.barnes_hut.barnes_hut_free_result(result_ptr)
    assert len(native) == len(legacy)
    assert max(abs(a - b) for a, b in zip(native, legacy)) < 1e-9


def test_barnes_hut_tetra_mesh_matches_flat_array_path():
    """New TetraMeshInput entry point must match legacy flat-array mesh path."""
    libs = _libs()
    if not hasattr(libs.barnes_hut, "barnes_hut_forward_gravity_tetra_mesh"):
        pytest.skip("barnes_hut_forward_gravity_tetra_mesh not exported (rebuild native libs)")
    data = {
        "mesh": {
            "nodes": [
                [0.0, 0.0, -1000.0],
                [2.0, 0.0, -1000.0],
                [0.0, 2.0, -1000.0],
                [0.0, 0.0, -1002.0],
            ],
            "elements": [[0, 1, 2, 3, 2500.0]],
        },
        "numReceiversX": 16,
        "numReceiversY": 16,
        "surfaceXMin": -100.0,
        "surfaceXMax": 100.0,
        "surfaceYMin": -100.0,
        "surfaceYMax": 100.0,
        "surfaceZ": 0.0,
    }
    mesh_params, node_arr, elem_arr = create_tetra_mesh_input(data)
    legacy, _ = compute_barnes_hut_mesh(libs, mesh_params, {"theta0": 0.5})
    result_size = ctypes.c_int(0)
    _keepalive = (node_arr, elem_arr)
    result_ptr = libs.barnes_hut.barnes_hut_forward_gravity_tetra_mesh(
        ctypes.byref(mesh_params),
        ctypes.c_double(0.5),
        ctypes.byref(result_size),
    )
    assert result_ptr is not None
    native = [result_ptr[i] for i in range(result_size.value)]
    libs.barnes_hut.barnes_hut_free_result(result_ptr)
    del _keepalive
    assert len(native) == len(legacy)
    assert max(abs(a - b) for a, b in zip(native, legacy)) < 1e-9
