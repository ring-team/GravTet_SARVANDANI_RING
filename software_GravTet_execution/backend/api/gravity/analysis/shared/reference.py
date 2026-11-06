"""Closed-form analytical reference for forward-method analysis."""

from __future__ import annotations

import time

from gravity.forward_methods.analytical_closedform.dispatcher import (
    ANALYTICAL_SUPPORTED_BASE_MODELS,
    _base_model_type,
    solve_analytical_closedform,
)

ANALYSIS_REFERENCE_UNSUPPORTED_MSG = (
    "Forward modeling analysis uses analytical closed-form as the reference. "
    "Supported shapes: Cube, Cuboid, Sphere, Ellipsoid, Vertical Cylinder, and Horizontal Cylinder. "
    "4 Cubes, Faulted Block Model, and Valley-Mountain Model have no closed-form solution."
)


def require_closed_form_reference(data: dict) -> None:
    base = _base_model_type(str(data.get("modelType", "") or ""))
    if base not in ANALYTICAL_SUPPORTED_BASE_MODELS:
        raise ValueError(ANALYSIS_REFERENCE_UNSUPPORTED_MSG)


def validate_burial_center_consistency(data: dict) -> None:
    """Reject analysis when burial ``h`` and ``centerZ`` disagree (stale map vs new depth)."""
    if data.get("h") is None or data.get("centerZ") is None:
        return
    base = _base_model_type(str(data.get("modelType", "") or ""))
    if base not in {"Cube", "Rectangular Prism (Cuboid)"}:
        return
    h = float(data.get("h"))
    center_z = float(data.get("centerZ"))
    size_z = float(data.get("cubeZ", 100.0))
    expected = -h - 0.5 * size_z
    if abs(center_z - expected) > 0.5:
        raise ValueError(
            f"Burial depth mismatch: centerZ={center_z:.2f} m does not match h={h:.2f} m and "
            f"cubeZ={size_z:.2f} m (expected centerZ≈{expected:.2f} m). "
            "Click Calculate Gravity after changing burial depth, then run analysis again."
        )


def compute_analytical_reference(data: dict) -> tuple[list[float], float]:
    require_closed_form_reference(data)
    t_ref = time.perf_counter()
    reference = solve_analytical_closedform(data)
    reference_compute_ms = (time.perf_counter() - t_ref) * 1000.0
    return reference, reference_compute_ms
