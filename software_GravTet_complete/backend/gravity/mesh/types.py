"""ctypes mesh structs shared across gravity APIs."""

from ctypes import POINTER, Structure, c_double, c_int


class MeshNode(Structure):
    """Single tetra-mesh node."""

    _fields_ = [("x", c_double), ("y", c_double), ("z", c_double)]


class TetraElement(Structure):
    """Single tetra element with per-cell density."""

    _fields_ = [
        ("i0", c_int),
        ("i1", c_int),
        ("i2", c_int),
        ("i3", c_int),
        ("density", c_double),
    ]


class TetraMeshInput(Structure):
    """Generic mesh-driven gravity request."""

    _fields_ = [
        ("nodes", POINTER(MeshNode)),
        ("num_nodes", c_int),
        ("elements", POINTER(TetraElement)),
        ("num_elements", c_int),
        ("num_receivers_x", c_int),
        ("num_receivers_y", c_int),
        ("surface_x_min", c_double),
        ("surface_x_max", c_double),
        ("surface_y_min", c_double),
        ("surface_y_max", c_double),
        ("surface_z", c_double),
        ("execution_mode", c_int),
        ("num_threads", c_int),
        ("receiver_block_size", c_int),
        ("source_block_size", c_int),
        ("simd_lanes", c_int),
    ]

