"""Closed-form gz for a homogeneous sphere."""

from __future__ import annotations

import math
from typing import Iterable, List, Tuple

from .common import G_SI, gravity_si_to_mgal


def gz_sphere_mgal(
    receiver: Tuple[float, float, float],
    center: Tuple[float, float, float],
    radius: float,
    density: float,
) -> float:
    rx, ry, rz = receiver
    cx, cy, cz = center
    dx = rx - cx
    dy = ry - cy
    dz = rz - cz
    rr = math.sqrt(dx * dx + dy * dy + dz * dz)
    if rr <= 1e-12:
        return 0.0
    mass = (4.0 / 3.0) * math.pi * (radius**3) * density
    if rr >= radius:
        gz_si = G_SI * mass * dz / (rr**3)
    else:
        # Inside uniform sphere: g(r)=G*M*r/R^3 directed to center.
        gz_si = G_SI * mass * dz / (radius**3)
    return gravity_si_to_mgal(gz_si)


def solve_sphere_grid_mgal(
    receivers: Iterable[Tuple[float, float, float]],
    center: Tuple[float, float, float],
    radius: float,
    density: float,
) -> List[float]:
    return [gz_sphere_mgal(r, center, radius, density) for r in receivers]

