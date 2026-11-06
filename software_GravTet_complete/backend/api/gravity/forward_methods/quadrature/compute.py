"""Quadrature second-order forward invocation helpers."""

from __future__ import annotations

import ctypes
import time
from dataclasses import dataclass
from typing import Any

from ...mesh.mesh_route_utils import prepare_forward_tetra_mesh_input
from ...shared.helpers import create_quadrature_model_params
from ...shared.routes_misc import quadrature_simd_capabilities
from werkzeug.exceptions import BadRequest


@dataclass(frozen=True)
class QuadratureRunResult:
    results: list[float]
    compute_ms: float
    num_receivers_x: int
    num_receivers_y: int
    num_sources: int
    input_mode: str
    execution_mode: int | None = None
    num_threads: int | None = None
    total_ms: float | None = None
    gmsh_build_meta: dict[str, Any] | None = None


def validate_simd_lanes(library, params):
    if int(params.execution_mode) not in (1, 2):
        return
    width = int(params.simd_lanes)
    if width and width not in quadrature_simd_capabilities(library)["available_lanes"]:
        raise BadRequest(f"SIMD lane width {width} is not supported by this server")


def run_quadrature_from_request(libs, data: dict) -> QuadratureRunResult:
    """Run quadrature for a synthetic/catalog model payload."""
    if libs.quadrature_second_order is None:
        raise RuntimeError("Quadrature second-order library not loaded")

    params = create_quadrature_model_params(data)
    validate_simd_lanes(libs.quadrature_second_order, params)
    result_size = ctypes.c_int(0)
    t0 = time.perf_counter()
    result_ptr = libs.quadrature_second_order.forward_gravity_quadrature_model(
        ctypes.byref(params), ctypes.byref(result_size)
    )
    compute_ms = (time.perf_counter() - t0) * 1000.0
    if result_ptr is None or result_size.value == 0:
        raise RuntimeError("Quadrature second-order returned no results")
    results = [result_ptr[i] for i in range(result_size.value)]
    libs.quadrature_second_order.free_quadrature_result(result_ptr)
    return QuadratureRunResult(
        results=results,
        compute_ms=compute_ms,
        num_receivers_x=int(params.num_receivers_x),
        num_receivers_y=int(params.num_receivers_y),
        num_sources=int(params.num_sources_x) * int(params.num_sources_y) * int(params.num_sources_z),
        input_mode="synthetic_legacy",
        execution_mode=int(params.execution_mode),
        num_threads=int(params.num_threads),
    )


def run_quadrature_mesh_from_request(libs, data: dict, logger=None) -> QuadratureRunResult:
    """Run quadrature for a tetra mesh or tetrahedral catalog request."""
    total_start = time.perf_counter()
    params, node_arr, elem_arr, gmsh_build_meta = prepare_forward_tetra_mesh_input(data, logger)
    return run_quadrature_mesh_from_params(
        libs,
        params,
        node_arr,
        elem_arr,
        gmsh_build_meta=gmsh_build_meta,
        total_start=total_start,
    )


def run_quadrature_mesh_from_params(
    libs,
    params,
    node_arr,
    elem_arr,
    *,
    gmsh_build_meta: dict[str, Any] | None = None,
    total_start: float | None = None,
) -> QuadratureRunResult:
    """Run quadrature using an already-built ``TetraMeshInput``."""
    if libs.quadrature_second_order is None:
        raise RuntimeError("Quadrature second-order library not loaded")
    if not hasattr(libs.quadrature_second_order, "forward_gravity_tetra_mesh_quadrature"):
        raise RuntimeError("Quadrature mesh entrypoint is not available")

    validate_simd_lanes(libs.quadrature_second_order, params)
    result_size = ctypes.c_int(0)
    mesh_keepalive = (node_arr, elem_arr)
    t0 = time.perf_counter()
    result_ptr = libs.quadrature_second_order.forward_gravity_tetra_mesh_quadrature(
        ctypes.byref(params), ctypes.byref(result_size)
    )
    compute_ms = (time.perf_counter() - t0) * 1000.0
    del mesh_keepalive
    if result_ptr is None or result_size.value == 0:
        raise RuntimeError("Quadrature mesh calculation returned no results")
    results = [result_ptr[i] for i in range(result_size.value)]
    libs.quadrature_second_order.free_quadrature_result(result_ptr)
    return QuadratureRunResult(
        results=results,
        compute_ms=compute_ms,
        num_receivers_x=int(params.num_receivers_x),
        num_receivers_y=int(params.num_receivers_y),
        num_sources=int(params.num_elements),
        input_mode="tetra_mesh",
        execution_mode=int(params.execution_mode),
        num_threads=int(params.num_threads),
        total_ms=(time.perf_counter() - total_start) * 1000.0 if total_start is not None else None,
        gmsh_build_meta=gmsh_build_meta,
    )
