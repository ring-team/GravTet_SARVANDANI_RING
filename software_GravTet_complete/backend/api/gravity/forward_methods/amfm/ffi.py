"""ctypes structures for AMFM FFI."""

from ctypes import POINTER, Structure, c_double, c_int


class AMFMParams(Structure):
    """AMFMParams structure matching C++ definition."""

    _fields_ = [
        ("source_x", POINTER(c_double)),
        ("source_y", POINTER(c_double)),
        ("source_z", POINTER(c_double)),
        ("source_density", POINTER(c_double)),
        ("source_volume", POINTER(c_double)),
        ("num_sources", c_int),
        ("receiver_x", POINTER(c_double)),
        ("receiver_y", POINTER(c_double)),
        ("receiver_z", POINTER(c_double)),
        ("num_receivers", c_int),
        ("critical_distance_factor", c_double),
        ("max_depth", c_int),
        ("max_sources_per_node", c_int),
    ]


__all__ = ["AMFMParams"]
