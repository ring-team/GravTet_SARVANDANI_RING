"""Per-method analysis dispatch (closed-form reference, separated candidates)."""

from __future__ import annotations

import logging

from .methods import amfm, barnes_hut, direct, quadrature

_METHODS = {
    "direct_newton": direct,
    "barnes_hut": barnes_hut,
    "amfm": amfm,
    "quadrature_second_order": quadrature,
}


def run_analysis(libs, data: dict, logger: logging.Logger) -> dict:
    method = str(data.get("analysisMethod", "") or "direct_newton").strip().lower()
    module = _METHODS.get(method)
    if module is None:
        supported = ", ".join(sorted(_METHODS))
        raise ValueError(f"Unsupported analysis method: {method}. Supported: {supported}")
    return module.dispatch(libs, data, logger)


def run_mesh_analysis(libs, data: dict, logger: logging.Logger) -> dict:
    method = str(data.get("analysisMethod", "") or "direct_newton").strip().lower()
    module = _METHODS.get(method)
    if module is None:
        supported = ", ".join(sorted(_METHODS))
        raise ValueError(f"Unsupported analysis method: {method}. Supported: {supported}")
    return module.run_mesh_analysis(libs, data, logger)
