"""Sphere/ellipsoid unstructured tet meshes must preserve total mass vs closed-form."""

import math

import pytest

from api.gravity.shared.helpers import create_tetra_mesh_input
from gravity.forward_methods.analytical_closedform.dispatcher import solve_analytical_closedform
from gravity.analysis_gravity.metrics import compute_metrics, global_l2_normalized_pointwise_percent
from gravity.analysis_gravity.solvers import compute_quadrature_mesh

PI = math.pi


def _tet_volume(nodes, tet):
    i0, i1, i2, i3, _ = tet
    x0, y0, z0 = nodes[i0]
    x1, y1, z1 = nodes[i1]
    x2, y2, z2 = nodes[i2]
    x3, y3, z3 = nodes[i3]
    ax, ay, az = x1 - x0, y1 - y0, z1 - z0
    bx, by, bz = x2 - x0, y2 - y0, z2 - z0
    cx, cy, cz = x3 - x0, y3 - y0, z3 - z0
    triple = ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)
    return abs(triple) / 6.0


def _build_clipped_dual_mesh(
    *,
    center_z: float,
    inside,
    target_volume: float,
    ix=40,
    iy=40,
    iz=20,
    sx: float,
    sy: float,
    sz: float,
    rho=2500.0,
):
    """Mirror frontend clipped grid + symmetric dual split + mass-preserving scale."""
    dx, dy, dz = sx / ix, sy / iy, sz / iz
    x_min = -sx * 0.5
    y_min = -sy * 0.5
    z_min = center_z - sz * 0.5
    half = rho * 0.5

    def idx(i, j, k):
        return i * (iy + 1) * (iz + 1) + j * (iz + 1) + k

    nodes = []
    for i in range(ix + 1):
        for j in range(iy + 1):
            for k in range(iz + 1):
                nodes.append([x_min + i * dx, y_min + j * dy, z_min + k * dz])

    elements = []
    for i in range(ix):
        for j in range(iy):
            for k in range(iz):
                xc = x_min + (i + 0.5) * dx
                yc = y_min + (j + 0.5) * dy
                zc = z_min + (k + 0.5) * dz
                if not inside(xc, yc, zc):
                    continue
                n0 = idx(i, j, k)
                n1 = idx(i + 1, j, k)
                n2 = idx(i, j + 1, k)
                n3 = idx(i + 1, j + 1, k)
                n4 = idx(i, j, k + 1)
                n5 = idx(i + 1, j, k + 1)
                n6 = idx(i, j + 1, k + 1)
                n7 = idx(i + 1, j + 1, k + 1)
                for parity in (0, 1):
                    batch = (
                        [
                            [n0, n1, n2, n6, half],
                            [n0, n2, n3, n6, half],
                            [n0, n3, n7, n6, half],
                            [n0, n7, n4, n6, half],
                            [n0, n4, n5, n6, half],
                            [n0, n5, n1, n6, half],
                        ]
                        if parity == 0
                        else [
                            [n1, n0, n4, n7, half],
                            [n1, n4, n5, n7, half],
                            [n1, n5, n6, n7, half],
                            [n1, n6, n2, n7, half],
                            [n1, n2, n3, n7, half],
                            [n1, n3, n0, n7, half],
                        ]
                    )
                    elements.extend(batch)

    current = sum(_tet_volume(nodes, e) for e in elements)
    scale = (target_volume / current) * 2.0
    elements = [[e[0], e[1], e[2], e[3], e[4] * scale] for e in elements]
    return nodes, elements


def _libs_available():
    from api.gravity.shared.libraries import load_libraries

    return load_libraries().quadrature_second_order is not None


@pytest.mark.skipif(not _libs_available(), reason="Native gravity libraries are not loaded.")
@pytest.mark.parametrize(
    "model_type,extra",
    [
        ("Sphere - Tetrahedral", {"sphereRadius": 100.0, "sphereH": 200.0}),
        (
            "Ellipsoid - Tetrahedral",
            {"ellipsoidA": 200.0, "ellipsoidB": 100.0, "ellipsoidC": 150.0, "ellipsoidH": 200.0},
        ),
    ],
)
def test_curved_unstructured_tet_matches_closed_form_amplitude(model_type, extra):
    from api.gravity.shared.libraries import load_libraries

    h = 200.0
    rho = 2500.0
    if "sphereRadius" in extra:
        r = extra["sphereRadius"]
        center_z = -h - r
        span = 2.0 * r
        nodes, elements = _build_clipped_dual_mesh(
            center_z=center_z,
            inside=lambda x, y, z: x * x + y * y + (z - center_z) ** 2 <= r * r,
            target_volume=(4.0 / 3.0) * PI * r**3,
            sx=span,
            sy=span,
            sz=span,
            rho=rho,
        )
    else:
        a, b, c = extra["ellipsoidA"], extra["ellipsoidB"], extra["ellipsoidC"]
        center_z = -h - c
        nodes, elements = _build_clipped_dual_mesh(
            center_z=center_z,
            inside=lambda x, y, z: (x / a) ** 2 + (y / b) ** 2 + ((z - center_z) / c) ** 2 <= 1.0,
            target_volume=(4.0 / 3.0) * PI * a * b * c,
            sx=2.0 * a,
            sy=2.0 * b,
            sz=2.0 * c,
            rho=rho,
        )

    data = {
        "modelType": model_type,
        "centerX": 0.0,
        "centerY": 0.0,
        "centerZ": center_z,
        "h": h,
        "density": rho,
        **extra,
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
        "executionMode": "simd_threads",
        "mesh": {"nodes": nodes, "elements": elements},
    }
    reference = solve_analytical_closedform(data)
    mesh_params, _, _ = create_tetra_mesh_input(data)
    libs = load_libraries()
    candidate, _ = compute_quadrature_mesh(libs, mesh_params)
    metrics = compute_metrics(reference, candidate)
    mean_ref = sum(reference) / len(reference)
    mean_can = sum(candidate) / len(candidate)
    assert mean_can == pytest.approx(mean_ref, rel=5e-3)
    assert metrics["relative_l2_percent"] < 1.0

    err = global_l2_normalized_pointwise_percent(reference, candidate)
    ny = 100
    left = err[39 * ny + 50]
    right = err[60 * ny + 50]
    assert right / left == pytest.approx(1.0, rel=1e-2, abs=1e-9)
