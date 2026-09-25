"""Analysis endpoint: each forward method vs analytical closed-form reference."""

import logging
import traceback

from flask import jsonify, request

from ..mesh.mesh_route_utils import has_mesh_payload, is_gmsh_build_request, warn_if_legacy_shape_fields
from ..shared.route_responses import invalid_request_response, validation_failed_response
from .dispatch import run_analysis, run_mesh_analysis
from .shared.compare import resolve_cached_candidate


def register_analysis_routes(app, libs):
    logger = logging.getLogger(__name__)

    @app.route("/api/compute_gravity_analysis", methods=["POST"])
    def compute_gravity_analysis():
        try:
            data = request.json
            if not isinstance(data, dict):
                return invalid_request_response()
            warn_if_legacy_shape_fields(logger, data)
            cached, _, _ = resolve_cached_candidate(data)
            mesh_like = has_mesh_payload(data) or is_gmsh_build_request(data)
            if cached is not None or not mesh_like:
                result = run_analysis(libs, data, logger)
            else:
                result = run_mesh_analysis(libs, data, logger)
            return jsonify(result)
        except ValueError as e:
            return validation_failed_response(str(e))
        except RuntimeError as e:
            return jsonify({"error": str(e), "status": "error"}), 500
        except Exception as e:
            traceback.print_exc()
            return jsonify({"error": f"Analysis failed: {str(e)}", "status": "error"}), 500

    @app.route("/api/compute_gravity_mesh_analysis", methods=["POST"])
    def compute_gravity_mesh_analysis():
        try:
            data = request.json
            if not isinstance(data, dict):
                return invalid_request_response()
            warn_if_legacy_shape_fields(logger, data)
            result = run_mesh_analysis(libs, data, logger)
            return jsonify(result)
        except ValueError as e:
            return validation_failed_response(str(e))
        except RuntimeError as e:
            return jsonify({"error": str(e), "status": "error"}), 500
        except Exception as e:
            traceback.print_exc()
            return jsonify({"error": f"Mesh analysis failed: {str(e)}", "status": "error"}), 500
