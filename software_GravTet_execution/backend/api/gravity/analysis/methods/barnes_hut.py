"""Barnes–Hut analysis vs analytical closed-form reference."""

from __future__ import annotations

import logging
import time

from ...forward_methods.barnes_hut.compute import run_barnes_hut_from_request
from ...mesh.mesh_route_utils import prepare_forward_tetra_mesh_input, has_mesh_payload, is_gmsh_build_request, is_tetrahedral_catalog_request
from ...shared.helpers import create_tetra_mesh_input
from ..shared.compare import align_reference_to_grid, finalize_analysis, resolve_cached_candidate, try_finalize_with_cached_candidate
from ..shared.reference import compute_analytical_reference

METHOD = "barnes_hut"


def require_libs(libs) -> None:
    if not libs.barnes_hut:
        raise RuntimeError("Barnes–Hut library not loaded")


def run_analysis(libs, data: dict, logger: logging.Logger) -> dict:
    require_libs(libs)
    reference, reference_compute_ms = compute_analytical_reference(data)
    ref_nx = int(data.get("numReceiversX", 100))
    ref_ny = int(data.get("numReceiversY", 100))
    cached, cmp_nx, cmp_ny = resolve_cached_candidate(data)
    if cached is not None and cmp_nx is not None and cmp_ny is not None:
        reference = align_reference_to_grid(reference, ref_nx, ref_ny, cmp_nx, cmp_ny)
        return finalize_analysis(
            analysis_method=METHOD,
            data=data,
            reference=reference,
            reference_compute_ms=reference_compute_ms,
            candidate=cached,
            candidate_compute_ms=0.0,
            grid_nx=cmp_nx,
            grid_ny=cmp_ny,
        )

    theta0 = float(data.get("theta0", 0.5))
    t0 = time.perf_counter()
    run = run_barnes_hut_from_request(libs, data, theta0=theta0, logger=logger)
    candidate_compute_ms = (time.perf_counter() - t0) * 1000.0
    return finalize_analysis(
        analysis_method=METHOD,
        data=data,
        reference=reference,
        reference_compute_ms=reference_compute_ms,
        candidate=run.results,
        candidate_compute_ms=candidate_compute_ms,
        grid_nx=run.num_receivers_x,
        grid_ny=run.num_receivers_y,
    )


def run_mesh_analysis(libs, data: dict, logger: logging.Logger) -> dict:
    require_libs(libs)
    reference, reference_compute_ms = compute_analytical_reference(data)
    ref_nx = int(data.get("numReceiversX", 100))
    ref_ny = int(data.get("numReceiversY", 100))
    cached_result = try_finalize_with_cached_candidate(
        analysis_method=METHOD,
        data=data,
        reference=reference,
        reference_compute_ms=reference_compute_ms,
        ref_nx=ref_nx,
        ref_ny=ref_ny,
    )
    if cached_result is not None:
        return cached_result
    mesh_params, _node_arr, _elem_arr, _gmsh_build_meta = prepare_forward_tetra_mesh_input(data, logger)
    ref_nx = int(data.get("numReceiversX", mesh_params.num_receivers_x))
    ref_ny = int(data.get("numReceiversY", mesh_params.num_receivers_y))
    theta0 = float(data.get("theta0", 0.5))
    t0 = time.perf_counter()
    run = run_barnes_hut_from_request(libs, data, theta0=theta0, logger=logger)
    candidate_compute_ms = (time.perf_counter() - t0) * 1000.0
    grid_nx = run.num_receivers_x
    grid_ny = run.num_receivers_y
    if grid_nx != ref_nx or grid_ny != ref_ny:
        reference = align_reference_to_grid(reference, ref_nx, ref_ny, grid_nx, grid_ny)
    return finalize_analysis(
        analysis_method=METHOD,
        data=data,
        reference=reference,
        reference_compute_ms=reference_compute_ms,
        candidate=run.results,
        candidate_compute_ms=candidate_compute_ms,
        grid_nx=grid_nx,
        grid_ny=grid_ny,
    )


def dispatch(libs, data: dict, logger: logging.Logger) -> dict:
    cached, _, _ = resolve_cached_candidate(data)
    if cached is not None:
        return run_analysis(libs, data, logger)
    mesh_like = has_mesh_payload(data) or is_gmsh_build_request(data) or is_tetrahedral_catalog_request(data)
    if mesh_like:
        return run_mesh_analysis(libs, data, logger)
    return run_analysis(libs, data, logger)
