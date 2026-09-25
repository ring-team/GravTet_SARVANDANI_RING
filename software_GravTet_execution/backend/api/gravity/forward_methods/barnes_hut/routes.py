"""Barnes–Hut tree code: ``/api/compute_gravity_barnes_hut``."""

import logging
import time
import traceback

from flask import jsonify, request

from ...mesh.mesh_route_utils import prepare_forward_tetra_mesh_input, warn_if_legacy_shape_fields, has_mesh_payload, is_tetrahedral_catalog_request
from ...shared.constants import (
    BARNES_HUT_ADVANCED_NEWTON_NAME,
    MAX_APPROXIMATE_METHOD_LOG_SCALED_INTERACTIONS,
    MAX_BARNES_HUT_RECEIVERS,
)
from ...shared.helpers import gravity_json_payload, log_scaled_interaction_measure
from ...shared.route_responses import invalid_request_response, library_not_loaded_response
from .compute import estimate_barnes_hut_workload, run_barnes_hut_from_request


def register_barnes_hut_routes(app, libs):
    logger = logging.getLogger(__name__)

    @app.route("/api/compute_gravity_barnes_hut", methods=["POST"])
    def compute_gravity_barnes_hut():
        if not libs.barnes_hut:
            return library_not_loaded_response("Barnes–Hut + Advanced Newton library not loaded. Build from backend/build.")
        try:
            t_total_start = time.perf_counter()
            data = request.json
            if not isinstance(data, dict):
                return invalid_request_response()
            warn_if_legacy_shape_fields(logger, data)

            n_src_est, n_rec_est, _input_mode, _gmsh_meta = estimate_barnes_hut_workload(data, libs, logger)
            if n_rec_est > MAX_BARNES_HUT_RECEIVERS:
                return jsonify(
                    {
                        "error": (
                            f"Too many observation points for {BARNES_HUT_ADVANCED_NEWTON_NAME} ({n_rec_est}). "
                            f"Current safety cap is {MAX_BARNES_HUT_RECEIVERS}."
                        ),
                        "status": "validation_failed",
                    }
                ), 400
            raw_pairs = int(n_src_est) * int(n_rec_est)
            eff = log_scaled_interaction_measure(n_src_est, n_rec_est)
            if eff > MAX_APPROXIMATE_METHOD_LOG_SCALED_INTERACTIONS:
                return jsonify(
                    {
                        "error": (
                            f"Too many log-scaled source–receiver workload units for {BARNES_HUT_ADVANCED_NEWTON_NAME} "
                            f"(effective N·M/log₂N = {eff:,}; raw N·M = {raw_pairs:,}). "
                            f"Current safety cap is {MAX_APPROXIMATE_METHOD_LOG_SCALED_INTERACTIONS:,}. "
                            "Reduce mesh resolution or the observation grid."
                        ),
                        "status": "validation_failed",
                    }
                ), 400

            theta_requested = float(data.get("theta0", 0.5))
            mesh_like = has_mesh_payload(data) or is_tetrahedral_catalog_request(data)
            mesh_prep_ms = 0.0
            mesh_input = None
            if mesh_like:
                t_mesh_prep_start = time.perf_counter()
                mesh_input = prepare_forward_tetra_mesh_input(data, logger)
                mesh_prep_ms = (time.perf_counter() - t_mesh_prep_start) * 1000.0
            if mesh_input is not None:
                mesh_params, _node_arr, _elem_arr, _gmsh_meta = mesh_input
                n_src = int(mesh_params.num_elements)
                n_rec = int(mesh_params.num_receivers_x) * int(mesh_params.num_receivers_y)
                if n_rec > MAX_BARNES_HUT_RECEIVERS:
                    return jsonify(
                        {
                            "error": (
                                f"Too many observation points for {BARNES_HUT_ADVANCED_NEWTON_NAME} ({n_rec:,}). "
                                f"Current safety cap is {MAX_BARNES_HUT_RECEIVERS:,}."
                            ),
                            "status": "validation_failed",
                        }
                    ), 400
                raw_pairs = n_src * n_rec
                eff = log_scaled_interaction_measure(n_src, n_rec)
                if eff > MAX_APPROXIMATE_METHOD_LOG_SCALED_INTERACTIONS:
                    return jsonify(
                        {
                            "error": (
                                f"Too many log-scaled source–receiver workload units for {BARNES_HUT_ADVANCED_NEWTON_NAME} "
                                f"(effective N·M/log₂N = {eff:,}; raw N·M = {raw_pairs:,}). "
                                f"Current safety cap is {MAX_APPROXIMATE_METHOD_LOG_SCALED_INTERACTIONS:,}. "
                                "Reduce mesh resolution or the observation grid."
                            ),
                            "status": "validation_failed",
                        }
                    ), 400

            t_compute_start = time.perf_counter()
            run_result = run_barnes_hut_from_request(
                libs,
                data,
                theta0=theta_requested,
                logger=logger,
                mesh_input=mesh_input,
            )
            compute_ms = (time.perf_counter() - t_compute_start) * 1000.0

            solver_meta = {
                "engine": "barnes_hut",
                "method": "barnes_hut",
                "input_mode": run_result.input_mode,
                "theta0_requested": theta_requested,
                "theta0_effective": theta_requested,
                "native_entrypoint": (
                    "barnes_hut_forward_gravity_tetra_mesh"
                    if run_result.input_mode == "tetra_mesh"
                    else "barnes_hut_forward_gravity_model"
                ),
                "native_note": (
                    "C++ uses max 4 sources/leaf. You must restart the API after `cmake --build` "
                    "— a running process does not reload the .dylib/.so."
                ),
            }
            if run_result.gmsh_build_meta:
                solver_meta["gmshBuild"] = run_result.gmsh_build_meta
            if mesh_prep_ms > 0.0:
                solver_meta["meshPrepMs"] = round(mesh_prep_ms, 2)
            return jsonify(
                gravity_json_payload(
                    run_result.results,
                    run_result.num_receivers_x,
                    run_result.num_receivers_y,
                    compute_ms,
                    total_ms=(time.perf_counter() - t_total_start) * 1000.0,
                    num_sources=run_result.num_sources,
                    solver_meta=solver_meta,
                )
            )
        except ValueError as e:
            return jsonify({"error": str(e), "status": "validation_failed"}), 400
        except Exception as e:
            traceback.print_exc()
            return jsonify({"error": str(e), "status": "error"}), 500
