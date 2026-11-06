"""Shared far-field point-mass helper used by analytical shape adapters."""

from __future__ import annotations

import math
from typing import Iterable, List, Tuple

from .common import G_SI, gravity_si_to_mgal


def gz_point_mass_mgal(
    receiver: Tuple[float, float, float],
    center: Tuple[float, float, float],
    mass: float,
) -> float:
    rx, ry, rz = receiver
    cx, cy, cz = center
    dx = rx - cx
    dy = ry - cy
    dz = rz - cz
    r2 = dx * dx + dy * dy + dz * dz
    if r2 <= 1e-20:
        return 0.0
    rr = math.sqrt(r2)
    gz_si = G_SI * mass * dz / (rr**3)
    return gravity_si_to_mgal(gz_si)


def solve_point_mass_grid_mgal(
    receivers: Iterable[Tuple[float, float, float]],
    center: Tuple[float, float, float],
    mass: float,
) -> List[float]:
    return [gz_point_mass_mgal(r, center, mass) for r in receivers]

