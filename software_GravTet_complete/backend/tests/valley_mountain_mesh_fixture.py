"""Build a coarse Valley–Mountain half-space tetra mesh for forward-gravity tests."""

from __future__ import annotations

import math
from typing import Any

# Match frontend VALLEY_MOUNTAIN_DEFAULTS padding.
_HALF_PAD_X = 100.0
_HALF_PAD_Y = 50.0
_HALF_PAD_Z = 30.0


def valley_mountain_display_relief_x(
    x: float, size_x: float, mountain_height: float, valley_depth: float
) -> float:
    mountain_center = -0.22 * size_x
    valley_center = 0.24 * size_x
    mountain_sigma = 0.16 * size_x
    valley_sigma = 0.17 * size_x
    mountain = mountain_height * math.exp(
        -((x - mountain_center) ** 2) / (2.0 * mountain_sigma * mountain_sigma)
    )
    valley = valley_depth * math.exp(-((x - valley_center) ** 2) / (2.0 * valley_sigma * valley_sigma))
    return mountain - valley


def build_valley_mountain_half_space_mesh(
    *,
    block_x: float = 200.0,
    block_y: float = 70.0,
    block_z: float = 45.0,
    mountain_height: float = 50.0,
    valley_depth: float = 50.0,
    half_space_density: float,
    mountain_valley_density: float,
    burial_h: float = 100.0,
    nx: int = 14,
    ny: int = 8,
    nz: int = 8,
) -> dict[str, Any]:
    """Port of frontend ``buildValleyMountainHalfSpaceMesh`` (unstructured tets)."""
    hs_x = block_x + 2.0 * _HALF_PAD_X
    hs_y = block_y + 2.0 * _HALF_PAD_Y
    hs_z = block_z + _HALF_PAD_Z
    center_x = 0.0
    center_y = 0.0
    center_z = -burial_h - block_z * 0.5
    dx = hs_x / max(1, nx)
    dy = hs_y / max(1, ny)
    dz = hs_z / max(1, nz)
    x_min = -hs_x * 0.5
    y_min = -hs_y * 0.5
    z_min = center_z - hs_z * 0.5
    z_ref = center_z + block_z * 0.5
    ax = block_x * 0.5
    ay = block_y * 0.5

    def idx(i: int, j: int, k: int) -> int:
        return i * (ny + 1) * (nz + 1) + j * (nz + 1) + k

    nodes: list[list[float]] = []
    for i in range(nx + 1):
        xb = x_min + i * dx
        for j in range(ny + 1):
            yb = y_min + j * dy
            for k in range(nz + 1):
                nodes.append([center_x + xb, center_y + yb, z_min + k * dz])

    elements: list[list[float]] = []

    def push_unstructured_tets(
        n0: int, n1: int, n2: int, n3: int, n4: int, n5: int, n6: int, n7: int, rho: float, parity: int
    ) -> None:
        if parity == 0:
            elements.extend(
                [
                    [n0, n1, n2, n6, rho],
                    [n0, n2, n3, n6, rho],
                    [n0, n3, n7, n6, rho],
                    [n0, n7, n4, n6, rho],
                    [n0, n4, n5, n6, rho],
                    [n0, n5, n1, n6, rho],
                ]
            )
        else:
            elements.extend(
                [
                    [n1, n0, n4, n7, rho],
                    [n1, n4, n5, n7, rho],
                    [n1, n5, n6, n7, rho],
                    [n1, n6, n2, n7, rho],
                    [n1, n2, n3, n7, rho],
                    [n1, n3, n0, n7, rho],
                ]
            )

    for i in range(nx):
        xc = x_min + (i + 0.5) * dx
        x_world = center_x + xc
        for j in range(ny):
            yc = y_min + (j + 0.5) * dy
            y_world = center_y + yc
            for k in range(nz):
                zc = z_min + (k + 0.5) * dz
                in_anomaly = abs(x_world - center_x) <= ax and abs(y_world - center_y) <= ay
                relief = (
                    valley_mountain_display_relief_x(xc, block_x, mountain_height, valley_depth)
                    if in_anomaly
                    else 0.0
                )
                z_top = z_ref + relief
                if zc > z_top + 1e-6:
                    continue
                rho = (
                    mountain_valley_density
                    if in_anomaly and relief >= 0.0
                    else half_space_density
                )
                n0 = idx(i, j, k)
                n1 = idx(i + 1, j, k)
                n2 = idx(i, j + 1, k)
                n3 = idx(i + 1, j + 1, k)
                n4 = idx(i, j, k + 1)
                n5 = idx(i + 1, j, k + 1)
                n6 = idx(i, j + 1, k + 1)
                n7 = idx(i + 1, j + 1, k + 1)
                push_unstructured_tets(n0, n1, n2, n3, n4, n5, n6, n7, rho, (i + j + k) & 1)

    return {"nodes": nodes, "elements": elements}


def mesh_gravity_payload(
    mesh: dict[str, Any],
    *,
    num_receivers_x: int = 24,
    num_receivers_y: int = 24,
    surface_x_min: float = -80.0,
    surface_x_max: float = 80.0,
    surface_y_min: float = -40.0,
    surface_y_max: float = 40.0,
    surface_z: float = 0.0,
) -> dict[str, Any]:
    return {
        "mesh": mesh,
        "numReceiversX": num_receivers_x,
        "numReceiversY": num_receivers_y,
        "surfaceXMin": surface_x_min,
        "surfaceXMax": surface_x_max,
        "surfaceYMin": surface_y_min,
        "surfaceYMax": surface_y_max,
        "surfaceZ": surface_z,
        "executionMode": "reference",
    }
