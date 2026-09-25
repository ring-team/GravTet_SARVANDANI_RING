"""Quadrature second-order gravity: ``/api/compute_gravity_quadrature``."""

from ...shared.routes_misc import quadrature_simd_capabilities
from werkzeug.exceptions import HTTPException
import logging
import time
import traceback

from flask import jsonify, request

from ...shared.helpers import gravity_json_payload
from ...mesh.mesh_route_utils import prepare_forward_tetra_mesh_input, has_mesh_payload, is_tetrahedral_catalog_request, warn_if_legacy_shape_fields
from ...shared.route_responses import invalid_request_response, library_not_loaded_response, validation_failed_response
from .compute import run_quadrature_mesh_from_params


def register_quadrature_routes(app, libs):
    logger = logging.getLogger(__name__)

    @app.route("/api/compute_gravity_quadrature", methods=["POST"])
    def compute_gravity_quadrature():
        if not libs.quadrature_second_order:
            return library_not_loaded_response("Quadrature second-order library not loaded. Please build backend libraries.")
        try:
            data = request.json
            if not isinstance(data, dict):
                return invalid_request_response()
            warn_if_legacy_shape_fields(logger, data)

            if not (has_mesh_payload(data) or is_tetrahedral_catalog_request(data)):
                return validation_failed_response(
                    "Quadrature second-order supports only Tetrahedral model types."
                )
            return compute_gravity_mesh_quadrature()
        except HTTPException:
            raise
        except Exception as e:
            traceback.print_exc()
            return jsonify({"error": f"Quadrature second-order calculation failed: {str(e)}", "status": "error"}), 500

    @app.route("/api/compute_gravity_mesh_quadrature", methods=["POST"])
    def compute_gravity_mesh_quadrature():
        if not libs.quadrature_second_order:
            return library_not_loaded_response("Quadrature second-order library not loaded. Please build backend libraries.")
        if not hasattr(libs.quadrature_second_order, "forward_gravity_tetra_mesh_quadrature"):
            return jsonify(
                {
                    "error": (
                        "Mesh-driven quadrature entrypoint is not available in the current native library. "
                        "Phase 2 (native tetra-mesh FFI) has not been built yet."
                    ),
                    "status": "not_implemented",
                }
            ), 501
        try:
            data = request.json
            if not isinstance(data, dict):
                return invalid_request_response()
            warn_if_legacy_shape_fields(logger, data)
            t_total_start = time.perf_counter()
            params, node_arr, elem_arr, gmsh_build_meta = prepare_forward_tetra_mesh_input(data, logger)
            run = run_quadrature_mesh_from_params(
                libs,
                params,
                node_arr,
                elem_arr,
                gmsh_build_meta=gmsh_build_meta,
                total_start=t_total_start,
            )
            _em = run.execution_mode if run.execution_mode is not None else int(params.execution_mode)
            _em_labels = {0: "tiled", 1: "simd_tiled", 2: "simd_tiled_threading", 3: "reference"}
            solver_meta = {
                "input_mode": "tetra_mesh",
                "method": "quadrature_second_order",
                "execution_mode": _em,
                "execution_mode_label": _em_labels.get(_em, "unknown"),
                "num_threads": run.num_threads if run.num_threads is not None else int(params.num_threads),
                "simd_lanes": (int(params.simd_lanes) or quadrature_simd_capabilities(libs.quadrature_second_order)["active_lanes"]) if _em in (1, 2) else None,
            }
            if run.gmsh_build_meta:
                solver_meta["gmshBuild"] = run.gmsh_build_meta
            return jsonify(
                gravity_json_payload(
                    run.results,
                    run.num_receivers_x,
                    run.num_receivers_y,
                    run.compute_ms,
                    total_ms=run.total_ms,
                    num_sources=run.num_sources,
                    solver_meta=solver_meta,
                )
            )
        except ValueError as e:
            return validation_failed_response(str(e))
        except HTTPException:
            raise
        except Exception as e:
            traceback.print_exc()
            return jsonify({"error": f"Quadrature mesh calculation failed: {str(e)}", "status": "error"}), 500
