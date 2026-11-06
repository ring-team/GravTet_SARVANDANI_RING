"""Load gravity FFI shared libraries and bind ctypes signatures."""

import ctypes
import datetime
import os
import traceback
from dataclasses import dataclass
from ctypes import POINTER, c_double, c_int

from .constants import (
    QUADRATURE_SECOND_ORDER_LIB_PATH,
    SYNTHETIC_GRAVITY_LIB_PATH,
)
from gravity.mesh.types import TetraMeshInput

from ..sources.model_params import ModelParams, SourceArray
from ..forward_methods.quadrature.ffi import QuadratureModelParams


def _log_lib_mtime(path) -> None:
    """Print mtime so operators know whether a running process is still using an old .dylib/.so."""
    try:
        st = path.stat()
        ts = datetime.datetime.fromtimestamp(st.st_mtime, tz=datetime.timezone.utc).strftime(
            "%Y-%m-%d %H:%M:%S UTC"
        )
        print(f"   (file mtime {ts} — restart the API after rebuild; ctypes does not reload native code)")
    except OSError:
        pass


# --- Library handles (optional if .dylib/.so missing) ---


@dataclass
class GravityLibraries:
    synthetic_gravity: object = None
    quadrature_second_order: object = None


# --- Synthetic source generation ---


def _setup_synthetic_gravity_lib(libs: GravityLibraries):
    try:
        if not SYNTHETIC_GRAVITY_LIB_PATH.exists():
            print(f"Warning: Synthetic gravity library not found at {SYNTHETIC_GRAVITY_LIB_PATH.name}")
            return

        lib_dir = str(SYNTHETIC_GRAVITY_LIB_PATH.parent)
        if hasattr(os, "add_dll_directory"):
            os.add_dll_directory(lib_dir)

        libs.synthetic_gravity = ctypes.CDLL(str(SYNTHETIC_GRAVITY_LIB_PATH))
        _log_lib_mtime(SYNTHETIC_GRAVITY_LIB_PATH)
        libs.synthetic_gravity.generate_sources_for_model.argtypes = [POINTER(ModelParams)]
        libs.synthetic_gravity.generate_sources_for_model.restype = POINTER(SourceArray)
        libs.synthetic_gravity.generate_receivers_for_model.argtypes = [
            c_double,
            c_double,
            c_double,
            c_double,
            c_double,
            c_int,
            c_int,
        ]
        libs.synthetic_gravity.generate_receivers_for_model.restype = POINTER(SourceArray)
        libs.synthetic_gravity.free_source_array.argtypes = [POINTER(SourceArray)]
        libs.synthetic_gravity.free_source_array.restype = None
        if hasattr(libs.synthetic_gravity, "count_sources_for_model"):
            libs.synthetic_gravity.count_sources_for_model.argtypes = [POINTER(ModelParams)]
            libs.synthetic_gravity.count_sources_for_model.restype = c_int
        print(f"✓ Loaded Synthetic gravity library: {SYNTHETIC_GRAVITY_LIB_PATH.name}")
    except Exception as e:
        print(f"Warning: Could not load Synthetic gravity library: {e}")
        traceback.print_exc()


def _setup_quadrature_lib(libs: GravityLibraries):
    try:
        if not QUADRATURE_SECOND_ORDER_LIB_PATH.exists():
            print(f"Warning: Quadrature second-order library not found at {QUADRATURE_SECOND_ORDER_LIB_PATH}")
            return
        if hasattr(os, "add_dll_directory"):
            try:
                os.add_dll_directory(str(QUADRATURE_SECOND_ORDER_LIB_PATH.parent))
            except Exception:
                pass
        libs.quadrature_second_order = ctypes.CDLL(str(QUADRATURE_SECOND_ORDER_LIB_PATH))
        _log_lib_mtime(QUADRATURE_SECOND_ORDER_LIB_PATH)
        libs.quadrature_second_order.forward_gravity_quadrature_model.argtypes = [
            POINTER(QuadratureModelParams),
            POINTER(c_int),
        ]
        libs.quadrature_second_order.forward_gravity_quadrature_model.restype = POINTER(c_double)
        if hasattr(libs.quadrature_second_order, "forward_gravity_tetra_mesh_quadrature"):
            libs.quadrature_second_order.forward_gravity_tetra_mesh_quadrature.argtypes = [
                POINTER(TetraMeshInput),
                POINTER(c_int),
            ]
            libs.quadrature_second_order.forward_gravity_tetra_mesh_quadrature.restype = POINTER(c_double)
        if hasattr(libs.quadrature_second_order, "count_quadrature_cells_for_tetra_mesh"):
            libs.quadrature_second_order.count_quadrature_cells_for_tetra_mesh.argtypes = [POINTER(TetraMeshInput)]
            libs.quadrature_second_order.count_quadrature_cells_for_tetra_mesh.restype = c_int
        if hasattr(libs.quadrature_second_order, "count_quadrature_cells_for_model"):
            libs.quadrature_second_order.count_quadrature_cells_for_model.argtypes = [
                POINTER(QuadratureModelParams),
            ]
            libs.quadrature_second_order.count_quadrature_cells_for_model.restype = c_int
        libs.quadrature_second_order.free_quadrature_result.argtypes = [POINTER(c_double)]
        libs.quadrature_second_order.free_quadrature_result.restype = None
        print(f"✓ Loaded Quadrature second-order library: {QUADRATURE_SECOND_ORDER_LIB_PATH.name}")
    except Exception as e:
        print(f"Warning: Could not load Quadrature second-order library: {e}")


# --- Public loader ---


def load_libraries() -> GravityLibraries:
    libs = GravityLibraries()
    _setup_synthetic_gravity_lib(libs)
    _setup_quadrature_lib(libs)
    return libs
