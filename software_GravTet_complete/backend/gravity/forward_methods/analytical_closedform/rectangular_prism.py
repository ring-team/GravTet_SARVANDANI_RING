"""Closed-form gz for a homogeneous rectangular prism."""

from __future__ import annotations

import math
from typing import Iterable, List, Tuple

from .common import G_SI, gravity_si_to_mgal, safe_log


def _corner_kernel(x: float, y: float, z: float) -> float:
    r = math.sqrt(x * x + y * y + z * z)
    # Standard prism expression component with stable log/atan2 handling.
    term1 = x * safe_log(y + r)
    term2 = y * safe_log(x + r)
    term3 = z * math.atan2(x * y, z * r if abs(z * r) > 1e-30 else 1e-30)
    return term1 + term2 - term3


def gz_rectangular_prism_mgal(
    receiver: Tuple[float, float, float],
    center: Tuple[float, float, float],
    size_xyz: Tuple[float, float, float],
    density: float,
) -> float:
    """Compute vertical gravity anomaly (mGal) from a rectangular prism."""
    rx, ry, rz = receiver
    cx, cy, cz = center
    sx, sy, sz = size_xyz
    hx = 0.5 * float(sx)
    hy = 0.5 * float(sy)
    hz = 0.5 * float(sz)

    x = [rx - (cx - hx), rx - (cx + hx)]
    y = [ry - (cy - hy), ry - (cy + hy)]
    z = [rz - (cz - hz), rz - (cz + hz)]

    acc = 0.0
    for i in range(2):
        for j in range(2):
            for k in range(2):
                sign = -1.0 if ((i + j + k) % 2) else 1.0
                acc += sign * _corner_kernel(x[i], y[j], z[k])

    # Match sign convention used by existing Newton/BH/AMFM routes (positive anomaly for positive density below surface).
    gz_si = -G_SI * float(density) * acc
    return gravity_si_to_mgal(gz_si)


def solve_rectangular_prism_grid_mgal(
    receivers: Iterable[Tuple[float, float, float]],
    center: Tuple[float, float, float],
    size_xyz: Tuple[float, float, float],
    density: float,
) -> List[float]:
    return [gz_rectangular_prism_mgal(r, center, size_xyz, density) for r in receivers]

