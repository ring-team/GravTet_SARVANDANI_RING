"""AMFM forward invocation helpers."""

from __future__ import annotations

import ctypes
import time
from dataclasses import dataclass

from ...mesh.mesh_route_utils import prepare_forward_tetra_mesh_input
from ...mesh.mesh_tet_source_arrays import tet_mesh_receiver_arrays, tet_mesh_source_arrays
from ...sources.synthetic_source_generation import (
    free_generated_sources_and_receivers,
    generate_sources_and_receivers_for_model,
    require_source_generation_lib,
)
from .ffi import AMFMParams
from ...shared.helpers import create_model_params, create_tetra_mesh_input, estimate_sources_and_receivers


@dataclass(frozen=True)
class AmfmRunResult:
    results: list[float]
    compute_ms: float
    num_receivers_x: int
    num_receivers_y: int
    num_sources: int
    input_mode: str
    critical_distance_requested: float
    critical_distance_effective: float
    max_depth_requested: int
    max_depth_effective: int
    max_sources_per_node_requested: int
    max_sources_per_node_effective: int
    prism_tuning: bool


def _effective_tree_params(data: dict) -> tuple[float, float, int, int, int, int, bool]:
    cd_requested = float(data.get("criticalDistanceFactor", 2.5))
    md_requested = int(data.get("maxDepth", 10))
    msn_requested = int(data.get("maxSourcesPerNode", 256))
    cd, md, msn = cd_requested, md_requested, msn_requested
    model_label = str(data.get("modelType", "") or "")
    prism = "Rectangular Prism" in model_label
    if prism:
        cd = max(cd, 3.5)
        md = max(md, 12)
        msn = min(msn, 128)
    return cd_requested, cd, md_requested, md, msn_requested, msn, prism


def _compute_amfm(libs, params: AMFMParams) -> tuple[list[float], float]:
    if libs.amfm is None:
        raise RuntimeError("AMFM library not loaded")
    result_size = ctypes.c_int(0)
    t0 = time.perf_counter()
    result_ptr = libs.amfm.amfm_compute_gravity(ctypes.byref(params), ctypes.byref(result_size))
    compute_ms = (time.perf_counter() - t0) * 1000.0
    if result_ptr is None or result_size.value == 0:
        raise RuntimeError("AMFM calculation returned no results")
    results = [result_ptr[i] for i in range(result_size.value)]
    libs.amfm.amfm_free_result(result_ptr)
    return results, compute_ms


def _result_to_list_and_free(libs, result_ptr, result_size: ctypes.c_int) -> list[float]:
    if result_ptr is None or result_size.value == 0:
        raise RuntimeError("AMFM calculation returned no results")
    results = [result_ptr[i] for i in range(result_size.value)]
    libs.amfm.amfm_free_result(result_ptr)
    return results


def run_amfm_from_request(libs, data: dict) -> AmfmRunResult:
    """Run AMFM for a synthetic/catalog model request."""
    if libs.amfm is None:
        raise RuntimeError("AMFM library not loaded")

    model_params = create_model_params(data)
    cd_req, cd, md_req, md, msn_req, msn, prism = _effective_tree_params(data)
    if hasattr(libs.amfm, "amfm_forward_gravity_model"):
        result_size = ctypes.c_int(0)
        t0 = time.perf_counter()
        result_ptr = libs.amfm.amfm_forward_gravity_model(
            ctypes.byref(model_params),
            ctypes.c_double(cd),
            ctypes.c_int(md),
            ctypes.c_int(msn),
            ctypes.byref(result_size),
        )
        compute_ms = (time.perf_counter() - t0) * 1000.0
        results = _result_to_list_and_free(libs, result_ptr, result_size)
        n_src_est, _ = estimate_sources_and_receivers(data)
        return AmfmRunResult(
            results=results,
            compute_ms=compute_ms,
            num_receivers_x=int(model_params.num_receivers_x),
            num_receivers_y=int(model_params.num_receivers_y),
            num_sources=n_src_est,
            input_mode="synthetic_legacy",
            critical_distance_requested=cd_req,
            critical_distance_effective=cd,
            max_depth_requested=md_req,
            max_depth_effective=md,
            max_sources_per_node_requested=msn_req,
            max_sources_per_node_effective=msn,
            prism_tuning=prism,
        )

    require_source_generation_lib(libs)
    generated = generate_sources_and_receivers_for_model(libs, model_params)
    sources = generated.sources
    receivers = generated.receivers
    params = AMFMParams()
    params.source_x = sources.x
    params.source_y = sources.y
    params.source_z = sources.z
    params.source_density = sources.density
    params.source_volume = sources.volume
    params.num_sources = sources.size
    params.receiver_x = receivers.x
    params.receiver_y = receivers.y
    params.receiver_z = receivers.z
    params.num_receivers = receivers.size
    params.critical_distance_factor = cd
    params.max_depth = md
    params.max_sources_per_node = msn
    try:
        results, compute_ms = _compute_amfm(libs, params)
    finally:
        free_generated_sources_and_receivers(libs, generated)

    return AmfmRunResult(
        results=results,
        compute_ms=compute_ms,
        num_receivers_x=int(model_params.num_receivers_x),
        num_receivers_y=int(model_params.num_receivers_y),
        num_sources=int(sources.size),
        input_mode="synthetic_legacy",
        critical_distance_requested=cd_req,
        critical_distance_effective=cd,
        max_depth_requested=md_req,
        max_depth_effective=md,
        max_sources_per_node_requested=msn_req,
        max_sources_per_node_effective=msn,
        prism_tuning=prism,
    )


def run_amfm_mesh_from_request(libs, data: dict, logger=None) -> AmfmRunResult:
    """Run AMFM for a tetra mesh or tetrahedral catalog request."""
    mesh_params, node_arr, elem_arr, _gmsh_build_meta = prepare_forward_tetra_mesh_input(data, logger)
    return run_amfm_mesh_from_params(libs, data, mesh_params, node_arr=node_arr, elem_arr=elem_arr)


def run_amfm_mesh_from_params(libs, data: dict, mesh_params, *, node_arr=None, elem_arr=None) -> AmfmRunResult:
    """Run AMFM using an already-built ``TetraMeshInput``."""
    if libs.amfm is None:
        raise RuntimeError("AMFM library not loaded")
    cd_req, cd, md_req, md, msn_req, msn, prism = _effective_tree_params(data)

    if hasattr(libs.amfm, "amfm_forward_gravity_tetra_mesh"):
        result_size = ctypes.c_int(0)
        mesh_keepalive = (node_arr, elem_arr)
        t0 = time.perf_counter()
        result_ptr = libs.amfm.amfm_forward_gravity_tetra_mesh(
            ctypes.byref(mesh_params),
            ctypes.c_double(cd),
            ctypes.c_int(md),
            ctypes.c_int(msn),
            ctypes.byref(result_size),
        )
        compute_ms = (time.perf_counter() - t0) * 1000.0
        del mesh_keepalive
        results = _result_to_list_and_free(libs, result_ptr, result_size)
        return AmfmRunResult(
            results=results,
            compute_ms=compute_ms,
            num_receivers_x=int(mesh_params.num_receivers_x),
            num_receivers_y=int(mesh_params.num_receivers_y),
            num_sources=int(mesh_params.num_elements),
            input_mode="tetra_mesh",
            critical_distance_requested=cd_req,
            critical_distance_effective=cd,
            max_depth_requested=md_req,
            max_depth_effective=md,
            max_sources_per_node_requested=msn_req,
            max_sources_per_node_effective=msn,
            prism_tuning=prism,
        )

    src_x, src_y, src_z, src_density, src_volume = tet_mesh_source_arrays(mesh_params)
    rec_x, rec_y, rec_z = tet_mesh_receiver_arrays(mesh_params)
    n_src = int(mesh_params.num_elements)
    n_rec = int(mesh_params.num_receivers_x) * int(mesh_params.num_receivers_y)

    params = AMFMParams()
    params.source_x = src_x
    params.source_y = src_y
    params.source_z = src_z
    params.source_density = src_density
    params.source_volume = src_volume
    params.num_sources = n_src
    params.receiver_x = rec_x
    params.receiver_y = rec_y
    params.receiver_z = rec_z
    params.num_receivers = n_rec
    params.critical_distance_factor = cd
    params.max_depth = md
    params.max_sources_per_node = msn

    results, compute_ms = _compute_amfm(libs, params)
    return AmfmRunResult(
        results=results,
        compute_ms=compute_ms,
        num_receivers_x=int(mesh_params.num_receivers_x),
        num_receivers_y=int(mesh_params.num_receivers_y),
        num_sources=n_src,
        input_mode="tetra_mesh",
        critical_distance_requested=cd_req,
        critical_distance_effective=cd,
        max_depth_requested=md_req,
        max_depth_effective=md,
        max_sources_per_node_requested=msn_req,
        max_sources_per_node_effective=msn,
        prism_tuning=prism,
    )
