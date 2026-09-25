#!/usr/bin/env python3
"""Composed Gravity API server."""

import os

from flask import Flask
from flask_cors import CORS

from .shared.constants import BACKEND_DIR, PROJECT_ROOT
from .shared.libraries import load_libraries
from .routes import register_routes

# --- App factory: CORS + FFI libraries + route registration ---

app = Flask(__name__)
# Large tetra meshes can exceed default payloads; keep configurable for benchmarks.
_max_mb = int(os.environ.get('GRAVITY_API_MAX_CONTENT_MB', '512'))
app.config['MAX_CONTENT_LENGTH'] = _max_mb * 1024 * 1024
CORS(app)
libs = load_libraries()
register_routes(app, libs)


# --- Dev main ---

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5002))
    print("Starting Flask API server...")
    print(f"Backend directory: {BACKEND_DIR}")
    print(f"Project root: {PROJECT_ROOT}")
    print(f"Listening on http://0.0.0.0:{port}")
    # threaded=True so one long request (e.g. AMFM) doesn't block health/other requests
    debug = os.environ.get('FLASK_DEBUG', '0').strip().lower() in ('1', 'true', 'yes')
    app.run(host='0.0.0.0', port=port, debug=debug, threaded=True, use_reloader=False)
