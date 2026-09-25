"""Shared utilities for analytical closed-form gravity."""

from __future__ import annotations

import math
from typing import List, Tuple

G_SI = 6.67430e-11  # m^3 kg^-1 s^-2
SI_TO_MGAL = 1e5


def build_receiver_grid(
    num_receivers_x: int,
    num_receivers_y: int,
    surface_x_min: float,
    surface_x_max: float,
    surface_y_min: float,
    surface_y_max: float,
    surface_z: float,
) -> List[Tuple[float, float, float]]:
    """Return receiver points in row-major order matching existing API expectations."""
    nx = max(1, int(num_receivers_x))
    ny = max(1, int(num_receivers_y))
    dx = (surface_x_max - surface_x_min) / float(max(nx - 1, 1))
    dy = (surface_y_max - surface_y_min) / float(max(ny - 1, 1))
    out: List[Tuple[float, float, float]] = []
    for i in range(nx):
        xx = surface_x_min + i * dx
        for j in range(ny):
            yy = surface_y_min + j * dy
            out.append((xx, yy, surface_z))
    return out


def gravity_si_to_mgal(gz_si: float) -> float:
    return float(gz_si) * SI_TO_MGAL


def safe_log(value: float) -> float:
    """Stable log for near-zero positive values."""
    return math.log(max(value, 1e-30))

