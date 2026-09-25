"""Synthetic model source/receiver generation via the shared ``synthetic_gravity`` library."""

from __future__ import annotations

import ctypes
from dataclasses import dataclass


@dataclass(frozen=True)
class GeneratedSourceReceiverArrays:
    sources_ptr: object
    receivers_ptr: object

    @property
    def sources(self):
        return self.sources_ptr.contents

    @property
    def receivers(self):
        return self.receivers_ptr.contents


def require_source_generation_lib(libs) -> None:
    if libs.synthetic_gravity is None:
        raise RuntimeError(
            "Synthetic gravity source-generation library not loaded"
        )


def generate_sources_and_receivers_for_model(libs, model_params) -> GeneratedSourceReceiverArrays:
    """Generate source and receiver arrays for synthetic model payloads."""
    require_source_generation_lib(libs)
    sources_ptr = libs.synthetic_gravity.generate_sources_for_model(ctypes.byref(model_params))
    if sources_ptr is None:
        raise RuntimeError("Failed to generate sources")
    receivers_ptr = libs.synthetic_gravity.generate_receivers_for_model(
        model_params.surface_x_min,
        model_params.surface_x_max,
        model_params.surface_y_min,
        model_params.surface_y_max,
        model_params.surface_z,
        model_params.num_receivers_x,
        model_params.num_receivers_y,
    )
    if receivers_ptr is None:
        libs.synthetic_gravity.free_source_array(sources_ptr)
        raise RuntimeError("Failed to generate receivers")
    return GeneratedSourceReceiverArrays(sources_ptr=sources_ptr, receivers_ptr=receivers_ptr)


def free_generated_sources_and_receivers(libs, arrays: GeneratedSourceReceiverArrays) -> None:
    require_source_generation_lib(libs)
    libs.synthetic_gravity.free_source_array(arrays.sources_ptr)
    libs.synthetic_gravity.free_source_array(arrays.receivers_ptr)


def count_sources_for_model(libs, model_params) -> int | None:
    if libs.synthetic_gravity is None or not hasattr(libs.synthetic_gravity, "count_sources_for_model"):
        return None
    try:
        counted = int(libs.synthetic_gravity.count_sources_for_model(ctypes.byref(model_params)))
    except Exception:
        return None
    return counted if counted >= 0 else None
