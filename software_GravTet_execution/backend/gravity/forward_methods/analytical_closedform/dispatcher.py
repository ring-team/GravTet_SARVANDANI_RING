"""Dispatch analytical closed-form gravity by supported model type."""

from __future__ import annotations

from typing import Dict, List, Tuple

from .common import build_receiver_grid
from .cylinder import solve_horizontal_cylinder_grid_mgal, solve_vertical_cylinder_grid_mgal
from .ellipsoid import solve_ellipsoid_grid_mgal
from .rectangular_prism import solve_rectangular_prism_grid_mgal
from .sphere import solve_sphere_grid_mgal

# Base synthetic shape names (mesh suffix is ignored — closed-form uses continuous geometry only).
ANALYTICAL_SUPPORTED_BASE_MODELS = frozenset({
    "Cube",
    "Rectangular Prism (Cuboid)",
    "Sphere",
    "Ellipsoid",
    "Vertical Cylinder",
    "Horizontal Cylinder",
})


def _base_model_type(model_type: str) -> str:
    """Strip mesh discretization suffix, e.g. ``Cube - Tetrahedral`` → ``Cube``."""
    return (model_type or "").split(" - ", 1)[0].strip()


def _parse_common(data: Dict) -> Tuple[List[Tuple[float, float, float]], Tuple[float, float, float], float]:
    receivers = build_receiver_grid(
        int(data.get("numReceiversX", 100)),
        int(data.get("numReceiversY", 100)),
        float(data.get("surfaceXMin", -100.0)),
        float(data.get("surfaceXMax", 100.0)),
        float(data.get("surfaceYMin", -100.0)),
        float(data.get("surfaceYMax", 100.0)),
        float(data.get("surfaceZ", 0.0)),
    )
    center = (
        float(data.get("centerX", 0.0)),
        float(data.get("centerY", 0.0)),
        float(data.get("centerZ", -52.0)),
    )
    density = float(data.get("density", 2500.0))
    return receivers, center, density


def solve_analytical_closedform(data: Dict) -> List[float]:
    model_type = str(data.get("modelType", "") or "").strip()
    base_model = _base_model_type(model_type)
    receivers, center, density = _parse_common(data)

    if base_model not in ANALYTICAL_SUPPORTED_BASE_MODELS:
        raise ValueError(
            "Analytical closed-form supports Cube, Cuboid, Sphere, Ellipsoid, Vertical Cylinder, "
            "and Horizontal Cylinder (any mesh type: Hexahedral, Tetrahedral, or Unstructured Polyhedral)."
        )

    if base_model in {"Cube", "Rectangular Prism (Cuboid)"}:
        size_xyz = (
            float(data.get("cubeX", 100.0)),
            float(data.get("cubeY", 100.0)),
            float(data.get("cubeZ", 100.0)),
        )
        return solve_rectangular_prism_grid_mgal(receivers, center, size_xyz, density)

    if base_model == "Sphere":
        radius = float(data.get("sphereRadius", 100.0))
        return solve_sphere_grid_mgal(receivers, center, radius, density)
    if base_model == "Ellipsoid":
        return solve_ellipsoid_grid_mgal(
            receivers,
            center,
            float(data.get("ellipsoidA", 100.0)),
            float(data.get("ellipsoidB", 100.0)),
            float(data.get("ellipsoidC", 150.0)),
            density,
        )
    if base_model == "Vertical Cylinder":
        return solve_vertical_cylinder_grid_mgal(
            receivers,
            center,
            float(data.get("verticalCylinderRadius", 50.0)),
            float(data.get("verticalCylinderHeight", 100.0)),
            density,
        )
    return solve_horizontal_cylinder_grid_mgal(
        receivers,
        center,
        float(data.get("horizontalCylinderRadius", 50.0)),
        float(data.get("horizontalCylinderLength", 100.0)),
        density,
    )
