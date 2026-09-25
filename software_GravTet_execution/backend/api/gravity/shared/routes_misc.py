"""Health check and global error handler."""

import ctypes
import logging
import traceback

from flask import jsonify
from werkzeug.exceptions import HTTPException

from gravity.mesh.gmsh_build import gmsh_python_available

logger = logging.getLogger(__name__)


def quadrature_simd_capabilities(library):
    """Only advertise the lane width actually implemented by the loaded kernel."""
    if library is None or not hasattr(library, "quadrature_simd_lanes"):
        return {"available_lanes": [], "active_lanes": None}
    query = library.quadrature_simd_lanes
    query.argtypes = []
    query.restype = ctypes.c_int
    lanes = int(query())
    supports = getattr(library, "quadrature_simd_supports", None)
    if supports is None:
        available = [lanes] if lanes > 1 else []
    else:
        supports.argtypes = [ctypes.c_int]
        supports.restype = ctypes.c_int
        available = [width for width in (2, 4, 8) if supports(width)]
    return {"available_lanes": available, "active_lanes": lanes}


def register_misc_routes(app, libs):
    # --- GET /api/health ---

    @app.route("/api/health", methods=["GET"])
    def health():
        return jsonify(
            {
                "status": "ok",
                "quadrature_simd": quadrature_simd_capabilities(libs.quadrature_second_order),
                "direct_newton_loaded": libs.direct_newton is not None,
                "synthetic_gravity_loaded": libs.synthetic_gravity is not None,
                "amfm_gravity_loaded": libs.amfm is not None,
                "barnes_hut_loaded": libs.barnes_hut is not None,
                "quadrature_second_order_loaded": libs.quadrature_second_order is not None,
                "direct_newton_mesh_forward": bool(
                    getattr(libs, "direct_newton_mesh_forward", False)
                ),
                "gmsh_python_available": gmsh_python_available(),
            }
        )

    # --- JSON error envelope ---

    @app.errorhandler(Exception)
    def handle_api_exception(e):
        if isinstance(e, HTTPException):
            return jsonify({"error": e.description or str(e), "status": "http_error"}), e.code
        traceback.print_exc()
        return jsonify({"error": str(e), "traceback": traceback.format_exc() if app.debug else None, "status": "unhandled_exception"}), 500
