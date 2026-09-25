"""Direct Newton (pairwise) gravity: ``/api/compute_gravity``."""

import logging
import time
import traceback

from flask import jsonify, request

from ...shared.constants import MAX_DIRECT_NEWTON_INTERACTIONS, MAX_DIRECT_NEWTON_RECEIVERS, MAX_DIRECT_NEWTON_SOURCES
from ...shared.helpers import estimate_sources_and_receivers, gravity_json_payload
from ...mesh.mesh_route_utils import prepare_forward_tetra_mesh_input, has_mesh_payload, is_tetrahedral_catalog_request, warn_if_legacy_shape_fields
from ...shared.route_responses import invalid_request_response, library_not_loaded_response, validation_failed_response
from .compute import run_direct_from_request, run_direct_mesh_from_params


def register_direct_routes(app, libs):
    logger = logging.getLogger(__name__)

    @app.route("/api/compute_gravity", methods=["POST"])
    def compute_gravity():
        if not libs.direct_newton:
            return library_not_loaded_response("Direct Newton library not loaded. Please build the C++ libraries first.")
        try:
            data = request.json
            if not isinstance(data, dict):
                return invalid_request_response()
            warn_if_legacy_shape_fields(logger, data)
            mesh_like = has_mesh_payload(data) or is_tetrahedral_catalog_request(data)
            if not mesh_like:
                # Compatibility path for synthetic shape payloads.
                n_src_est, n_rec_est = estimate_sources_and_receivers(data)
                if n_src_est > MAX_DIRECT_NEWTON_SOURCES:
                    return jsonify(
                        {
                            "error": (
                                f"Too many sources for Direct Newton ({n_src_est}). "
                                f"Current safety cap is {MAX_DIRECT_NEWTON_SOURCES}."
                            ),
                            "status": "validation_failed",
                        }
                    ), 400
                if n_rec_est > MAX_DIRECT_NEWTON_RECEIVERS:
                    return jsonify(
                        {
                            "error": (
                                f"Too many observation points for Direct Newton ({n_rec_est}). "
                                f"Current safety cap is {MAX_DIRECT_NEWTON_RECEIVERS}."
                            ),
                            "status": "validation_failed",
                        }
                    ), 400
                if n_src_est * n_rec_est > MAX_DIRECT_NEWTON_INTERACTIONS:
                    return jsonify(
                        {
                            "error": (
                                f"Too many source-receiver interactions ({n_src_est * n_rec_est}). "
                                f"Current safety cap is {MAX_DIRECT_NEWTON_INTERACTIONS}."
                            ),
                            "status": "validation_failed",
                        }
                    ), 400
                run = run_direct_from_request(libs, data)
                return jsonify(
                    gravity_json_payload(
                        run.results,
                        run.num_receivers_x,
                        run.num_receivers_y,
                        run.compute_ms,
                        total_ms=run.total_ms,
                        num_sources=run.num_sources,
                        solver_meta={"input_mode": "synthetic_legacy", "method": "direct_newton"},
                    )
                )
            # Mesh-first: delegate to mesh endpoint implementation.
            return compute_gravity_mesh_direct()
        except Exception as e:
            traceback.print_exc()
            return jsonify({"error": f"Direct Newton calculation failed: {str(e)}", "status": "error"}), 500

    @app.route("/api/compute_gravity_mesh_direct", methods=["POST"])
    def compute_gravity_mesh_direct():
        if not libs.direct_newton:
            return library_not_loaded_response("Direct Newton library not loaded. Please build the C++ libraries first.")
        if not getattr(libs, "direct_newton_mesh_forward", False):
            return jsonify(
                {
                    "error": (
                        "Mesh-driven Direct Newton is not available in the loaded native library. "
                        "Run: cd backend && bash ./build_system/build.sh — then restart the API on port 5002."
                    ),
                    "status": "not_implemented",
                }
            ), 503
        try:
            data = request.json
            t_total_start = time.perf_counter()
            if not isinstance(data, dict):
                return invalid_request_response()
            warn_if_legacy_shape_fields(logger, data)
            params, node_arr, elem_arr, gmsh_build_meta = prepare_forward_tetra_mesh_input(data, logger)
            n_src_est = int(params.num_elements)
            n_rec_est = int(params.num_receivers_x) * int(params.num_receivers_y)
            if n_src_est > MAX_DIRECT_NEWTON_SOURCES:
                return jsonify(
                    {
                        "error": (
                            f"Too many tetra sources for Direct Newton mesh ({n_src_est:,}). "
                            f"Current safety cap is {MAX_DIRECT_NEWTON_SOURCES:,}. "
                            "Use a coarser mesh or the Quadrature second-order tab for unstructured models."
                        ),
                        "status": "validation_failed",
                    }
                ), 400
            if n_rec_est > MAX_DIRECT_NEWTON_RECEIVERS:
                return jsonify(
                    {
                        "error": (
                            f"Too many observation points for Direct Newton ({n_rec_est:,}). "
                            f"Current safety cap is {MAX_DIRECT_NEWTON_RECEIVERS:,}."
                        ),
                        "status": "validation_failed",
                    }
                ), 400
            if n_src_est * n_rec_est > MAX_DIRECT_NEWTON_INTERACTIONS:
                return jsonify(
                    {
                        "error": (
                            f"Too many source–receiver interactions ({n_src_est * n_rec_est:,}). "
                            f"Current safety cap is {MAX_DIRECT_NEWTON_INTERACTIONS:,}. "
                            "Reduce mesh resolution or the observation grid, or use Quadrature second-order."
                        ),
                        "status": "validation_failed",
                    }
                ), 400
            run = run_direct_mesh_from_params(
                libs,
                params,
                node_arr,
                elem_arr,
                gmsh_build_meta=gmsh_build_meta,
                total_start=t_total_start,
            )
            solver_meta = {"input_mode": "tetra_mesh", "method": "direct_newton"}
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
        except Exception as e:
            traceback.print_exc()
            return jsonify({"error": f"Direct Newton mesh calculation failed: {str(e)}", "status": "error"}), 500
