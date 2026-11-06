"""Gmsh tetrahedral mesh builder: ``POST /api/build_gmsh_tetra_mesh``."""

import logging
import traceback

from flask import jsonify, request

from gravity.mesh.gmsh_build import gmsh_python_available, is_gmsh_mesh_build_supported

from .mesh_route_utils import build_or_get_gmsh_mesh
from ..shared.route_responses import invalid_request_response, validation_failed_response


def register_gmsh_routes(app, _libs):
    logger = logging.getLogger(__name__)

    @app.route("/api/build_gmsh_tetra_mesh", methods=["POST"])
    def build_gmsh_tetra_mesh_route():
        try:
            data = request.get_json(silent=True)
            if not isinstance(data, dict):
                return invalid_request_response()

            model_type = str(data.get("modelType", "") or "").strip()
            if not model_type:
                return validation_failed_response("Missing modelType.")
            if not is_gmsh_mesh_build_supported(model_type):
                base = model_type.split(" - ")[0] if " - " in model_type else model_type
                return validation_failed_response(
                    f"Tetrahedral mesh generation for '{base}' is not implemented yet. "
                    "Supported: Sphere, Cube, Cuboid, Ellipsoid, Vertical/Horizontal Cylinder."
                )
            if not gmsh_python_available():
                return validation_failed_response(
                    "Gmsh Python API is not installed on the server. "
                    "Run: pip install -r backend/requirements.txt"
                )

            count_only = bool(data.get("countOnly"))
            warm_cache_only = bool(data.get("warmCacheOnly"))
            built, meta = build_or_get_gmsh_mesh(data, logger)
            payload: dict = {
                "numNodes": built.get("numNodes"),
                "numElements": built.get("numElements"),
                "modelType": built.get("modelType", model_type),
                "buildMs": meta.get("buildMs", 0.0),
                "cacheHit": meta.get("cacheHit", False),
            }
            if count_only:
                payload["countOnly"] = True
            if warm_cache_only:
                payload["warmCacheOnly"] = True
            if meta.get("geometryReady") is not None:
                payload["geometryReady"] = bool(meta.get("geometryReady"))
            if meta.get("depthShiftReady") is not None:
                payload["depthShiftReady"] = bool(meta.get("depthShiftReady"))
            if meta.get("calculateReady") is not None:
                payload["calculateReady"] = bool(meta.get("calculateReady"))
            if not count_only and not warm_cache_only:
                payload["mesh"] = built["mesh"]
            logger.info(
                (
                    "build_gmsh_tetra_mesh: %s nodes=%s elements=%s build_ms=%.1f "
                    "cache_hit=%s count_only=%s warm_cache_only=%s"
                ),
                model_type,
                payload.get("numNodes"),
                payload.get("numElements"),
                float(payload.get("buildMs") or 0.0),
                payload.get("cacheHit"),
                count_only,
                warm_cache_only,
            )
            return jsonify(payload)
        except TimeoutError as e:
            return validation_failed_response(str(e))
        except NotImplementedError as e:
            return validation_failed_response(str(e))
        except ValueError as e:
            return validation_failed_response(str(e))
        except Exception as e:
            traceback.print_exc()
            return jsonify({"error": str(e), "status": "unhandled_exception"}), 500
