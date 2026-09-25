"""Register all gravity HTTP routes on the Flask app."""

from .analysis.routes import register_analysis_routes
from .forward_methods.amfm.routes import register_amfm_routes
from .forward_methods.analytical.routes import register_analytical_closedform_routes
from .forward_methods.barnes_hut.routes import register_barnes_hut_routes
from .forward_methods.direct.routes import register_direct_routes
from .forward_methods.quadrature.routes import register_quadrature_routes
from .mesh.routes import register_gmsh_routes
from .shared.routes_misc import register_misc_routes


def register_routes(app, libs):
    register_misc_routes(app, libs)
    register_gmsh_routes(app, libs)
    register_direct_routes(app, libs)
    register_analytical_closedform_routes(app, libs)
    register_amfm_routes(app, libs)
    register_barnes_hut_routes(app, libs)
    register_quadrature_routes(app, libs)
    register_analysis_routes(app, libs)
