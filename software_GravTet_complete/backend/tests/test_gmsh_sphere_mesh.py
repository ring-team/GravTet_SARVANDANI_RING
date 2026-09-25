"""Phase 1–4: Tetrahedral mesh builder tests."""

import pytest

from api.gravity.mesh import routes as routes_gmsh
from api.gravity.mesh import mesh_route_utils
from api.app import app
from api.gravity.mesh.mesh_route_utils import has_mesh_payload
from gravity.mesh.gmsh_build import (
    GMSH_SUPPORTED_BASE_MODELS,
    build_gmsh_tetra_mesh,
    gmsh_python_available,
    is_gmsh_mesh_build_supported,
)


def _gmsh_available():
    return gmsh_python_available()


def test_count_only_gmsh_helper_does_not_require_mesh_payload(monkeypatch):
    from gravity.mesh import gmsh_build

    calls = []

    monkeypatch.setattr(gmsh_build, "gmsh_python_available", lambda: True)
    monkeypatch.setattr(gmsh_build, "is_gmsh_mesh_build_supported", lambda _model_type: True)

    def fake_build(data):
        calls.append(dict(data))
        return {
            "modelType": data["modelType"],
            "numNodes": 12,
            "numElements": 34,
            "countOnly": True,
        }

    monkeypatch.setattr(gmsh_build, "build_gmsh_tetra_mesh_with_timeout", fake_build)

    built, meta = mesh_route_utils.build_or_get_gmsh_mesh(
        {
            "modelType": "Cube - Tetrahedral",
            "cubeX": 100.0,
            "cubeY": 100.0,
            "cubeZ": 100.0,
            "targetElementSize": 10.0,
            "surfaceRefinement": 0.4,
            "localRefinementNearEdges": 0.4,
            "countOnly": True,
        }
    )

    assert built["countOnly"] is True
    assert "mesh" not in built
    assert meta["numNodes"] == 12
    assert meta["numElements"] == 34
    assert meta["buildMs"] >= 0.0
    assert meta["cacheHit"] is False
    assert calls and calls[0]["countOnly"] is True


def test_warm_cache_only_helper_builds_forward_mesh_cache(monkeypatch):
    from gravity.mesh import gmsh_build

    calls = []
    mesh_route_utils._GMSH_MESH_CACHE.clear()

    monkeypatch.setattr(gmsh_build, "gmsh_python_available", lambda: True)
    monkeypatch.setattr(gmsh_build, "is_gmsh_mesh_build_supported", lambda _model_type: True)

    def fake_build(data):
        calls.append(dict(data))
        return {
            "modelType": data["modelType"],
            "numNodes": 4,
            "numElements": 1,
            "mesh": {
                "nodes": [[0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]],
                "elements": [[0, 1, 2, 3, 2500.0]],
            },
        }

    monkeypatch.setattr(gmsh_build, "build_gmsh_tetra_mesh_with_timeout", fake_build)
    request_body = {
        "modelType": "Cube - Tetrahedral",
        "cubeX": 100.0,
        "cubeY": 100.0,
        "cubeZ": 100.0,
        "targetElementSize": 10.0,
        "surfaceRefinement": 0.4,
        "localRefinementNearEdges": 0.4,
        "warmCacheOnly": True,
    }

    built, meta = mesh_route_utils.build_or_get_gmsh_mesh(request_body)
    assert "mesh" in built
    assert meta["cacheHit"] is False

    _, second_meta = mesh_route_utils.build_or_get_gmsh_mesh(request_body)
    assert second_meta["cacheHit"] is True
    assert len(calls) == 1
    assert "warmCacheOnly" not in calls[0]


def test_warm_cache_only_route_returns_stats_without_mesh(monkeypatch):
    app.config["TESTING"] = True
    client = app.test_client()

    monkeypatch.setattr(routes_gmsh, "gmsh_python_available", lambda: True)
    monkeypatch.setattr(routes_gmsh, "is_gmsh_mesh_build_supported", lambda _model_type: True)
    monkeypatch.setattr(
        routes_gmsh,
        "build_or_get_gmsh_mesh",
        lambda _data, _logger: (
            {
                "modelType": "Cube - Tetrahedral",
                "numNodes": 4,
                "numElements": 1,
                "mesh": {"nodes": [[0.0, 0.0, 0.0]], "elements": [[0, 0, 0, 0, 2500.0]]},
            },
            {"numNodes": 4, "numElements": 1, "buildMs": 12.0, "cacheHit": False},
        ),
    )

    rv = client.post(
        "/api/build_gmsh_tetra_mesh",
        json={
            "modelType": "Cube - Tetrahedral",
            "cubeX": 100.0,
            "cubeY": 100.0,
            "cubeZ": 100.0,
            "warmCacheOnly": True,
        },
    )
    assert rv.status_code == 200, rv.get_json()
    payload = rv.get_json()
    assert payload["warmCacheOnly"] is True
    assert payload["numElements"] == 1
    assert "mesh" not in payload


@pytest.mark.skipif(not _gmsh_available(), reason="Gmsh Python API not installed.")
@pytest.mark.parametrize(
    "model_type,extra",
    [
        ("Sphere - Tetrahedral", {"sphereRadius": 100.0}),
        ("Cube - Tetrahedral", {"cubeX": 100.0, "cubeY": 100.0, "cubeZ": 100.0}),
        (
            "Rectangular Prism (Cuboid) - Tetrahedral",
            {"cubeX": 120.0, "cubeY": 80.0, "cubeZ": 60.0},
        ),
        (
            "Ellipsoid - Tetrahedral",
            {"ellipsoidA": 100.0, "ellipsoidB": 80.0, "ellipsoidC": 120.0},
        ),
        (
            "Vertical Cylinder - Tetrahedral",
            {"verticalCylinderRadius": 50.0, "verticalCylinderHeight": 100.0},
        ),
        (
            "Horizontal Cylinder - Tetrahedral",
            {"horizontalCylinderRadius": 50.0, "horizontalCylinderLength": 100.0},
        ),
        (
            "4 Cubes - Tetrahedral",
            {
                "spacingX": 80.0,
                "spacingY": 80.0,
                "cube1X": 20.0,
                "cube1Y": 20.0,
                "cube1Z": 20.0,
                "cube1H": 2.0,
                "cube2X": 20.0,
                "cube2Y": 20.0,
                "cube2Z": 20.0,
                "cube2H": 2.0,
                "cube3X": 20.0,
                "cube3Y": 20.0,
                "cube3Z": 20.0,
                "cube3H": 2.0,
                "cube4X": 20.0,
                "cube4Y": 20.0,
                "cube4Z": 20.0,
                "cube4H": 2.0,
            },
        ),
        (
            "Faulted Block Model - Tetrahedral",
            {"faultedBlockX": 100.0, "faultedBlockY": 100.0, "faultedBlockZ": 100.0, "faultedBlockFaultOffset": 20.0},
        ),
        (
            "Valley-Mountain Model - Tetrahedral",
            {
                "valleyMountainX": 200.0,
                "valleyMountainY": 70.0,
                "valleyMountainZ": 45.0,
                "valleyMountainHeight": 50.0,
                "valleyMountainDepth": 50.0,
                "valleyMountainHalfSpaceDensity": 3000.0,
                "valleyMountainMountainDensity": 2200.0,
            },
        ),
    ],
)
def test_gmsh_primitive_shapes_build_tets(model_type, extra):
    data = {
        "modelType": model_type,
        "centerX": 0.0,
        "centerY": 0.0,
        "centerZ": -300.0,
        "h": 200.0,
        "density": 2500.0,
        "targetElementSize": 10.0,
        "surfaceRefinement": 0.0,
        "localRefinementNearEdges": 0.0,
        **extra,
    }
    out = build_gmsh_tetra_mesh(data)
    assert out["numNodes"] > 50
    assert out["numElements"] > 50
    assert len(out["mesh"]["elements"]) == out["numElements"]


@pytest.mark.skipif(not _gmsh_available(), reason="Gmsh Python API not installed.")
def test_gmsh_count_only_matches_full_build():
    base = {
        "modelType": "Cube - Tetrahedral",
        "cubeX": 100.0,
        "cubeY": 100.0,
        "cubeZ": 100.0,
        "centerX": 0.0,
        "centerY": 0.0,
        "centerZ": -150.0,
        "h": 100.0,
        "density": 2500.0,
        "targetElementSize": 12.0,
        "surfaceRefinement": 0.0,
        "localRefinementNearEdges": 0.0,
    }
    full = build_gmsh_tetra_mesh(base)
    count_only = build_gmsh_tetra_mesh({**base, "countOnly": True})
    assert count_only.get("countOnly") is True
    assert "mesh" not in count_only
    assert count_only["numElements"] == full["numElements"]
    assert count_only["numNodes"] == full["numNodes"]


@pytest.mark.skipif(not _gmsh_available(), reason="Gmsh Python API not installed.")
def test_gmsh_valley_mountain_count_only_matches_full_build():
    base = {
        "modelType": "Valley-Mountain Model - Tetrahedral",
        "centerX": 0.0,
        "centerY": 0.0,
        "centerZ": -145.0,
        "h": 100.0,
        "density": 2550.0,
        "valleyMountainX": 200.0,
        "valleyMountainY": 70.0,
        "valleyMountainZ": 45.0,
        "valleyMountainHeight": 50.0,
        "valleyMountainDepth": 50.0,
        "valleyMountainHalfSpaceDensity": 3000.0,
        "valleyMountainMountainDensity": 2200.0,
        "targetElementSize": 12.0,
        "surfaceRefinement": 0.0,
        "localRefinementNearEdges": 0.0,
    }
    full = build_gmsh_tetra_mesh(base)
    count_only = build_gmsh_tetra_mesh({**base, "countOnly": True})
    assert count_only.get("countOnly") is True
    assert "mesh" not in count_only
    assert count_only["numElements"] == full["numElements"]
    assert count_only["numNodes"] == full["numNodes"]


@pytest.mark.skipif(not _gmsh_available(), reason="Gmsh Python API not installed.")
def test_gmsh_sphere_coarser_mesh_has_fewer_elements():
    base = {
        "modelType": "Sphere - Tetrahedral",
        "sphereRadius": 100.0,
        "centerX": 0.0,
        "centerY": 0.0,
        "centerZ": -300.0,
        "h": 200.0,
        "density": 2500.0,
        "surfaceRefinement": 0.0,
        "localRefinementNearEdges": 0.0,
    }
    fine = build_gmsh_tetra_mesh({**base, "targetElementSize": 6.0})
    coarse = build_gmsh_tetra_mesh({**base, "targetElementSize": 12.0})
    assert coarse["numElements"] < fine["numElements"]


def test_non_supported_gmsh_shape_returns_not_implemented():
    if not _gmsh_available():
        pytest.skip("Gmsh Python API not installed.")
    with pytest.raises(NotImplementedError, match="Voxel-Based Density Model"):
        build_gmsh_tetra_mesh(
            {
                "modelType": "Voxel-Based Density Model - Tetrahedral",
                "targetElementSize": 5.0,
                "density": 2500.0,
            }
        )


@pytest.mark.skipif(not _gmsh_available(), reason="Gmsh Python API not installed.")
def test_gmsh_horizontal_cylinder_axis_is_along_x():
    """Gmsh mesh extent along X must exceed Y when length >> diameter (backend convention)."""
    data = {
        "modelType": "Horizontal Cylinder - Tetrahedral",
        "horizontalCylinderRadius": 25.0,
        "horizontalCylinderLength": 200.0,
        "centerX": 0.0,
        "centerY": 0.0,
        "centerZ": -55.0,
        "h": 30.0,
        "density": 2500.0,
        "targetElementSize": 12.0,
        "surfaceRefinement": 0.0,
        "localRefinementNearEdges": 0.0,
    }
    out = build_gmsh_tetra_mesh(data)
    nodes = out["mesh"]["nodes"]
    xs = [n[0] for n in nodes]
    ys = [n[1] for n in nodes]
    x_extent = max(xs) - min(xs)
    y_extent = max(ys) - min(ys)
    assert x_extent > y_extent * 1.5
    assert 180.0 < x_extent < 220.0
    assert 45.0 < y_extent < 55.0


def test_is_gmsh_mesh_build_supported_primitives():
    for base in GMSH_SUPPORTED_BASE_MODELS:
        assert is_gmsh_mesh_build_supported(f"{base} - Tetrahedral")
    assert is_gmsh_mesh_build_supported("4 Cubes - Tetrahedral")
    assert is_gmsh_mesh_build_supported("Faulted Block Model - Tetrahedral")
    assert is_gmsh_mesh_build_supported("Valley-Mountain Model - Tetrahedral")
    assert not is_gmsh_mesh_build_supported("Sphere - Hexahedral")


def test_empty_mesh_dict_is_not_mesh_payload():
    assert not has_mesh_payload({"mesh": {}})
    assert not has_mesh_payload({"mesh": {"nodes": [], "elements": []}})


@pytest.mark.skipif(not _gmsh_available(), reason="Gmsh Python API not installed.")
def test_gmsh_preview_does_not_warm_forward_mesh_cache():
    """Source-count preview returns counts only and leaves full mesh cache for forward modeling."""
    app.config["TESTING"] = True
    client = app.test_client()
    rv_health = client.get("/api/health")
    health = rv_health.get_json() or {}
    if not health.get("quadrature_second_order_loaded"):
        pytest.skip("Quadrature library not loaded.")

    mesh_params = {
        "modelType": "Sphere - Tetrahedral",
        "sphereRadius": 50.0,
        "centerX": 0.0,
        "centerY": 0.0,
        "centerZ": -100.0,
        "h": 50.0,
        "density": 2500.0,
        "targetElementSize": 12.0,
        "surfaceRefinement": 0.25,
        "localRefinementNearEdges": 0.25,
    }
    rv_preview = client.post("/api/build_gmsh_tetra_mesh", json={**mesh_params, "countOnly": True})
    assert rv_preview.status_code == 200, rv_preview.get_json()
    preview = rv_preview.get_json()
    assert preview.get("countOnly") is True
    assert "mesh" not in preview
    assert preview.get("cacheHit") is False

    forward_payload = {
        **mesh_params,
        "numReceiversX": 4,
        "numReceiversY": 4,
        "surfaceXMin": -100.0,
        "surfaceXMax": 100.0,
        "surfaceYMin": -100.0,
        "surfaceYMax": 100.0,
        "surfaceZ": 0.0,
    }
    rv_forward = client.post("/api/compute_gravity_mesh_quadrature", json=forward_payload)
    assert rv_forward.status_code == 200, rv_forward.get_json()
    gmsh_build = (rv_forward.get_json().get("solver_meta") or {}).get("gmshBuild")
    assert isinstance(gmsh_build, dict)
    assert gmsh_build.get("cacheHit") is False
    assert gmsh_build.get("numElements") == preview.get("numElements")


@pytest.mark.skipif(not _gmsh_available(), reason="Gmsh Python API not installed.")
def test_compute_quadrature_builds_gmsh_mesh_on_server():
    app.config["TESTING"] = True
    client = app.test_client()
    rv_health = client.get("/api/health")
    health = rv_health.get_json() or {}
    if not health.get("quadrature_second_order_loaded"):
        pytest.skip("Quadrature library not loaded.")

    payload = {
        "modelType": "Sphere - Tetrahedral",
        "sphereRadius": 50.0,
        "centerX": 0.0,
        "centerY": 0.0,
        "centerZ": -50.0,
        "h": 50.0,
        "density": 2500.0,
        "targetElementSize": 12.0,
        "surfaceRefinement": 0.25,
        "localRefinementNearEdges": False,
        "numReceiversX": 4,
        "numReceiversY": 4,
        "surfaceXMin": -100.0,
        "surfaceXMax": 100.0,
        "surfaceYMin": -100.0,
        "surfaceYMax": 100.0,
        "surfaceZ": 0.0,
    }
    rv = client.post("/api/compute_gravity_mesh_quadrature", json=payload)
    assert rv.status_code == 200, rv.get_json()
    body = rv.get_json()
    assert body.get("num_sources", 0) > 0
    gmsh_build = (body.get("solver_meta") or {}).get("gmshBuild")
    assert isinstance(gmsh_build, dict)
    assert gmsh_build.get("numNodes", 0) > 0
    assert gmsh_build.get("numElements", 0) > 0

    rv_cached = client.post("/api/compute_gravity_mesh_quadrature", json=payload)
    assert rv_cached.status_code == 200, rv_cached.get_json()
    cached_build = ((rv_cached.get_json() or {}).get("solver_meta") or {}).get("gmshBuild")
    assert isinstance(cached_build, dict)
    assert cached_build.get("cacheHit") is True


@pytest.mark.skipif(not _gmsh_available(), reason="Gmsh Python API not installed.")
@pytest.mark.parametrize(
    "payload",
    [
        {
            "modelType": "4 Cubes - Tetrahedral",
            "centerX": 0.0,
            "centerY": 0.0,
            "centerZ": -12.0,
            "h": 2.0,
            "density": 2500.0,
            "spacingX": 80.0,
            "spacingY": 80.0,
            "targetElementSize": 8.0,
            "surfaceRefinement": 0.25,
            "localRefinementNearEdges": 0.25,
            "numReceiversX": 8,
            "numReceiversY": 8,
            "surfaceXMin": -100.0,
            "surfaceXMax": 100.0,
            "surfaceYMin": -100.0,
            "surfaceYMax": 100.0,
            "surfaceZ": 0.0,
        },
        {
            "modelType": "Faulted Block Model - Tetrahedral",
            "centerX": 0.0,
            "centerY": 0.0,
            "centerZ": -52.0,
            "h": 2.0,
            "density": 2500.0,
            "faultedBlockX": 100.0,
            "faultedBlockY": 100.0,
            "faultedBlockZ": 100.0,
            "faultedBlockFaultOffset": 20.0,
            "targetElementSize": 10.0,
            "surfaceRefinement": 0.25,
            "localRefinementNearEdges": 0.25,
            "numReceiversX": 8,
            "numReceiversY": 8,
            "surfaceXMin": -100.0,
            "surfaceXMax": 100.0,
            "surfaceYMin": -100.0,
            "surfaceYMax": 100.0,
            "surfaceZ": 0.0,
        },
        {
            "modelType": "Valley-Mountain Model - Tetrahedral",
            "centerX": 0.0,
            "centerY": 0.0,
            "centerZ": -145.0,
            "h": 100.0,
            "density": 2550.0,
            "valleyMountainX": 200.0,
            "valleyMountainY": 70.0,
            "valleyMountainZ": 45.0,
            "valleyMountainHeight": 50.0,
            "valleyMountainDepth": 50.0,
            "valleyMountainHalfSpaceDensity": 3000.0,
            "valleyMountainMountainDensity": 2200.0,
            "targetElementSize": 12.0,
            "surfaceRefinement": 0.25,
            "localRefinementNearEdges": 0.25,
            "numReceiversX": 8,
            "numReceiversY": 8,
            "surfaceXMin": -150.0,
            "surfaceXMax": 150.0,
            "surfaceYMin": -80.0,
            "surfaceYMax": 80.0,
            "surfaceZ": 0.0,
        },
    ],
)
def test_compute_quadrature_builds_gmsh_composite_models(payload):
    app.config["TESTING"] = True
    client = app.test_client()
    rv_health = client.get("/api/health")
    health = rv_health.get_json() or {}
    if not health.get("quadrature_second_order_loaded"):
        pytest.skip("Quadrature library not loaded.")

    rv = client.post("/api/compute_gravity_mesh_quadrature", json=payload)
    assert rv.status_code == 200, rv.get_json()
    body = rv.get_json()
    assert body.get("num_sources", 0) > 0
    assert all(isinstance(v, float) for v in body.get("results", []))
