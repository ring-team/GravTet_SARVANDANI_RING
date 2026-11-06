"""Finite-cylinder gravity kernels from direct volume integration (shape-specific)."""

from __future__ import annotations

import math
from typing import Iterable, List, Tuple

import numpy as np

from .common import G_SI, gravity_si_to_mgal


def _gz_from_weighted_sources(
    receivers: Iterable[Tuple[float, float, float]],
    src_x: np.ndarray,
    src_y: np.ndarray,
    src_z: np.ndarray,
    src_mass: np.ndarray,
    chunk_size: int = 256,
) -> List[float]:
    out: List[float] = []
    n_src = src_x.size
    if n_src == 0:
        return [0.0 for _ in receivers]
    sx = src_x.reshape(1, -1)
    sy = src_y.reshape(1, -1)
    sz = src_z.reshape(1, -1)
    sm = src_mass.reshape(1, -1)
    rec = list(receivers)
    for i in range(0, len(rec), chunk_size):
        chunk = rec[i : i + chunk_size]
        rx = np.asarray([p[0] for p in chunk], dtype=np.float64).reshape(-1, 1)
        ry = np.asarray([p[1] for p in chunk], dtype=np.float64).reshape(-1, 1)
        rz = np.asarray([p[2] for p in chunk], dtype=np.float64).reshape(-1, 1)
        dx = rx - sx
        dy = ry - sy
        dz = rz - sz
        r2 = dx * dx + dy * dy + dz * dz + 1e-18
        inv_r3 = 1.0 / (r2 * np.sqrt(r2))
        gz_si = G_SI * np.sum(sm * dz * inv_r3, axis=1)
        out.extend([gravity_si_to_mgal(v) for v in gz_si])
    return out


def _vertical_cylinder_quadrature_sources(
    center: Tuple[float, float, float],
    radius: float,
    height: float,
    density: float,
    *,
    n_r: int = 14,
    n_z: int = 20,
    n_theta: int = 32,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    cx, cy, cz = center
    r_nodes, r_weights = np.polynomial.legendre.leggauss(n_r)
    z_nodes, z_weights = np.polynomial.legendre.leggauss(n_z)
    rr = 0.5 * radius * (r_nodes + 1.0)
    wr = 0.5 * radius * r_weights
    zz = cz + 0.5 * height * z_nodes
    wz = 0.5 * height * z_weights
    theta = np.linspace(0.0, 2.0 * math.pi, n_theta, endpoint=False)
    w_theta = (2.0 * math.pi) / float(n_theta)

    src_x = []
    src_y = []
    src_z = []
    src_m = []
    for iz, zv in enumerate(zz):
        for ir, rv in enumerate(rr):
            base_w = density * wz[iz] * wr[ir] * rv * w_theta
            cth = np.cos(theta)
            sth = np.sin(theta)
            src_x.extend((cx + rv * cth).tolist())
            src_y.extend((cy + rv * sth).tolist())
            src_z.extend([zv] * n_theta)
            src_m.extend([base_w] * n_theta)
    return (
        np.asarray(src_x, dtype=np.float64),
        np.asarray(src_y, dtype=np.float64),
        np.asarray(src_z, dtype=np.float64),
        np.asarray(src_m, dtype=np.float64),
    )


def _horizontal_cylinder_quadrature_sources(
    center: Tuple[float, float, float],
    radius: float,
    length: float,
    density: float,
    *,
    n_r: int = 14,
    n_x: int = 20,
    n_theta: int = 32,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    cx, cy, cz = center
    r_nodes, r_weights = np.polynomial.legendre.leggauss(n_r)
    x_nodes, x_weights = np.polynomial.legendre.leggauss(n_x)
    rr = 0.5 * radius * (r_nodes + 1.0)
    wr = 0.5 * radius * r_weights
    xx = cx + 0.5 * length * x_nodes
    wx = 0.5 * length * x_weights
    theta = np.linspace(0.0, 2.0 * math.pi, n_theta, endpoint=False)
    w_theta = (2.0 * math.pi) / float(n_theta)

    src_x = []
    src_y = []
    src_z = []
    src_m = []
    for ix, xv in enumerate(xx):
        for ir, rv in enumerate(rr):
            base_w = density * wx[ix] * wr[ir] * rv * w_theta
            cth = np.cos(theta)
            sth = np.sin(theta)
            src_x.extend([xv] * n_theta)
            src_y.extend((cy + rv * cth).tolist())
            src_z.extend((cz + rv * sth).tolist())
            src_m.extend([base_w] * n_theta)
    return (
        np.asarray(src_x, dtype=np.float64),
        np.asarray(src_y, dtype=np.float64),
        np.asarray(src_z, dtype=np.float64),
        np.asarray(src_m, dtype=np.float64),
    )


def solve_vertical_cylinder_grid_mgal(
    receivers: Iterable[Tuple[float, float, float]],
    center: Tuple[float, float, float],
    radius: float,
    height: float,
    density: float,
) -> List[float]:
    src_x, src_y, src_z, src_m = _vertical_cylinder_quadrature_sources(
        center,
        max(radius, 1e-9),
        max(height, 1e-9),
        density,
    )
    return _gz_from_weighted_sources(receivers, src_x, src_y, src_z, src_m)


def solve_horizontal_cylinder_grid_mgal(
    receivers: Iterable[Tuple[float, float, float]],
    center: Tuple[float, float, float],
    radius: float,
    length: float,
    density: float,
) -> List[float]:
    src_x, src_y, src_z, src_m = _horizontal_cylinder_quadrature_sources(
        center,
        max(radius, 1e-9),
        max(length, 1e-9),
        density,
    )
    return _gz_from_weighted_sources(receivers, src_x, src_y, src_z, src_m)

