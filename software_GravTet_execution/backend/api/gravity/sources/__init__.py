"""Shared source/receiver generation and FFI model contract for native forward methods."""

from .model_params import MeshNode, ModelParams, SourceArray, TetraElement, TetraMeshInput
from .synthetic_source_generation import (
    GeneratedSourceReceiverArrays,
    count_sources_for_model,
    free_generated_sources_and_receivers,
    generate_sources_and_receivers_for_model,
    require_source_generation_lib,
)

__all__ = [
    "GeneratedSourceReceiverArrays",
    "MeshNode",
    "ModelParams",
    "SourceArray",
    "TetraElement",
    "TetraMeshInput",
    "count_sources_for_model",
    "free_generated_sources_and_receivers",
    "generate_sources_and_receivers_for_model",
    "require_source_generation_lib",
]
