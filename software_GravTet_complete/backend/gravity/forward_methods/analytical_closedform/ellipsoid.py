"""Triaxial ellipsoid gravity kernel from direct volume integration (shape-specific)."""

from __future__ import annotations

from typing import Iterable, List, Tuple

import numpy as np

from .common import G_SI, gravity_si_to_mgal


def _ellipsoid_quadrature_sources(
    center: Tuple[float, float, float],
    a: float,
    b: float,
    c: float,
    density: float,
    *,
    n_rho: int = 12,
    n_phi: int = 16,
    n_theta: int = 32,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    cx, cy, cz = center
    rho_nodes, rho_weights = np.polynomial.legendre.leggauss(n_rho)
    phi_nodes, phi_weights = np.polynomial.legendre.leggauss(n_phi)

    rho = 0.5 * (rho_nodes + 1.0)
    w_rho = 0.5 * rho_weights
    phi = 0.5 * np.pi * (phi_nodes + 1.0)
    w_phi = 0.5 * np.pi * phi_weights
    theta = np.linspace(0.0, 2.0 * np.pi, n_theta, endpoint=False)
    w_theta = (2.0 * np.pi) / float(n_theta)

    cth = np.cos(theta)
    sth = np.sin(theta)
    src_x = []
    src_y = []
    src_z = []
    src_m = []
    for ip, ph in enumerate(phi):
        sphi = np.sin(ph)
        cphi = np.cos(ph)
        for ir, rv in enumerate(rho):
            jac = a * b * c * (rv**2) * sphi
            base_w = density * jac * w_phi[ip] * w_rho[ir] * w_theta
            xp = cx + a * rv * sphi * cth
            yp = cy + b * rv * sphi * sth
            zp = cz + c * rv * cphi
            src_x.extend(xp.tolist())
            src_y.extend(yp.tolist())
            src_z.extend([float(zp)] * n_theta)
            src_m.extend([base_w] * n_theta)

    return (
        np.asarray(src_x, dtype=np.float64),
        np.asarray(src_y, dtype=np.float64),
        np.asarray(src_z, dtype=np.float64),
        np.asarray(src_m, dtype=np.float64),
    )


def _gz_from_weighted_sources(
    receivers: Iterable[Tuple[float, float, float]],
    src_x: np.ndarray,
    src_y: np.ndarray,
    src_z: np.ndarray,
    src_mass: np.ndarray,
    chunk_size: int = 256,
) -> List[float]:
    out: List[float] = []
    if src_x.size == 0:
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


def solve_ellipsoid_grid_mgal(
    receivers: Iterable[Tuple[float, float, float]],
    center: Tuple[float, float, float],
    a: float,
    b: float,
    c: float,
    density: float,
) -> List[float]:
    src_x, src_y, src_z, src_m = _ellipsoid_quadrature_sources(
        center,
        max(a, 1e-9),
        max(b, 1e-9),
        max(c, 1e-9),
        density,
    )
    return _gz_from_weighted_sources(receivers, src_x, src_y, src_z, src_m)

