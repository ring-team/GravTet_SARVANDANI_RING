"""Analytical closed-form gravity route: ``/api/compute_gravity_analytical``."""

import time
import traceback

from flask import jsonify, request

from gravity.forward_methods.analytical_closedform.dispatcher import solve_analytical_closedform

from ...shared.helpers import gravity_json_payload
from ...shared.route_responses import invalid_request_response, validation_failed_response


def register_analytical_closedform_routes(app, libs):
    @app.route("/api/compute_gravity_analytical", methods=["POST"])
    def compute_gravity_analytical():
        try:
            data = request.json
            if not isinstance(data, dict):
                return invalid_request_response()
            t_compute_start = time.perf_counter()
            results = solve_analytical_closedform(data)
            solver_meta = {
                "input_mode": "analytical_closedform",
                "method": "analytical_closedform",
                "note": "Shape-specific closed-form kernels; mesh discretization is not used.",
            }
            compute_ms = (time.perf_counter() - t_compute_start) * 1000.0
            rx = int(data.get("numReceiversX", 100))
            ry = int(data.get("numReceiversY", 100))
            return jsonify(
                gravity_json_payload(
                    results,
                    rx,
                    ry,
                    compute_ms,
                    solver_meta=solver_meta,
                )
            )
        except ValueError as e:
            return validation_failed_response(str(e))
        except Exception as e:
            traceback.print_exc()
            return jsonify({"error": f"Analytical closed-form calculation failed: {str(e)}", "status": "error"}), 500

