"""Forward solver wrappers used by analysis service."""

import ctypes
import time

def _to_list(ptr, size):
    return [ptr[i] for i in range(size)]


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
