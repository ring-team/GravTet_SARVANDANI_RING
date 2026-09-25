"""Barnes–Hut forward invocation (ModelParams / TetraMeshInput, same as other solvers)."""

from __future__ import annotations

import ctypes
from dataclasses import dataclass
from typing import Any

from ...mesh.mesh_route_utils import prepare_forward_tetra_mesh_input, has_mesh_payload, is_tetrahedral_catalog_request
from ...shared.constants import MAX_APPROXIMATE_METHOD_LOG_SCALED_INTERACTIONS, MAX_BARNES_HUT_RECEIVERS
from ...shared.helpers import create_model_params, create_tetra_mesh_input, estimate_sources_and_receivers, log_scaled_interaction_measure


@dataclass(frozen=True)
class BarnesHutRunResult:
    results: list[float]
    num_receivers_x: int
    num_receivers_y: int
    num_sources: int
    input_mode: str
    gmsh_build_meta: dict[str, Any] | None = None


def estimate_barnes_hut_workload(data: dict, libs, logger) -> tuple[int, int, str, dict[str, Any] | None]:
    """Rough source/receiver counts for early validation (never builds a Gmsh mesh)."""
    mesh_like = has_mesh_payload(data) or is_tetrahedral_catalog_request(data)
    if mesh_like and has_mesh_payload(data):
        mesh_params, _node_arr, _elem_arr = create_tetra_mesh_input(data)
        n_src = int(mesh_params.num_elements)
        n_rec = int(mesh_params.num_receivers_x) * int(mesh_params.num_receivers_y)
        return n_src, n_rec, "tetra_mesh", None
    n_src, n_rec = estimate_sources_and_receivers(data)
    input_mode = "tetra_mesh" if mesh_like else "synthetic_legacy"
    return n_src, n_rec, input_mode, None


def run_barnes_hut_from_request(
    libs,
    data: dict,
    *,
    theta0: float,
    logger,
    mesh_input: tuple | None = None,
) -> BarnesHutRunResult:
    """Dispatch Barnes–Hut using native model/mesh entry points when available."""
    if not libs.barnes_hut:
        raise RuntimeError("Barnes–Hut library not loaded")

    mesh_like = has_mesh_payload(data) or is_tetrahedral_catalog_request(data)
    gmsh_build_meta = None
    if mesh_like:
        if mesh_input is None:
            mesh_params, node_arr, elem_arr, gmsh_build_meta = prepare_forward_tetra_mesh_input(data, logger)
        else:
            mesh_params, node_arr, elem_arr, gmsh_build_meta = mesh_input
        n_src = int(mesh_params.num_elements)
        n_rec = int(mesh_params.num_receivers_x) * int(mesh_params.num_receivers_y)
        if n_rec > MAX_BARNES_HUT_RECEIVERS:
            raise ValueError(
                f"Too many observation points for Barnes–Hut ({n_rec:,}). "
                f"Current safety cap is {MAX_BARNES_HUT_RECEIVERS:,}."
            )
        raw_pairs = n_src * n_rec
        eff = log_scaled_interaction_measure(n_src, n_rec)
        if eff > MAX_APPROXIMATE_METHOD_LOG_SCALED_INTERACTIONS:
            raise ValueError(
                f"Too many log-scaled source–receiver workload units for Barnes–Hut "
                f"(effective N·M/log₂N = {eff:,}; raw N·M = {raw_pairs:,}). "
                f"Current safety cap is {MAX_APPROXIMATE_METHOD_LOG_SCALED_INTERACTIONS:,}. "
                "Reduce mesh resolution or the observation grid."
            )
        result_size = ctypes.c_int(0)
        if hasattr(libs.barnes_hut, "barnes_hut_forward_gravity_tetra_mesh"):
            _mesh_keepalive = (node_arr, elem_arr)
            result_ptr = libs.barnes_hut.barnes_hut_forward_gravity_tetra_mesh(
                ctypes.byref(mesh_params),
                ctypes.c_double(theta0),
                ctypes.byref(result_size),
            )
        else:
            _mesh_keepalive = None
            raise RuntimeError("barnes_hut_forward_gravity_tetra_mesh is not available in the loaded native library")
        if result_ptr is None or result_size.value <= 0:
            raise RuntimeError("Barnes–Hut mesh calculation returned no results")
        results = [result_ptr[i] for i in range(result_size.value)]
        libs.barnes_hut.barnes_hut_free_result(result_ptr)
        if _mesh_keepalive is not None:
            del _mesh_keepalive
        return BarnesHutRunResult(
            results=results,
            num_receivers_x=int(mesh_params.num_receivers_x),
            num_receivers_y=int(mesh_params.num_receivers_y),
            num_sources=int(mesh_params.num_elements),
            input_mode="tetra_mesh",
            gmsh_build_meta=gmsh_build_meta,
        )

    params = create_model_params(data)
    result_size = ctypes.c_int(0)
    if hasattr(libs.barnes_hut, "barnes_hut_forward_gravity_model"):
        result_ptr = libs.barnes_hut.barnes_hut_forward_gravity_model(
            ctypes.byref(params),
            ctypes.c_double(theta0),
            ctypes.byref(result_size),
        )
    else:
        raise RuntimeError("barnes_hut_forward_gravity_model is not available in the loaded native library")
    if result_ptr is None or result_size.value <= 0:
        raise RuntimeError("Barnes–Hut calculation returned no results")
    results = [result_ptr[i] for i in range(result_size.value)]
    libs.barnes_hut.barnes_hut_free_result(result_ptr)
    n_src_est, _ = estimate_sources_and_receivers(data)
    return BarnesHutRunResult(
        results=results,
        num_receivers_x=int(params.num_receivers_x),
        num_receivers_y=int(params.num_receivers_y),
        num_sources=n_src_est,
        input_mode="synthetic_legacy",
        gmsh_build_meta=None,
    )
