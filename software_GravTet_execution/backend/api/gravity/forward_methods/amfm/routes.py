"""AMF+ Advanced Newton (AMFM): ``/api/compute_gravity_amfm``."""

import logging
import time
import traceback

from flask import jsonify, request

from ...mesh.mesh_route_utils import (
    prepare_forward_tetra_mesh_input,
    has_mesh_payload,
    is_tetrahedral_catalog_request,
    warn_if_legacy_shape_fields,
)
from ...shared.constants import (
    AMF_PLUS_ADVANCED_NEWTON_NAME,
    MAX_AMFM_RECEIVERS,
    MAX_APPROXIMATE_METHOD_LOG_SCALED_INTERACTIONS,
)
from ...shared.helpers import (
    estimate_sources_and_receivers,
    gravity_json_payload,
    log_scaled_interaction_measure,
)
from ...shared.route_responses import invalid_request_response, library_not_loaded_response
from .compute import run_amfm_from_request, run_amfm_mesh_from_params


def _amfm_solver_meta(run):
    return {
        "engine": "amfm",
        "input_mode": run.input_mode,
        "method": "amfm",
        "critical_distance_requested": run.critical_distance_requested,
        "critical_distance_effective": run.critical_distance_effective,
        "max_depth_requested": run.max_depth_requested,
        "max_depth_effective": run.max_depth_effective,
        "max_sources_per_node_requested": run.max_sources_per_node_requested,
        "max_sources_per_node_effective": run.max_sources_per_node_effective,
        "prism_tuning": run.prism_tuning,
    }


def register_amfm_routes(app, libs):
    logger = logging.getLogger(__name__)

    @app.route("/api/compute_gravity_amfm", methods=["POST"])
    def compute_gravity_amfm():
        if not libs.amfm:
            return library_not_loaded_response(
                f"{AMF_PLUS_ADVANCED_NEWTON_NAME} library not loaded. Please build the C++ libraries first."
            )
        try:
            data = request.json
            if not isinstance(data, dict):
                return invalid_request_response()
            warn_if_legacy_shape_fields(logger, data)

            mesh_like = has_mesh_payload(data) or is_tetrahedral_catalog_request(data)
            total_start = time.perf_counter()
            if not mesh_like:
                n_src_est, n_rec_est = estimate_sources_and_receivers(data)
                if n_rec_est > MAX_AMFM_RECEIVERS:
                    return jsonify(
                        {
                            "error": (
                                f"Too many observation points for {AMF_PLUS_ADVANCED_NEWTON_NAME} ({n_rec_est}). "
                                f"Current safety cap is {MAX_AMFM_RECEIVERS}."
                            ),
                            "status": "validation_failed",
                        }
                    ), 400
                eff = log_scaled_interaction_measure(n_src_est, n_rec_est)
                raw_pairs = int(n_src_est) * int(n_rec_est)
                if eff > MAX_APPROXIMATE_METHOD_LOG_SCALED_INTERACTIONS:
                    return jsonify(
                        {
                            "error": (
                                f"Too many log-scaled source–receiver workload units for {AMF_PLUS_ADVANCED_NEWTON_NAME} "
                                f"(effective N·M/log₂N = {eff:,}; raw N·M = {raw_pairs:,}). "
                                f"Current safety cap is {MAX_APPROXIMATE_METHOD_LOG_SCALED_INTERACTIONS:,}. "
                                "Reduce mesh resolution or the observation grid."
                            ),
                            "status": "validation_failed",
                        }
                    ), 400
                run = run_amfm_from_request(libs, data)
                return jsonify(
                    gravity_json_payload(
                        run.results,
                        run.num_receivers_x,
                        run.num_receivers_y,
                        run.compute_ms,
                        total_ms=(time.perf_counter() - total_start) * 1000.0,
                        num_sources=run.num_sources,
                        solver_meta=_amfm_solver_meta(run),
                    )
                )

            mesh_params, node_arr, elem_arr, gmsh_build_meta = prepare_forward_tetra_mesh_input(data, logger)
            n_src_est = int(mesh_params.num_elements)
            n_rec_est = int(mesh_params.num_receivers_x) * int(mesh_params.num_receivers_y)
            if n_rec_est > MAX_AMFM_RECEIVERS:
                return jsonify(
                    {
                        "error": (
                            f"Too many observation points for {AMF_PLUS_ADVANCED_NEWTON_NAME} ({n_rec_est}). "
                            f"Current safety cap is {MAX_AMFM_RECEIVERS}."
                        ),
                        "status": "validation_failed",
                    }
                ), 400
            eff = log_scaled_interaction_measure(n_src_est, n_rec_est)
            if eff > MAX_APPROXIMATE_METHOD_LOG_SCALED_INTERACTIONS:
                raw_pairs = n_src_est * n_rec_est
                return jsonify(
                    {
                        "error": (
                            f"Too many log-scaled source–receiver workload units for {AMF_PLUS_ADVANCED_NEWTON_NAME} "
                            f"(effective N·M/log₂N = {eff:,}; raw N·M = {raw_pairs:,}). "
                            f"Current safety cap is {MAX_APPROXIMATE_METHOD_LOG_SCALED_INTERACTIONS:,}. "
                            "Reduce mesh resolution or the observation grid."
                        ),
                        "status": "validation_failed",
                    }
                ), 400
            run = run_amfm_mesh_from_params(libs, data, mesh_params, node_arr=node_arr, elem_arr=elem_arr)
            solver_meta = _amfm_solver_meta(run)
            if gmsh_build_meta:
                solver_meta["gmshBuild"] = gmsh_build_meta
            return jsonify(
                gravity_json_payload(
                    run.results,
                    run.num_receivers_x,
                    run.num_receivers_y,
                    run.compute_ms,
                    total_ms=(time.perf_counter() - total_start) * 1000.0,
                    num_sources=run.num_sources,
                    solver_meta=solver_meta,
                )
            )
        except Exception as e:
            traceback.print_exc()
            return jsonify({"error": f"{AMF_PLUS_ADVANCED_NEWTON_NAME} calculation failed: {str(e)}", "status": "error"}), 500
