"""Direct Newton forward invocation helpers.

Routes and analysis both call this module so Direct Newton has one Python FFI
execution path.
"""

from __future__ import annotations

import ctypes
import time
from dataclasses import dataclass
from typing import Any

from ...mesh.mesh_route_utils import prepare_forward_tetra_mesh_input
from ...shared.helpers import create_model_params, estimate_sources_and_receivers


@dataclass(frozen=True)
class DirectRunResult:
    results: list[float]
    compute_ms: float
    num_receivers_x: int
    num_receivers_y: int
    num_sources: int
    input_mode: str
    total_ms: float | None = None
    gmsh_build_meta: dict[str, Any] | None = None


def run_direct_from_request(libs, data: dict) -> DirectRunResult:
    """Run Direct Newton for a synthetic/catalog model request."""
    if not libs.direct_newton:
        raise RuntimeError("Direct Newton library not loaded")

    total_start = time.perf_counter()
    params = create_model_params(data)
    n_src_est, _ = estimate_sources_and_receivers(data)

    result_size = ctypes.c_int(0)
    t0 = time.perf_counter()
    result_ptr = libs.direct_newton.forward_gravity_model(ctypes.byref(params), ctypes.byref(result_size))
    compute_ms = (time.perf_counter() - t0) * 1000.0
    if result_ptr is None or result_size.value == 0:
        raise RuntimeError("Direct Newton calculation returned no results")
    results = [result_ptr[i] for i in range(result_size.value)]
    libs.direct_newton.free_gravity_result(result_ptr)

    return DirectRunResult(
        results=results,
        compute_ms=compute_ms,
        num_receivers_x=int(params.num_receivers_x),
        num_receivers_y=int(params.num_receivers_y),
        num_sources=n_src_est,
        input_mode="synthetic_legacy",
        total_ms=(time.perf_counter() - total_start) * 1000.0,
    )


def run_direct_mesh_from_request(libs, data: dict, logger=None) -> DirectRunResult:
    """Run Direct Newton for a tetra mesh or tetrahedral catalog request."""
    total_start = time.perf_counter()
    params, node_arr, elem_arr, gmsh_build_meta = prepare_forward_tetra_mesh_input(data, logger)
    return run_direct_mesh_from_params(
        libs,
        params,
        node_arr,
        elem_arr,
        gmsh_build_meta=gmsh_build_meta,
        total_start=total_start,
    )


def run_direct_mesh_from_params(
    libs,
    params,
    node_arr,
    elem_arr,
    *,
    gmsh_build_meta: dict[str, Any] | None = None,
    total_start: float | None = None,
) -> DirectRunResult:
    """Run Direct Newton using an already-built ``TetraMeshInput``."""
    if not libs.direct_newton:
        raise RuntimeError("Direct Newton library not loaded")
    if not getattr(libs, "direct_newton_mesh_forward", False):
        raise RuntimeError(
            "Direct Newton mesh entrypoint is not available. "
            "Rebuild native libs (backend/build_system/build.sh) and restart the API."
        )

    result_size = ctypes.c_int(0)
    mesh_keepalive = (node_arr, elem_arr)
    t0 = time.perf_counter()
    result_ptr = libs.direct_newton.forward_gravity_tetra_mesh_direct(
        ctypes.byref(params), ctypes.byref(result_size)
    )
    compute_ms = (time.perf_counter() - t0) * 1000.0
    del mesh_keepalive
    if result_ptr is None or result_size.value == 0:
        raise RuntimeError(
            "Direct Newton mesh calculation returned no results "
            f"({int(params.num_elements):,} tets, "
            f"{int(params.num_receivers_x) * int(params.num_receivers_y):,} receivers)."
        )
    results = [result_ptr[i] for i in range(result_size.value)]
    libs.direct_newton.free_gravity_result(result_ptr)

    return DirectRunResult(
        results=results,
        compute_ms=compute_ms,
        num_receivers_x=int(params.num_receivers_x),
        num_receivers_y=int(params.num_receivers_y),
        num_sources=int(params.num_elements),
        input_mode="tetra_mesh",
        total_ms=(time.perf_counter() - total_start) * 1000.0 if total_start is not None else None,
        gmsh_build_meta=gmsh_build_meta,
    )
