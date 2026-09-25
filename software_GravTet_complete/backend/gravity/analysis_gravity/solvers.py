"""Forward solver wrappers used by analysis service."""

import ctypes
import time

from api.gravity.forward_methods.amfm.ffi import AMFMParams
from api.gravity.mesh.mesh_tet_source_arrays import tet_mesh_receiver_arrays, tet_mesh_source_arrays
from api.gravity.sources.synthetic_source_generation import (
    free_generated_sources_and_receivers,
    generate_sources_and_receivers_for_model,
)


def _to_list(ptr, size):
    return [ptr[i] for i in range(size)]


def compute_direct_newton(libs, params):
    result_size = ctypes.c_int(0)
    t0 = time.perf_counter()
    result_ptr = libs.direct_newton.forward_gravity_model(ctypes.byref(params), ctypes.byref(result_size))
    compute_ms = (time.perf_counter() - t0) * 1000.0
    if result_ptr is None or result_size.value == 0:
        raise RuntimeError("Direct Newton returned no results")
    results = _to_list(result_ptr, result_size.value)
    libs.direct_newton.free_gravity_result(result_ptr)
    return results, compute_ms


def _build_sources_receivers(libs, params):
    generated = generate_sources_and_receivers_for_model(libs, params)
    return generated.sources_ptr, generated.receivers_ptr, generated


def compute_barnes_hut(libs, params, data):
    theta0 = float(data.get("theta0", 0.5))
    model_label = str(data.get("modelType", "") or "")
    if "Rectangular Prism" in model_label:
        theta0 = min(theta0, 0.18)

    sources_ptr, receivers_ptr, generated = _build_sources_receivers(libs, params)
    sources = sources_ptr.contents
    receivers = receivers_ptr.contents
    result_size = ctypes.c_int(0)
    try:
        t0 = time.perf_counter()
        result_ptr = libs.barnes_hut.barnes_hut_compute_gravity(
            sources.x,
            sources.y,
            sources.z,
            sources.density,
            sources.volume,
            ctypes.c_int(sources.size),
            receivers.x,
            receivers.y,
            receivers.z,
            ctypes.c_int(receivers.size),
            ctypes.c_double(theta0),
            ctypes.byref(result_size),
        )
        compute_ms = (time.perf_counter() - t0) * 1000.0
        if result_ptr is None or result_size.value == 0:
            raise RuntimeError("Barnes-Hut returned no results")
        results = _to_list(result_ptr, result_size.value)
        libs.barnes_hut.barnes_hut_free_result(result_ptr)
        return results, compute_ms
    finally:
        free_generated_sources_and_receivers(libs, generated)


def compute_amfm(libs, params, data):
    sources_ptr, receivers_ptr, generated = _build_sources_receivers(libs, params)
    sources = sources_ptr.contents
    receivers = receivers_ptr.contents

    amfm_params = AMFMParams()
    amfm_params.source_x = sources.x
    amfm_params.source_y = sources.y
    amfm_params.source_z = sources.z
    amfm_params.source_density = sources.density
    amfm_params.source_volume = sources.volume
    amfm_params.num_sources = sources.size
    amfm_params.receiver_x = receivers.x
    amfm_params.receiver_y = receivers.y
    amfm_params.receiver_z = receivers.z
    amfm_params.num_receivers = receivers.size

    cd = float(data.get("criticalDistanceFactor", 2.5))
    md = int(data.get("maxDepth", 10))
    msn = int(data.get("maxSourcesPerNode", 256))
    model_label = str(data.get("modelType", "") or "")
    if "Rectangular Prism" in model_label:
        cd = max(cd, 3.5)
        md = max(md, 12)
        msn = min(msn, 128)
    amfm_params.critical_distance_factor = cd
    amfm_params.max_depth = md
    amfm_params.max_sources_per_node = msn

    result_size = ctypes.c_int(0)
    try:
        t0 = time.perf_counter()
        result_ptr = libs.amfm.amfm_compute_gravity(ctypes.byref(amfm_params), ctypes.byref(result_size))
        compute_ms = (time.perf_counter() - t0) * 1000.0
        if result_ptr is None or result_size.value == 0:
            raise RuntimeError("AMFM returned no results")
        results = _to_list(result_ptr, result_size.value)
        libs.amfm.amfm_free_result(result_ptr)
        return results, compute_ms
    finally:
        free_generated_sources_and_receivers(libs, generated)


def compute_quadrature(libs, quadrature_params):
    if libs.quadrature_second_order is None:
        raise RuntimeError("Quadrature second-order library not loaded")
    result_size = ctypes.c_int(0)
    t0 = time.perf_counter()
    result_ptr = libs.quadrature_second_order.forward_gravity_quadrature_model(
        ctypes.byref(quadrature_params), ctypes.byref(result_size)
    )
    compute_ms = (time.perf_counter() - t0) * 1000.0
    if result_ptr is None or result_size.value == 0:
        raise RuntimeError("Quadrature second-order returned no results")
    results = _to_list(result_ptr, result_size.value)
    libs.quadrature_second_order.free_quadrature_result(result_ptr)
    return results, compute_ms


def compute_direct_newton_mesh(libs, mesh_params):
    if not getattr(libs, "direct_newton_mesh_forward", False):
        raise RuntimeError(
            "Direct Newton mesh entrypoint is not available. "
            "Rebuild native libs (backend/build_system/build.sh) and restart the API."
        )
    result_size = ctypes.c_int(0)
    t0 = time.perf_counter()
    result_ptr = libs.direct_newton.forward_gravity_tetra_mesh_direct(
        ctypes.byref(mesh_params), ctypes.byref(result_size)
    )
    compute_ms = (time.perf_counter() - t0) * 1000.0
    if result_ptr is None or result_size.value == 0:
        raise RuntimeError("Direct Newton mesh solver returned no results")
    results = _to_list(result_ptr, result_size.value)
    libs.direct_newton.free_gravity_result(result_ptr)
    return results, compute_ms


def compute_barnes_hut_mesh(libs, mesh_params, data):
    if libs.barnes_hut is None:
        raise RuntimeError("Barnes–Hut library not loaded")
    theta0 = float(data.get("theta0", 0.5))
    model_label = str(data.get("modelType", "") or "")
    if "Rectangular Prism" in model_label:
        theta0 = min(theta0, 0.18)
    src_x, src_y, src_z, src_density, src_volume = tet_mesh_source_arrays(mesh_params)
    rec_x, rec_y, rec_z = tet_mesh_receiver_arrays(mesh_params)
    n_src = int(mesh_params.num_elements)
    n_rec = int(mesh_params.num_receivers_x) * int(mesh_params.num_receivers_y)
    result_size = ctypes.c_int(0)
    t0 = time.perf_counter()
    result_ptr = libs.barnes_hut.barnes_hut_compute_gravity(
        src_x,
        src_y,
        src_z,
        src_density,
        src_volume,
        ctypes.c_int(n_src),
        rec_x,
        rec_y,
        rec_z,
        ctypes.c_int(n_rec),
        ctypes.c_double(theta0),
        ctypes.byref(result_size),
    )
    compute_ms = (time.perf_counter() - t0) * 1000.0
    if result_ptr is None or result_size.value == 0:
        raise RuntimeError("Barnes-Hut mesh solver returned no results")
    results = _to_list(result_ptr, result_size.value)
    libs.barnes_hut.barnes_hut_free_result(result_ptr)
    return results, compute_ms


def compute_amfm_mesh(libs, mesh_params, data):
    if libs.amfm is None:
        raise RuntimeError("AMFM library not loaded")
    src_x, src_y, src_z, src_density, src_volume = tet_mesh_source_arrays(mesh_params)
    rec_x, rec_y, rec_z = tet_mesh_receiver_arrays(mesh_params)
    n_src = int(mesh_params.num_elements)
    n_rec = int(mesh_params.num_receivers_x) * int(mesh_params.num_receivers_y)

    amfm_params = AMFMParams()
    amfm_params.source_x = src_x
    amfm_params.source_y = src_y
    amfm_params.source_z = src_z
    amfm_params.source_density = src_density
    amfm_params.source_volume = src_volume
    amfm_params.num_sources = n_src
    amfm_params.receiver_x = rec_x
    amfm_params.receiver_y = rec_y
    amfm_params.receiver_z = rec_z
    amfm_params.num_receivers = n_rec

    cd = float(data.get("criticalDistanceFactor", 2.5))
    md = int(data.get("maxDepth", 10))
    msn = int(data.get("maxSourcesPerNode", 256))
    model_label = str(data.get("modelType", "") or "")
    if "Rectangular Prism" in model_label:
        cd = max(cd, 3.5)
        md = max(md, 12)
        msn = min(msn, 128)
    amfm_params.critical_distance_factor = cd
    amfm_params.max_depth = md
    amfm_params.max_sources_per_node = msn

    result_size = ctypes.c_int(0)
    t0 = time.perf_counter()
    result_ptr = libs.amfm.amfm_compute_gravity(ctypes.byref(amfm_params), ctypes.byref(result_size))
    compute_ms = (time.perf_counter() - t0) * 1000.0
    if result_ptr is None or result_size.value == 0:
        raise RuntimeError("AMFM mesh solver returned no results")
    results = _to_list(result_ptr, result_size.value)
    libs.amfm.amfm_free_result(result_ptr)
    return results, compute_ms


def compute_quadrature_mesh(libs, mesh_params):
    if libs.quadrature_second_order is None:
        raise RuntimeError("Quadrature second-order library not loaded")
    if not hasattr(libs.quadrature_second_order, "forward_gravity_tetra_mesh_quadrature"):
        raise RuntimeError("Quadrature mesh entrypoint is not available")
    result_size = ctypes.c_int(0)
    t0 = time.perf_counter()
    result_ptr = libs.quadrature_second_order.forward_gravity_tetra_mesh_quadrature(
        ctypes.byref(mesh_params), ctypes.byref(result_size)
    )
    compute_ms = (time.perf_counter() - t0) * 1000.0
    if result_ptr is None or result_size.value == 0:
        raise RuntimeError("Quadrature mesh solver returned no results")
    results = _to_list(result_ptr, result_size.value)
    libs.quadrature_second_order.free_quadrature_result(result_ptr)
    return results, compute_ms

