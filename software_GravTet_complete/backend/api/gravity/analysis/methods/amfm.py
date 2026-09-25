"""AMFM analysis vs analytical closed-form reference."""

from __future__ import annotations

import logging

from ...forward_methods.amfm.compute import run_amfm_from_request, run_amfm_mesh_from_request
from ...mesh.mesh_route_utils import has_mesh_payload, is_gmsh_build_request, is_tetrahedral_catalog_request
from ..shared.compare import align_reference_to_grid, finalize_analysis, resolve_cached_candidate, try_finalize_with_cached_candidate
from ..shared.reference import compute_analytical_reference

METHOD = "amfm"


def require_libs(libs, *, mesh_like: bool) -> None:
    if not libs.amfm:
        raise RuntimeError("AMFM library not loaded")


def run_analysis(libs, data: dict, logger: logging.Logger) -> dict:
    require_libs(libs, mesh_like=False)
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

    run = run_amfm_from_request(libs, data)
    return finalize_analysis(
        analysis_method=METHOD,
        data=data,
        reference=reference,
        reference_compute_ms=reference_compute_ms,
        candidate=run.results,
        candidate_compute_ms=run.compute_ms,
        grid_nx=run.num_receivers_x,
        grid_ny=run.num_receivers_y,
    )


def run_mesh_analysis(libs, data: dict, logger: logging.Logger) -> dict:
    require_libs(libs, mesh_like=True)
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
    run = run_amfm_mesh_from_request(libs, data, logger)
    if run.num_receivers_x != ref_nx or run.num_receivers_y != ref_ny:
        reference = align_reference_to_grid(reference, ref_nx, ref_ny, run.num_receivers_x, run.num_receivers_y)
    return finalize_analysis(
        analysis_method=METHOD,
        data=data,
        reference=reference,
        reference_compute_ms=reference_compute_ms,
        candidate=run.results,
        candidate_compute_ms=run.compute_ms,
        grid_nx=run.num_receivers_x,
        grid_ny=run.num_receivers_y,
    )


def dispatch(libs, data: dict, logger: logging.Logger) -> dict:
    cached, _, _ = resolve_cached_candidate(data)
    mesh_like = has_mesh_payload(data) or is_gmsh_build_request(data) or is_tetrahedral_catalog_request(data)
    if cached is not None:
        return run_analysis(libs, data, logger)
    require_libs(libs, mesh_like=mesh_like)
    if mesh_like:
        return run_mesh_analysis(libs, data, logger)
    return run_analysis(libs, data, logger)
