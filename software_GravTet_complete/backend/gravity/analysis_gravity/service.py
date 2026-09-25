"""Backward-compatible re-exports. Prefer ``api.gravity.analysis`` per-method modules."""

from api.gravity.analysis.dispatch import run_analysis, run_mesh_analysis

__all__ = ["run_analysis", "run_mesh_analysis"]
