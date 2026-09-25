"""Valley–Mountain forward gravity: density contrast scaling (mesh path used by the UI)."""

from __future__ import annotations

import math
import ctypes

import pytest

from api.app import app
from tests.valley_mountain_mesh_fixture import (
    build_valley_mountain_half_space_mesh,
    mesh_gravity_payload,
)


def _quadrature_mesh_available(client) -> bool:
    rv = client.get("/api/health")
    data = rv.get_json() or {}
    if not data.get("quadrature_second_order_loaded"):
        return False
    from api.gravity.api_server import libs

    q = libs.quadrature_second_order
    return bool(q and hasattr(q, "forward_gravity_tetra_mesh_quadrature"))


def _run_mesh_quadrature(client, payload: dict) -> list[float]:
    rv = client.post("/api/compute_gravity_mesh_quadrature", json=payload)
    assert rv.status_code == 200, rv.get_json()
    return rv.get_json()["results"]


def _rms(values: list[float]) -> float:
    return math.sqrt(sum(v * v for v in values) / max(1, len(values)))


def _center_mean(
    values: list[float], *, num_rx: int, num_ry: int, x_frac: float = 0.35, y_frac: float = 0.35
) -> float:
    ix0 = int(num_rx * (0.5 - x_frac / 2))
    ix1 = int(num_rx * (0.5 + x_frac / 2))
    iy0 = int(num_ry * (0.5 - y_frac / 2))
    iy1 = int(num_ry * (0.5 + y_frac / 2))
    acc = 0.0
    n = 0
    for iy in range(iy0, iy1):
        for ix in range(ix0, ix1):
            acc += values[iy * num_rx + ix]
            n += 1
    return acc / max(1, n)


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


def test_valley_mountain_mesh_quadrature_finite(client):
    if not _quadrature_mesh_available(client):
        pytest.skip("Quadrature tetra-mesh FFI not available (rebuild backend).")

    mesh = build_valley_mountain_half_space_mesh(
        half_space_density=3000.0,
        mountain_valley_density=2200.0,
        mountain_height=0.0,
        valley_depth=0.0,
        nx=12,
        ny=6,
        nz=6,
    )
    assert len(mesh["elements"]) > 100
    results = _run_mesh_quadrature(client, mesh_gravity_payload(mesh))
    assert len(results) > 0
    assert all(math.isfinite(v) for v in results)


def test_valley_mountain_contrast_scales_response(client):
    """Larger |Δρ| should strengthen the anomaly residual vs a uniform host."""
    if not _quadrature_mesh_available(client):
        pytest.skip("Quadrature tetra-mesh FFI not available (rebuild backend).")

    kwargs = dict(mountain_height=0.0, valley_depth=0.0, nx=12, ny=6, nz=6)
    payload_kw = dict(num_receivers_x=24, num_receivers_y=24)

    def anomaly_rms(host_rho: float, block_rho: float) -> float:
        mesh = build_valley_mountain_half_space_mesh(
            half_space_density=host_rho,
            mountain_valley_density=block_rho,
            **kwargs,
        )
        mesh_ref = {
            "nodes": mesh["nodes"],
            "elements": [[int(e[0]), int(e[1]), int(e[2]), int(e[3]), host_rho] for e in mesh["elements"]],
        }
        g = _run_mesh_quadrature(client, mesh_gravity_payload(mesh, **payload_kw))
        g0 = _run_mesh_quadrature(client, mesh_gravity_payload(mesh_ref, **payload_kw))
        n = min(len(g), len(g0))
        return _rms([g[i] - g0[i] for i in range(n)])

    rms_low = anomaly_rms(2800.0, 2700.0)  # Δρ = 100
    rms_high = anomaly_rms(3000.0, 2200.0)  # Δρ = 800
    assert rms_high > rms_low * 1.5, (
        f"high-contrast anomaly RMS {rms_high:.6e} should exceed low-contrast {rms_low:.6e}"
    )


def test_valley_mountain_hexa_sources_follow_relief_geometry(client):
    """Structured hexa/poly sources follow relief geometry and assign both densities."""
    rv = client.get("/api/health")
    data = rv.get_json() or {}
    if not data.get("synthetic_gravity_loaded"):
        pytest.skip("Synthetic gravity source-generation FFI not available (rebuild backend).")

    from api.gravity.api_server import libs
    from api.gravity.shared.helpers import create_model_params

    params = create_model_params(
        {
            "modelType": "Valley-Mountain Model - Hexahedral",
            "centerZ": -145.0,
            "valleyMountainX": 400.0,
            "valleyMountainY": 140.0,
            "valleyMountainZ": 90.0,
            "valleyMountainHeight": 50.0,
            "valleyMountainDepth": 50.0,
            "valleyMountainMountainDensity": 2550.0,
            "valleyMountainValleyDensity": 2850.0,
            "numSourcesX": 48,
            "numSourcesY": 8,
            "numSourcesZ": 8,
        }
    )
    ptr = libs.synthetic_gravity.generate_sources_for_model(ctypes.byref(params))
    try:
        arr = ptr.contents
        assert arr.size > 48 * 8 * 8
        densities = {round(arr.density[i], 6) for i in range(arr.size)}
        assert densities == {2550.0, 2850.0}

        mountain_z = [
            arr.z[i]
            for i in range(arr.size)
            if abs(arr.x[i] - (-0.22 * 400.0)) < 20.0
        ]
        valley_z = [
            arr.z[i]
            for i in range(arr.size)
            if abs(arr.x[i] - (0.24 * 400.0)) < 20.0
        ]
        assert mountain_z and valley_z
        assert max(mountain_z) > max(valley_z), (
            f"mountain-side cells should be shallower than valley-side cells: "
            f"{max(mountain_z):.3f} vs {max(valley_z):.3f}"
        )
    finally:
        libs.synthetic_gravity.free_source_array(ptr)


def test_valley_mountain_hexa_gravity_responds_to_density_contrast(client):
    """Structured hexa/poly gravity changes when mountain/valley densities are swapped."""
    rv = client.get("/api/health")
    data = rv.get_json() or {}
    if not data.get("direct_newton_loaded"):
        pytest.skip("Direct Newton FFI not available (rebuild backend).")

    common = {
        "modelType": "Valley-Mountain Model - Hexahedral",
        "valleyMountainX": 400.0,
        "valleyMountainY": 140.0,
        "valleyMountainZ": 90.0,
        "valleyMountainHeight": 50.0,
        "valleyMountainDepth": 50.0,
        "numSourcesX": 24,
        "numSourcesY": 12,
        "numSourcesZ": 12,
        "numReceiversX": 40,
        "numReceiversY": 40,
        "surfaceXMin": -150.0,
        "surfaceXMax": 150.0,
        "surfaceYMin": -60.0,
        "surfaceYMax": 60.0,
        "surfaceZ": 0.0,
        "executionMode": "reference",
    }

    def run_gravity(mountain_rho: float, valley_rho: float) -> list[float]:
        payload = {
            **common,
            "valleyMountainMountainDensity": mountain_rho,
            "valleyMountainValleyDensity": valley_rho,
        }
        rv = client.post("/api/compute_gravity", json=payload)
        assert rv.status_code == 200, rv.get_json()
        return rv.get_json()["results"]

    g_crest_valley = run_gravity(2550.0, 2850.0)
    g_valley_crest = run_gravity(2850.0, 2550.0)
    max_swap_diff = max(abs(a - b) for a, b in zip(g_crest_valley, g_valley_crest))
    assert max_swap_diff > 0.05, (
        f"swapping mountain/valley densities should change the gravity field, got max Δ {max_swap_diff:.6e} mGal"
    )

    flat = {**common, "valleyMountainHeight": 0.0, "valleyMountainDepth": 0.0}
    payload_light = {**flat, "valleyMountainMountainDensity": 2200.0, "valleyMountainValleyDensity": 2900.0}
    payload_heavy = {**flat, "valleyMountainMountainDensity": 2900.0, "valleyMountainValleyDensity": 2900.0}
    rv_a = client.post("/api/compute_gravity", json=payload_light)
    rv_b = client.post("/api/compute_gravity", json=payload_heavy)
    assert rv_a.status_code == 200 and rv_b.status_code == 200
    results_a = rv_a.get_json()["results"]
    results_b = rv_b.get_json()["results"]
    mean_a = sum(results_a) / len(results_a)
    mean_b = sum(results_b) / len(results_b)
    assert mean_a < mean_b, (
        f"flat block should use mountain density (lighter → more negative g): {mean_a:.6e} vs {mean_b:.6e}"
    )


def test_valley_mountain_light_block_negative_anomaly(client):
    """Dense half-space + light block → negative Δg over the block vs uniform host."""
    if not _quadrature_mesh_available(client):
        pytest.skip("Quadrature tetra-mesh FFI not available (rebuild backend).")

    mesh_two = build_valley_mountain_half_space_mesh(
        half_space_density=2900.0,
        mountain_valley_density=2300.0,
        mountain_height=0.0,
        valley_depth=0.0,
        nx=12,
        ny=6,
        nz=6,
    )
    mesh_ref = {
        "nodes": mesh_two["nodes"],
        "elements": [[int(e[0]), int(e[1]), int(e[2]), int(e[3]), 2900.0] for e in mesh_two["elements"]],
    }
    num_rx = num_ry = 24
    r_two = _run_mesh_quadrature(
        client, mesh_gravity_payload(mesh_two, num_receivers_x=num_rx, num_receivers_y=num_ry)
    )
    r_ref = _run_mesh_quadrature(
        client, mesh_gravity_payload(mesh_ref, num_receivers_x=num_rx, num_receivers_y=num_ry)
    )

    n = min(len(r_two), len(r_ref))
    residual = [r_two[i] - r_ref[i] for i in range(n)]
    mean_center = _center_mean(residual, num_rx=num_rx, num_ry=num_ry)
    assert mean_center < 0.0, f"expected negative central anomaly, got {mean_center:.6e}"
