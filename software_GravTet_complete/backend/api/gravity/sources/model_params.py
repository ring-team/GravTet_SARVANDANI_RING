"""Shared synthetic-model FFI contract used by every forward solver.

This module owns no single solver: any one forward method (Direct Newton,
AMFM, Barnes-Hut, Quadrature) should be removable without breaking the
others' ability to describe a synthetic model or a tetrahedral mesh. Keep it
that way -- do not add solver-specific fields or structures here.

Mirrors the C++ contract in `backend/gravity/common/model_params.h`. Keep in
sync with that header and with `api/gravity/shared/helpers.py::create_model_params`.
"""

from ctypes import POINTER, Structure, c_double, c_int

from gravity.mesh.types import MeshNode, TetraElement, TetraMeshInput


class ModelParams(Structure):
    """ModelParams structure matching the shared C++ `ModelParams` definition."""

    _fields_ = [
        ("model_type", c_int),
        ("center_x", c_double),
        ("center_y", c_double),
        ("center_z", c_double),
        ("density", c_double),
        ("num_sources_x", c_int),
        ("num_sources_y", c_int),
        ("num_sources_z", c_int),
        ("num_receivers_x", c_int),
        ("num_receivers_y", c_int),
        ("surface_x_min", c_double),
        ("surface_x_max", c_double),
        ("surface_y_min", c_double),
        ("surface_y_max", c_double),
        ("surface_z", c_double),
        ("size_x", c_double),
        ("size_y", c_double),
        ("size_z", c_double),
        ("radius", c_double),
        ("num_sources_radial", c_int),
        ("num_sources_theta", c_int),
        ("num_sources_phi", c_int),
        ("a", c_double),
        ("b", c_double),
        ("c", c_double),
        ("cylinder_radius", c_double),
        ("cylinder_height", c_double),
        ("num_sources_radial_cyl", c_int),
        ("num_sources_theta_cyl", c_int),
        ("h_cylinder_radius", c_double),
        ("h_cylinder_length", c_double),
        ("num_sources_radial_hcyl", c_int),
        ("num_sources_theta_hcyl", c_int),
        ("num_sources_length", c_int),
        ("base_radius", c_double),
        ("top_radius", c_double),
        ("dome_height", c_double),
        ("num_sources_radial_dome", c_int),
        ("num_sources_theta_dome", c_int),
        ("fault_offset", c_double),
        ("layer1_thickness", c_double),
        ("layer2_thickness", c_double),
        ("layer3_thickness", c_double),
        ("layer1_density", c_double),
        ("layer2_density", c_double),
        ("layer3_density", c_double),
        ("voxel_size", c_double),
        ("cube1_x", c_double),
        ("cube1_y", c_double),
        ("cube1_z", c_double),
        ("cube1_h", c_double),
        ("cube1_density", c_double),
        ("cube2_x", c_double),
        ("cube2_y", c_double),
        ("cube2_z", c_double),
        ("cube2_h", c_double),
        ("cube2_density", c_double),
        ("cube3_x", c_double),
        ("cube3_y", c_double),
        ("cube3_z", c_double),
        ("cube3_h", c_double),
        ("cube3_density", c_double),
        ("cube4_x", c_double),
        ("cube4_y", c_double),
        ("cube4_z", c_double),
        ("cube4_h", c_double),
        ("cube4_density", c_double),
        ("spacing_x", c_double),
        ("spacing_y", c_double),
        ("cube1_offset_x", c_double),
        ("cube1_offset_y", c_double),
        ("cube2_offset_x", c_double),
        ("cube2_offset_y", c_double),
        ("cube3_offset_x", c_double),
        ("cube3_offset_y", c_double),
        ("cube4_offset_x", c_double),
        ("cube4_offset_y", c_double),
        ("num_threads", c_int),
        ("execution_mode", c_int),
        ("receiver_block_size", c_int),
        ("source_block_size", c_int),
    ]


class SourceArray(Structure):
    """Packed source or receiver array used by source-generation FFI."""

    _fields_ = [
        ("x", POINTER(c_double)),
        ("y", POINTER(c_double)),
        ("z", POINTER(c_double)),
        ("density", POINTER(c_double)),
        ("volume", POINTER(c_double)),
        ("size", c_int),
    ]


__all__ = ["MeshNode", "ModelParams", "SourceArray", "TetraElement", "TetraMeshInput"]
