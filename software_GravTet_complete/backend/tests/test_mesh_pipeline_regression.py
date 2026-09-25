"""Regression tests for generic tetra-mesh path (parsing + solver consistency)."""

import math

import pytest

from api.app import app
from api.gravity.mesh.mesh_route_utils import _gmsh_mesh_cache_key
from api.gravity.shared.helpers import create_tetra_mesh_input, load_tetra_mesh_from_text


def _one_tetra_payload():
    # Small tetra far from receivers to keep direct-point and quadrature close.
    return {
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
        "executionMode": "simd_threads",
    }


def _libs_available(client):
    rv = client.get("/api/health")
    data = rv.get_json() or {}
    return bool(data.get("direct_newton_loaded")) and bool(data.get("quadrature_second_order_loaded"))


def test_mesh_text_loader_medit():
    medit = """
MeshVersionFormatted 1
Dimension 3
Vertices
4
0 0 -100 0
1 0 -100 0
0 1 -100 0
0 0 -101 0
Tetrahedra
1
1 2 3 4 0
End
"""
    nodes, tets = load_tetra_mesh_from_text(medit, "mesh")
    assert len(nodes) == 4
    assert len(tets) == 1
    assert tets[0] == [0, 1, 2, 3]


def test_create_tetra_mesh_input_validates_bounds():
    bad = _one_tetra_payload()
    bad["surfaceXMin"] = 10.0
    bad["surfaceXMax"] = -10.0
    with pytest.raises(ValueError):
        create_tetra_mesh_input(bad)


def test_cube_gmsh_warm_reports_calculate_ready_for_forward():
    app.config["TESTING"] = True
    client = app.test_client()
    warm_payload = {
        "modelType": "Cube - Tetrahedral",
        "centerX": 0,
        "centerY": 0,
        "centerZ": -50,
        "h": 0,
        "density": 2500,
        "targetElementSize": 4.0,
        "surfaceRefinement": 0.4,
        "localRefinementNearEdges": 0.4,
        "cubeX": 100,
        "cubeY": 100,
        "cubeZ": 100,
        "warmCacheOnly": True,
        "warmCenterZ": -80,
    }
    rv = client.post("/api/build_gmsh_tetra_mesh", json=warm_payload)
    assert rv.status_code == 200, rv.get_json()
    payload = rv.get_json()
    assert payload.get("calculateReady") is True
    assert payload.get("geometryReady") is True
    assert payload.get("depthShiftReady") is True


def test_cube_gmsh_warm_and_barnes_hut_calculate_share_cache_key():
    warm_payload = {
        "modelType": "Cube - Tetrahedral",
        "centerX": 0,
        "centerY": 0,
        "centerZ": -50,
        "h": 0,
        "density": 2500,
        "targetElementSize": 1.2,
        "surfaceRefinement": 0.4,
        "localRefinementNearEdges": 0.4,
        "cubeX": 100,
        "cubeY": 100,
        "cubeZ": 100,
        "warmCacheOnly": True,
        "warmCenterZ": -80,
    }
    calculate_payload = {
        **warm_payload,
        "centerZ": -80,
        "h": 30,
        "numSourcesX": 100,
        "numSourcesY": 100,
        "numSourcesZ": 100,
        "numReceiversX": 100,
        "numReceiversY": 100,
        "surfaceXMin": -150,
        "surfaceXMax": 150,
        "surfaceYMin": -150,
        "surfaceYMax": 150,
        "surfaceZ": 0,
        "theta0": 0.5,
        # These unrelated default UI fields used to poison the Gmsh mesh cache key.
        "sphereRadius": 100,
        "ellipsoidA": 200,
        "ellipsoidB": 100,
        "ellipsoidC": 150,
        "verticalCylinderRadius": 50,
        "verticalCylinderHeight": 100,
        "horizontalCylinderRadius": 50,
        "horizontalCylinderLength": 100,
        "warmCacheOnly": False,
    }
    assert _gmsh_mesh_cache_key(warm_payload) == _gmsh_mesh_cache_key(calculate_payload)


def test_mesh_solver_one_tetra_runs():
    app.config["TESTING"] = True
    client = app.test_client()
    if not _libs_available(client):
        pytest.skip("Native direct/quadrature libraries are not loaded.")

    payload = _one_tetra_payload()
    rv_d = client.post("/api/compute_gravity_mesh_direct", json=payload)
    assert rv_d.status_code == 200, rv_d.get_json()
    jd = rv_d.get_json()
    assert isinstance(jd.get("results"), list) and len(jd["results"]) > 0
    assert jd.get("num_sources") == 1
    assert all(math.isfinite(v) for v in jd["results"])

    rv_q = client.post("/api/compute_gravity_mesh_quadrature", json=payload)
    assert rv_q.status_code == 200, rv_q.get_json()
    jq = rv_q.get_json()
    assert isinstance(jq.get("results"), list) and len(jq["results"]) > 0
    assert jq.get("num_sources") == 1
    assert all(math.isfinite(v) for v in jq["results"])


def test_mesh_direct_quadrature_consistency_trend():
    app.config["TESTING"] = True
    client = app.test_client()
    if not _libs_available(client):
        pytest.skip("Native direct/quadrature libraries are not loaded.")
    payload = _one_tetra_payload()

    rv_d = client.post("/api/compute_gravity_mesh_direct", json=payload)
    rv_q = client.post("/api/compute_gravity_mesh_quadrature", json=payload)
    assert rv_d.status_code == 200 and rv_q.status_code == 200
    rd = rv_d.get_json()["results"]
    rq = rv_q.get_json()["results"]
    n = min(len(rd), len(rq))
    assert n > 0
    mae = sum(abs(rd[i] - rq[i]) for i in range(n)) / n
    # Far-field small tetra should produce close trends between point-mass and 4-point quadrature.
    assert mae < 1e-2

