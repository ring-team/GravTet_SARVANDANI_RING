#!/usr/bin/env python3
"""Central API app entrypoint that aggregates domain APIs."""

from api.gravity.api_server import app as gravity_app

# --- Composed Flask app (gravity owns /api today) ---

# For now gravity provides all active endpoints under /api.
app = gravity_app

